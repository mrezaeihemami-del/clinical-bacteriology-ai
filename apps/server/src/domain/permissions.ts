import { Role } from "@prisma/client";

export type Permission =
  | "case:read"
  | "case:create"
  | "case:edit"
  | "case:delete"
  | "image:upload"
  | "image:delete"
  | "analysis:run"
  | "case:submit"
  | "case:review"
  | "case:override"
  | "settings:manage"
  | "audit:read";

const permissionsByRole: Record<Role, ReadonlySet<Permission>> = {
  [Role.TECHNICIAN]: new Set([
    "case:read",
    "case:create",
    "case:edit",
    "case:delete",
    "image:upload",
    "image:delete",
    "analysis:run",
    "case:submit",
  ]),
  [Role.MICROBIOLOGIST]: new Set([
    "case:read",
    "analysis:run",
    "case:review",
    "audit:read",
  ]),
  [Role.SUPERVISOR]: new Set([
    "case:read",
    "case:create",
    "case:edit",
    "case:delete",
    "image:upload",
    "image:delete",
    "analysis:run",
    "case:submit",
    "case:review",
    "case:override",
    "audit:read",
  ]),
  [Role.ADMIN]: new Set([
    // Read-only case access prevents administration clients from failing when
    // they refresh the shared case workspace. Mutating case permissions remain
    // intentionally excluded.
    "case:read",
    "settings:manage",
    "audit:read",
  ]),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return permissionsByRole[role]?.has(permission) ?? false;
}
