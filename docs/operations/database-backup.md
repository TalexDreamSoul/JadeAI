# Database backup and recovery

JadeAI creates application-consistent SQLite backups and PostgreSQL custom-format dumps.

## Backup

```bash
BACKUP_DIR=/secure/jadeai-backups pnpm db:backup
```

The command writes the backup and a SHA-256 checksum. Store both outside the application host with restricted access. Schedule the command externally and alert on a non-zero exit code. The script never deletes old backups.

## Verify

```bash
pnpm db:backup:verify /secure/jadeai-backups/jadeai-TIMESTAMP.sqlite
pnpm db:backup:verify /secure/jadeai-backups/jadeai-TIMESTAMP.dump
```

Verification checks the checksum plus SQLite `integrity_check` or the PostgreSQL archive catalog. Run it after every backup and perform a restore drill in an isolated environment regularly.

## Restore

Restore changes database state. Stop application and worker traffic, create a fresh pre-restore backup, verify the selected archive, and restore into an isolated database first. Only replace the production database after explicit operator approval and an application smoke test. Do not restore directly over a running database.
