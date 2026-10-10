export type Role = "staff" | "client" | "sub";

/** Where each kind of user lands after signing in. */
export const homeFor = (role: Role | null | undefined) =>
  role === "client" ? "/client/projects" : role === "sub" ? "/sub/tasks" : "/dashboard";
