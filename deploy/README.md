# JadeAI deployment

The production path is GitHub Actions -> GHCR -> Jenkins. See `deploy/wlcb1/README.md`
for the active preview and production topology. The 1Panel files in this directory are a
manual blue/green fallback for hosts that are not managed by Jenkins.

## Images

The canonical package is `ghcr.io/talexdreamsoul/jadeai-resume`.

- Preview builds publish immutable `preview-<sha>-<run>` tags and `preview-latest`.
- Production builds publish immutable `production-<sha>-<run>` tags and `production-latest`.
- Pull requests and pushes to `main` run quality gates without deploying.
- Production is dispatched manually from `main`; a push to `preview` deploys preview automatically.

Prefer an immutable tag for deployment and rollback. The moving tags are intended for local
evaluation and first-time setup.

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
   - `DATA_ENCRYPTION_KEY`
   - `WEBHOOK_SECRET`
   - authentication, payment, AI and database variables required by the selected features

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

## Manual 1Panel deployment

Pin the exact image produced by the quality-gated workflow, then run:

```bash
cd /opt/1panel/apps/jadeai
IMAGE=ghcr.io/talexdreamsoul/jadeai-resume:production-<sha>-<run> ./1panel-deploy.sh "$WEBHOOK_SECRET"
```

The script starts the inactive color, waits for `/api/ready`, switches Nginx, and only
then removes the old container. A failed health check leaves the active version serving.

If a 1Panel webhook invokes the script, keep the webhook private and validate
`WEBHOOK_SECRET`. The active GitHub workflow does not call this webhook.

## GitHub configuration

The active workflow uses GitHub's `GITHUB_TOKEN` to publish to GHCR. Configure the Jenkins
secrets documented in `deploy/wlcb1/README.md`. Optional repository variables are:

- `GHCR_IMAGE_NAME`: overrides the default `jadeai-resume` package name in the main workflow.
- `GHCR_IMAGE`: full image path override used only by the legacy manual publisher.

## Release commands

Run all quality gates, then dispatch `JadeAI Quality And Deployment` from `main`
with `target_environment=production`. The workflow rejects production requests from any
other branch. Do not treat the legacy manual publisher as a production deploy.

```bash
gh workflow run docker-ghcr-deploy.yml --ref main -f target_environment=production
```

## Troubleshooting

### The workflow completed, but the site did not update

Check the live commit first:

```bash
curl -fsS https://your-domain.example.com/api/ready
```

If the returned `commit` is not the workflow SHA, inspect Jenkins first. For a manual
1Panel deployment, inspect the target host:

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
docker pull ghcr.io/<owner>/jadeai-resume@sha256:<digest>
docker tag ghcr.io/<owner>/jadeai-resume@sha256:<digest> ghcr.io/<owner>/jadeai-resume:manual-<sha>
docker save ghcr.io/<owner>/jadeai-resume:manual-<sha> | gzip -1 | ssh root@host 'gunzip | docker load'

# target host
cd /opt/1panel/apps/jadeai
JADEAI_IMAGE=ghcr.io/<owner>/jadeai-resume:manual-<sha> SKIP_PULL=1 ./1panel-deploy.sh "$WEBHOOK_SECRET"
```

## Downtime note

The example compose puts Nginx in front and blue/green app containers behind it. Deploys reload Nginx after the inactive app is healthy, so existing service stays available and failed deploys roll back by keeping the previous upstream. For multi-host or high-traffic production, use an external load balancer / orchestrator and database migrations that are backward compatible.
