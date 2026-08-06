import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { hasPermission } from "./permissions";

describe("server role permissions", () => {
  it("allows administrators to read cases without granting case mutations", () => {
    expect(hasPermission(Role.ADMIN, "case:read")).toBe(true);
    expect(hasPermission(Role.ADMIN, "case:create")).toBe(false);
    expect(hasPermission(Role.ADMIN, "case:edit")).toBe(false);
    expect(hasPermission(Role.ADMIN, "case:delete")).toBe(false);
    expect(hasPermission(Role.ADMIN, "settings:manage")).toBe(true);
  });
});
