import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import argon2 from "argon2";
import sharp from "sharp";
import {
  AiProvider,
  CaseStatus,
  Role,
  SpecimenType,
} from "@prisma/client";
import { createApp } from "./app";
import { prisma } from "./db";
import { ensureStorageBucket } from "./services/storage";

const app = createApp();

async function createUser(input: {
  id: string;
  email: string;
  role: Role;
}) {
  const passwordHash = await argon2.hash("ChangeMe-123!");
  await prisma.user.create({
    data: {
      id: input.id,
      email: input.email,
      displayName: input.email,
      passwordHash,
      memberships: {
        create: {
          organisationId: "org-test",
          role: input.role,
        },
      },
    },
  });
}

async function login(email: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({
    email,
    password: "ChangeMe-123!",
  });
  expect(response.status).toBe(200);
  return agent;
}

beforeAll(async () => {
  await prisma.$connect();
  await ensureStorageBucket();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "AuditEvent"');

  await prisma.rateLimitBucket.deleteMany();
  await prisma.caseStatusTransition.deleteMany();
  await prisma.reviewDecisionRecord.deleteMany();
  await prisma.imageAnalysis.deleteMany();
  await prisma.caseImage.deleteMany();
  await prisma.case.deleteMany();
  await prisma.session.deleteMany();
  await prisma.aiProviderConfig.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organisation.deleteMany();

  await prisma.organisation.create({
    data: {
      id: "org-test",
      name: "Test Laboratory",
    },
  });

  await createUser({
    id: "tech-test",
    email: "technician@test.local",
    role: Role.TECHNICIAN,
  });
  await createUser({
    id: "micro-test",
    email: "microbiologist@test.local",
    role: Role.MICROBIOLOGIST,
  });
  await createUser({
    id: "admin-test",
    email: "admin@test.local",
    role: Role.ADMIN,
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("case creation validation", () => {
  it("returns a field-specific message for a case code shorter than 3 characters", async () => {
    const agent = await login("technician@test.local");

    const response = await agent.post("/api/cases").send({
      caseCode: "gg",
      specimenType: SpecimenType.URINE,
      collectionDate: new Date().toISOString(),
      cultureMedia: "Blood agar",
      incubationHours: 24,
      gramStainAvailable: false,
      microscopyAvailable: false,
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.message).toContain(
      "Case code must contain at least 3 characters",
    );
  });
});

describe("real upload and server-side controls", () => {
  it("uploads real multipart image bytes and persists validated metadata", async () => {
    const agent = await login("technician@test.local");

    const created = await agent.post("/api/cases").send({
      caseCode: "CASE-001",
      specimenType: SpecimenType.URINE,
      collectionDate: new Date().toISOString(),
      cultureMedia: "Blood agar",
      incubationHours: 24,
      gramStainAvailable: false,
      microscopyAvailable: false,
    });
    expect(created.status).toBe(201);

    const png = await sharp({
      create: {
        width: 128,
        height: 128,
        channels: 3,
        background: { r: 80, g: 20, b: 20 },
      },
    })
      .png()
      .toBuffer();

    const uploaded = await agent
      .post(`/api/cases/${created.body.case.id}/images`)
      .attach("image", png, {
        filename: "plate.png",
        contentType: "image/png",
      });

    expect(uploaded.status).toBe(201);
    expect(uploaded.body.image.detectedMimeType).toBe("image/png");
    expect(uploaded.body.image.width).toBe(128);
    expect(uploaded.body.image.sha256).toMatch(/^[a-f0-9]{64}$/);

    const stored = await prisma.caseImage.findUnique({
      where: { id: uploaded.body.image.id },
      include: { case: true },
    });
    expect(stored?.storageKey).toContain("org-test/");
    expect(stored?.case.status).toBe(CaseStatus.IMAGE_UPLOADED);
  });

  it("rejects MIME spoofing", async () => {
    const agent = await login("technician@test.local");
    const item = await prisma.case.create({
      data: {
        organisationId: "org-test",
        createdById: "tech-test",
        caseCode: "CASE-SPOOF",
        specimenType: SpecimenType.URINE,
        collectionDate: new Date(),
        cultureMedia: "Blood agar",
        incubationHours: 24,
      },
    });

    const png = await sharp({
      create: {
        width: 128,
        height: 128,
        channels: 3,
        background: { r: 0, g: 0, b: 255 },
      },
    })
      .png()
      .toBuffer();

    const response = await agent
      .post(`/api/cases/${item.id}/images`)
      .attach("image", png, {
        filename: "pretend.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe("MIME_TYPE_MISMATCH");
  });

  it("denies review to a technician at the server", async () => {
    const agent = await login("technician@test.local");
    const item = await prisma.case.create({
      data: {
        organisationId: "org-test",
        createdById: "tech-test",
        caseCode: "CASE-REVIEW",
        specimenType: SpecimenType.URINE,
        collectionDate: new Date(),
        cultureMedia: "Blood agar",
        incubationHours: 24,
        status: CaseStatus.SUBMITTED_FOR_REVIEW,
      },
    });

    const response = await agent
      .post(`/api/cases/${item.id}/reviews`)
      .send({ decision: "APPROVED" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("stores provider keys encrypted and returns only a mask", async () => {
    const agent = await login("admin@test.local");
    const secret = "example-google-key-1234567890";

    const saved = await agent.put("/api/settings/ai-providers").send({
      provider: AiProvider.GOOGLE_NATIVE,
      baseUrl: "https://generativelanguage.googleapis.com",
      model: "gemini-3.6-flash",
      apiKey: secret,
      enabled: true,
      visionEnabled: true,
      timeoutMs: 45000,
      maxImageBytes: 10485760,
    });

    expect(saved.status).toBe(200);
    expect(JSON.stringify(saved.body)).not.toContain(secret);
    expect(saved.body.provider.apiKeyMasked).toBe("••••••••7890");

    const stored = await prisma.aiProviderConfig.findFirstOrThrow();
    expect(stored.apiKeyCiphertext).not.toContain(secret);
    expect(stored.apiKeyLastFour).toBe("7890");

    const updated = await agent.put("/api/settings/ai-providers").send({
      provider: AiProvider.GOOGLE_NATIVE,
      model: "gemini-3.5-flash",
      enabled: true,
      visionEnabled: true,
      timeoutMs: 60000,
      maxImageBytes: 10485760,
    });

    expect(updated.status).toBe(200);
    expect(updated.body.saved).toBe(true);
    expect(updated.body.provider.hasApiKey).toBe(true);
    expect(updated.body.provider.apiKeyMasked).toBe("••••••••7890");

    const storedAfterUpdate = await prisma.aiProviderConfig.findFirstOrThrow();
    expect(storedAfterUpdate.apiKeyCiphertext).toBe(stored.apiKeyCiphertext);
    expect(storedAfterUpdate.baseUrl).toBe(
      "https://generativelanguage.googleapis.com",
    );
  });
});
