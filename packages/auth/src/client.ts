import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { ssoClient } from "@better-auth/sso/client";
import { ac, roles } from "./permissions";

export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      ac,
      roles,
    }),
    ssoClient({
      domainVerification: {
        enabled: true,
      },
    }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
