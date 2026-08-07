# Garage (local S3-compatible storage)

Used only for local development so `packages/core`'s `getUploadUrl`/`getDownloadUrl`
have a real S3 API to talk to without needing Hetzner credentials. Production
points the same code at Hetzner Object Storage instead.

## One-time setup

1. Copy the config template and fill in generated secrets:
   ```sh
   cp infra/garage/garage.toml.example infra/garage/garage.local.toml
   # replace rpc_secret / admin_token / metrics_token, e.g.:
   node -e "const c=require('crypto');console.log(c.randomBytes(32).toString('hex'))"       # rpc_secret
   node -e "const c=require('crypto');console.log(c.randomBytes(32).toString('base64'))"    # admin_token / metrics_token
   ```
2. Start the containers: `docker compose -f docker-compose.dev.yml up -d`
3. Assign the single-node layout (only needed once per fresh `garage-meta` volume):
   ```sh
   docker exec lingl-docs-garage /garage status   # copy the node ID
   docker exec lingl-docs-garage /garage layout assign -z dc1 -c 1G <node-id>
   docker exec lingl-docs-garage /garage layout apply --version 1
   ```
4. Create an access key and the dev bucket. `--owner` is required (not just
   `--read --write`) so the key is also allowed to set the bucket's CORS
   policy in the next step:
   ```sh
   docker exec lingl-docs-garage /garage key create lingl-docs-web
   docker exec lingl-docs-garage /garage bucket create lingl-docs-dev
   docker exec lingl-docs-garage /garage bucket allow --read --write --owner --key lingl-docs-web lingl-docs-dev
   ```
5. Put the printed Key ID / Secret key into `apps/web/.env.local` as
   `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` (endpoint/region/bucket are
   already set in `.env.example`).
6. Configure CORS on the bucket. Uploads/downloads go directly from the
   browser to Garage on a different origin/port, so without this step the
   browser blocks the presigned PUT with a generic "Failed to fetch" (curl
   and Node's own `fetch` don't hit this, since CORS is a browser-only check
   - that's why the earlier script-based smoke test didn't catch it):
   ```sh
   node --env-file=apps/web/.env.local packages/core/scripts/configure-cors.mjs
   ```
   For access through a LAN hostname or IP, set `APP_ORIGINS` to a
   comma-separated allowlist (for example
   `http://localhost:3000,http://dev-host.local:3000`) before running the command.

On Windows with Git Bash, prefix the `docker exec` commands with
`MSYS_NO_PATHCONV=1` so `/garage` isn't rewritten into a Windows path.

Steps 3-4-6 are stored in the `garage-meta`/`garage-data` volumes, so they
only need to be redone if those volumes are removed (`docker compose down -v`).
