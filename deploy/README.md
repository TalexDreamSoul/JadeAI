# 1Panel + GHCR deployment

This directory contains an example production deployment for JadeAI.

## Flow

1. Push code to `master` or push a tag like `v1.2.3`.
2. GitHub Actions builds a Docker image and publishes it to GHCR as public.
3. After a successful image push, GitHub Actions sends a webhook to 1Panel.
4. 1Panel runs `scripts/1panel-deploy.sh`: pull the new image, start the inactive blue/green container, health-check it, reload Nginx upstream, then remove the old container only after success. If the new container fails, the old container keeps serving.

## First-time 1Panel setup

1. Create an app/compose project directory, for example:

   ```bash
   mkdir -p /opt/1panel/apps/jadeai
   ```

2. Copy `deploy/docker-compose.1panel.yml` to `/opt/1panel/apps/jadeai/docker-compose.yml`.
3. Create the Nginx config directory:

   ```bash
   mkdir -p /opt/1panel/apps/jadeai/nginx
   ```

4. Copy `deploy/1panel.env.example` to `/opt/1panel/apps/jadeai/.env` and fill at least:

   - `AUTH_SECRET`
   - `WEBHOOK_SECRET`
   - optional AI / database variables

5. Copy `deploy/nginx/default.conf` to `/opt/1panel/apps/jadeai/nginx/default.conf`.
6. Copy `scripts/1panel-deploy.sh` to the host and make it executable:

   ```bash
   install -m 0755 scripts/1panel-deploy.sh /opt/1panel/apps/jadeai/1panel-deploy.sh
   ```

7. Start once in 1Panel or by CLI:

   ```bash
   cd /opt/1panel/apps/jadeai
   docker compose -p jadeai -f docker-compose.yml up -d proxy jadeai-blue
   ```

## 1Panel webhook

Create a webhook in 1Panel that runs a shell command similar to:

```bash
cd /opt/1panel/apps/jadeai && set -a && . ./.env && set +a && ./1panel-deploy.sh "$WEBHOOK_SECRET"
```

Use the generated 1Panel webhook URL as GitHub secret `ONEPANEL_WEBHOOK_URL`.

## GitHub secrets / variables

Required secret:

- `ONEPANEL_WEBHOOK_URL`: 1Panel webhook URL.

Optional secrets / variables:

- `ONEPANEL_WEBHOOK_TOKEN`: sent as `Authorization: Bearer ...` if your webhook gateway validates it.
- `ONEPANEL_WEBHOOK_SECRET`: included in JSON body as `secret` if your 1Panel command reads request payload.
- `GHCR_IMAGE`: override image name, for example `ghcr.io/talexdreamsoul/jadeai`.

The workflow uses GitHub's built-in `GITHUB_TOKEN` to publish to GHCR. Repository package visibility is also switched to public when possible.

## Release commands

The workflow watches `master` and tags. A typical release:

```bash
git checkout master
git pull --ff-only
git add .
git commit -m "chore: release"
git tag v1.2.3
git push origin master v1.2.3
```

Pushing `master` publishes `master`, `sha-xxxxxxx`, and `latest` for validation. Pushing `v*` publishes semver tags and `latest`, creates a GitHub Release, then triggers deployment. This avoids double deployment when you push `master` and a tag together.

## Troubleshooting

### GitHub Actions says webhook accepted, but the site did not update

Check the live commit first:

```bash
curl -fsS https://your-domain.example.com/api/ready
```

If the returned `commit` is not the workflow SHA, inspect the 1Panel host:

```bash
cd /opt/1panel/apps/jadeai # or your actual app directory
ps -eo pid,ppid,etime,stat,cmd | grep -E 'deploy|docker compose pull|compose pull' | grep -v grep
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
docker compose ps
tail -200 deploy-webhook.log 2>/dev/null || true
```

A common failure mode is a stuck `docker compose pull` against GHCR. The deploy script supports `PULL_TIMEOUT` and skips pull when the requested image already exists locally. If a stale deploy process is holding the lock, stop the stuck pull process so the rollback trap can restore the previous compose file and release the lock.

For emergency deployment when the target host cannot pull from GHCR, load the already-built image manually and run with `SKIP_PULL=1`:

```bash
# local machine
docker pull ghcr.io/<owner>/<repo>@sha256:<digest>
docker tag ghcr.io/<owner>/<repo>@sha256:<digest> ghcr.io/<owner>/<repo>:manual-<sha>
docker save ghcr.io/<owner>/<repo>:manual-<sha> | gzip -1 | ssh root@host 'gunzip | docker load'

# target host
cd /opt/1panel/apps/jadeai
JADEAI_IMAGE=ghcr.io/<owner>/<repo>:manual-<sha> SKIP_PULL=1 ./1panel-deploy.sh "$WEBHOOK_SECRET"
```

## Downtime note

The example compose puts Nginx in front and blue/green app containers behind it. Deploys reload Nginx after the inactive app is healthy, so existing service stays available and failed deploys roll back by keeping the previous upstream. For multi-host or high-traffic production, use an external load balancer / orchestrator and database migrations that are backward compatible.
