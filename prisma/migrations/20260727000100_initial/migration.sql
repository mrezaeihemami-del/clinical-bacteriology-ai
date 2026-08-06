CREATE TYPE "Role" AS ENUM ('TECHNICIAN', 'MICROBIOLOGIST', 'SUPERVISOR', 'ADMIN');
CREATE TYPE "CaseStatus" AS ENUM ('DRAFT', 'IMAGE_UPLOADED', 'QC_COMPLETED', 'TRIAGE_COMPLETED', 'SUBMITTED_FOR_REVIEW', 'APPROVED', 'REJECTED', 'FINALISED');
CREATE TYPE "SpecimenType" AS ENUM ('URINE', 'STERILE_SITE', 'SPUTUM', 'THROAT', 'GENITAL', 'OTHER');
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'NOT_RUN');
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'REJECTED', 'OVERRIDDEN');
CREATE TYPE "AiProvider" AS ENUM ('GOOGLE_NATIVE', 'OPENAI_COMPATIBLE');

CREATE TABLE "Organisation" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Case" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "caseCode" TEXT NOT NULL,
  "specimenType" "SpecimenType" NOT NULL,
  "collectionDate" TIMESTAMP(3) NOT NULL,
  "cultureMedia" TEXT NOT NULL,
  "incubationHours" INTEGER NOT NULL,
  "gramStainAvailable" BOOLEAN NOT NULL DEFAULT false,
  "gramStainResult" TEXT,
  "microscopyAvailable" BOOLEAN NOT NULL DEFAULT false,
  "microscopyResult" TEXT,
  "notes" TEXT,
  "status" "CaseStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseImage" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "detectedMimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "analysisLockToken" TEXT,
  "analysisLockExpiresAt" TIMESTAMP(3),
  CONSTRAINT "CaseImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImageAnalysis" (
  "id" TEXT NOT NULL,
  "imageId" TEXT NOT NULL,
  "status" "AnalysisStatus" NOT NULL,
  "provider" "AiProvider",
  "model" TEXT,
  "promptVersion" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "inputImageSha256" TEXT NOT NULL,
  "imageQuality" TEXT,
  "qualityIssues" JSONB,
  "growthPattern" TEXT,
  "observations" JSONB,
  "confidence" DOUBLE PRECISION,
  "requiresHumanReview" BOOLEAN NOT NULL DEFAULT true,
  "limitations" JSONB,
  "failureReason" TEXT,
  "rawResponseRedacted" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ImageAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewDecisionRecord" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "decision" "ReviewDecision" NOT NULL,
  "comments" TEXT,
  "overrideReason" TEXT,
  "analysisId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewDecisionRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseStatusTransition" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "fromStatus" "CaseStatus" NOT NULL,
  "toStatus" "CaseStatus" NOT NULL,
  "actorId" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseStatusTransition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiProviderConfig" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "provider" "AiProvider" NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "apiKeyCiphertext" TEXT,
  "apiKeyIv" TEXT,
  "apiKeyAuthTag" TEXT,
  "apiKeyLastFour" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "visionEnabled" BOOLEAN NOT NULL DEFAULT true,
  "timeoutMs" INTEGER NOT NULL DEFAULT 45000,
  "maxImageBytes" INTEGER NOT NULL DEFAULT 10485760,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiProviderConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RateLimitBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "actorId" TEXT,
  "caseId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "outcome" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Membership_userId_key" ON "Membership"("userId");
CREATE UNIQUE INDEX "Membership_userId_organisationId_key" ON "Membership"("userId", "organisationId");
CREATE INDEX "Membership_organisationId_role_idx" ON "Membership"("organisationId", "role");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");
CREATE UNIQUE INDEX "Case_organisationId_caseCode_key" ON "Case"("organisationId", "caseCode");
CREATE INDEX "Case_organisationId_status_createdAt_idx" ON "Case"("organisationId", "status", "createdAt");
CREATE UNIQUE INDEX "CaseImage_storageKey_key" ON "CaseImage"("storageKey");
CREATE UNIQUE INDEX "CaseImage_caseId_sha256_key" ON "CaseImage"("caseId", "sha256");
CREATE INDEX "CaseImage_caseId_uploadedAt_idx" ON "CaseImage"("caseId", "uploadedAt");
CREATE INDEX "CaseImage_analysisLockExpiresAt_idx" ON "CaseImage"("analysisLockExpiresAt");
CREATE INDEX "ImageAnalysis_imageId_startedAt_idx" ON "ImageAnalysis"("imageId", "startedAt");
CREATE INDEX "ReviewDecisionRecord_caseId_createdAt_idx" ON "ReviewDecisionRecord"("caseId", "createdAt");
CREATE INDEX "CaseStatusTransition_caseId_createdAt_idx" ON "CaseStatusTransition"("caseId", "createdAt");
CREATE UNIQUE INDEX "AiProviderConfig_organisationId_provider_key" ON "AiProviderConfig"("organisationId", "provider");
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");
CREATE INDEX "AuditEvent_organisationId_createdAt_idx" ON "AuditEvent"("organisationId", "createdAt");
CREATE INDEX "AuditEvent_caseId_createdAt_idx" ON "AuditEvent"("caseId", "createdAt");

CREATE FUNCTION "prevent_audit_event_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditEvent rows are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditEvent_append_only"
BEFORE UPDATE OR DELETE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_audit_event_mutation"();

ALTER TABLE "Case" ADD CONSTRAINT "Case_incubationHours_check" CHECK ("incubationHours" >= 0 AND "incubationHours" <= 240);
ALTER TABLE "CaseImage" ADD CONSTRAINT "CaseImage_dimensions_check" CHECK ("sizeBytes" > 0 AND "width" >= 64 AND "height" >= 64);
ALTER TABLE "ImageAnalysis" ADD CONSTRAINT "ImageAnalysis_confidence_check" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));
ALTER TABLE "ImageAnalysis" ADD CONSTRAINT "ImageAnalysis_human_review_check" CHECK ("requiresHumanReview" = true);
ALTER TABLE "AiProviderConfig" ADD CONSTRAINT "AiProviderConfig_limits_check" CHECK ("timeoutMs" BETWEEN 5000 AND 120000 AND "maxImageBytes" BETWEEN 65536 AND 26214400);

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Case" ADD CONSTRAINT "Case_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Case" ADD CONSTRAINT "Case_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseImage" ADD CONSTRAINT "CaseImage_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseImage" ADD CONSTRAINT "CaseImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImageAnalysis" ADD CONSTRAINT "ImageAnalysis_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "CaseImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecisionRecord" ADD CONSTRAINT "ReviewDecisionRecord_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecisionRecord" ADD CONSTRAINT "ReviewDecisionRecord_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecisionRecord" ADD CONSTRAINT "ReviewDecisionRecord_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "ImageAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseStatusTransition" ADD CONSTRAINT "CaseStatusTransition_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseStatusTransition" ADD CONSTRAINT "CaseStatusTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiProviderConfig" ADD CONSTRAINT "AiProviderConfig_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
