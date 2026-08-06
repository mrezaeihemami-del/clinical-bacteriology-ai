import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: {
        userId: string;
        organisationId: string;
        role: Role;
        email: string;
        displayName: string;
      };
    }
  }
}

export {};
