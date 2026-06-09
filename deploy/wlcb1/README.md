# wlcb1 Jenkins deployment

This directory contains the deployment assets for the new JadeAI flow:

```text
GitHub push master/preview
  -> GitHub Actions builds and pushes GHCR image
  -> GitHub Actions triggers Jenkins job jadeai-deploy
  -> Jenkins SSHs to wlcb1
  -> wlcb1 pulls GHCR image and updates docker compose
  -> health check passes or automatic rollback is attempted
```

## Branch mapping

| Branch | Environment | Directory | Container | Local port | Domain |
| --- | --- | --- | --- | --- | --- |
| `master` | `production` | `/opt/jadeai/resume-production` | `jadeai-resume-production` | `127.0.0.1:3710` on current wlcb1 migration | `resume.wc1.tagzxia.com` |
| `preview` | `preview` | `/opt/jadeai/resume-preview` | `jadeai-resume-preview` | `127.0.0.1:18081` | `resume-preview.wc1.tagzxia.com` |

Production keeps the existing public port mapping during migration. Preview uses `127.0.0.1:18081`; after it is deployed, configure reverse proxy:

```text
resume-preview.wc1.tagzxia.com -> http://127.0.0.1:18081
```

## GitHub configuration

Workflow: `.github/workflows/docker-ghcr-deploy.yml`

Required repository secrets:

- `JENKINS_URL`, for example `https://jenkins.example.com` or `http://wlcb1:3880`
- `JENKINS_USER`
- `JENKINS_API_TOKEN`
- `JENKINS_JOB_TOKEN`

Optional repository variables:

- `GHCR_IMAGE_NAME`, defaults to `jadeai-resume`
- `JENKINS_JOB_NAME`, defaults to `jadeai-deploy`; nested folders can be written as `folder/jadeai-deploy`

The workflow publishes two tags per deployment:

```text
ghcr.io/<owner>/<image>:<environment>-<short_sha>-<github_run_number>
ghcr.io/<owner>/<image>:<environment>-latest
```

Jenkins deploys only the immutable tag.

## Jenkins job

Create a `Parameterized Pipeline` job named `jadeai-deploy`.

Parameters:

- `BRANCH`
- `ENV_NAME`
- `IMAGE`
- `DOMAIN`
- `COMMIT_SHA`
- `GITHUB_RUN_NUMBER`
- `GITHUB_RUN_ID`

Use `deploy/wlcb1/Jenkinsfile` as the Pipeline script, or paste it into the job.

Credential required by the Jenkinsfile:

- SSH private key credential ID: `wlcb1-ssh-key`

## wlcb1 files

Each environment directory needs:

```text
docker-compose.yml
.env
deploy.sh
rollback.sh
cleanup-images.sh
current-image.txt      # generated
previous-image.txt     # generated after first upgrade
```

`deploy.sh` updates only deployment metadata in `.env`:

- `JADEAI_IMAGE`
- `APP_VERSION`
- `GIT_SHA` when Jenkins passes `COMMIT_SHA`

Secrets and auth/database config stay in `.env`.

## Manual deploy test

```bash
cd /opt/jadeai/resume-preview
COMMIT_SHA=<full_sha> ./deploy.sh \
  ghcr.io/<owner>/jadeai-resume:preview-<short_sha>-<run_number> \
  jadeai-resume-preview \
  http://127.0.0.1:18081/api/ready \
  5
```

## Manual rollback

```bash
cd /opt/jadeai/resume-preview
./rollback.sh jadeai-resume-preview http://127.0.0.1:18081/api/ready
```

## Local cleanup

```bash
cd /opt/jadeai/resume-preview
./cleanup-images.sh ghcr.io/<owner>/jadeai-resume 5
```

GHCR package cleanup is intentionally not enabled in this phase to avoid deleting rollback targets.
