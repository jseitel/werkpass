import { headers } from "next/headers";
import { auth } from "@werkpass/auth";
import {
  getDefaultOrganizationId,
  listUserOrganizations,
} from "@werkpass/core";
import { OrganizationSwitcher } from "./organization-switcher";

export async function DashboardOrganizationSwitcher() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const [memberships, defaultOrganizationId] = await Promise.all([
    listUserOrganizations(session.user.id),
    getDefaultOrganizationId(session.user.id),
  ]);
  const organizations = memberships.map(({ organization }) => organization);
  const validDefaultOrganizationId = organizations.some(
    (organization) => organization.id === defaultOrganizationId,
  )
    ? defaultOrganizationId
    : null;

  return (
    <OrganizationSwitcher
      organizations={organizations}
      activeOrganizationId={session.session.activeOrganizationId ?? null}
      initialDefaultOrganizationId={validDefaultOrganizationId}
    />
  );
}
