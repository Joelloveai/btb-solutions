import { describe, expect, it } from "vitest";
import { can, isStaffRole, STAFF_ROLES, type Capability } from "@/lib/permissions";

const CAPS: Capability[] = ["staff.any", "users.manage", "financials.view", "money.write", "field.write"];
const allowed = (role: string) => CAPS.filter((c) => can(role, c));

describe("office roles", () => {
  it("gives each role exactly its share", () => {
    expect(allowed("ADMIN")).toEqual(CAPS);
    expect(allowed("MANAGER")).toEqual(["staff.any", "financials.view", "money.write", "field.write"]);
    expect(allowed("SUPERVISOR")).toEqual(["staff.any", "field.write"]);
    expect(allowed("VIEWER")).toEqual(["staff.any", "financials.view"]);
  });
  it("only an admin manages users", () => {
    expect(STAFF_ROLES.filter((r) => can(r, "users.manage"))).toEqual(["ADMIN"]);
  });
  it("a viewer can never write; a supervisor never sees financials", () => {
    expect(can("VIEWER", "money.write") || can("VIEWER", "field.write")).toBe(false);
    expect(can("SUPERVISOR", "financials.view")).toBe(false);
  });
  it("an unknown or missing role can do nothing at all", () => {
    for (const r of [undefined, null, "", "admin", "OWNER", 5]) {
      expect(isStaffRole(r)).toBe(false);
      expect(CAPS.some((c) => can(r, c))).toBe(false);
    }
  });
});
