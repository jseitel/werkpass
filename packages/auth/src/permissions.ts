import { createAccessControl } from "better-auth/plugins/access";

// Resources/actions relevant to machine documentation management.
// Extend this statement as new domain actions need permission checks.
const statement = {
  machine: ["create", "update", "delete"],
  document: ["create", "update", "delete", "publish"],
} as const;

export const ac = createAccessControl(statement);

// Roles map to the ADR's Admin/Editor/Viewer model. "admin" is also the
// organization owner's default role.
export const admin = ac.newRole({
  machine: ["create", "update", "delete"],
  document: ["create", "update", "delete", "publish"],
});

export const editor = ac.newRole({
  machine: ["create", "update"],
  document: ["create", "update", "publish"],
});

export const viewer = ac.newRole({
  machine: [],
  document: [],
});

export const roles = { admin, editor, viewer };
