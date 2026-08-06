import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const router = Router();

router.use(requireAuth, requirePermission("audit:read"));

router.get("/", async (request, response) => {
  const query = z
    .object({
      limit: z.coerce.number().int().min(1).max(200).default(50),
      cursor: z.string().optional(),
      caseId: z.string().optional(),
    })
    .parse(request.query);

  const events = await prisma.auditEvent.findMany({
    where: {
      organisationId: request.auth!.organisationId,
      ...(query.caseId ? { caseId: query.caseId } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(query.cursor
      ? {
          cursor: { id: query.cursor },
          skip: 1,
        }
      : {}),
    include: {
      actor: {
        select: {
          displayName: true,
          email: true,
        },
      },
    },
  });

  const hasMore = events.length > query.limit;
  const page = hasMore ? events.slice(0, query.limit) : events;

  response.json({
    events: page,
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  });
});

export default router;
