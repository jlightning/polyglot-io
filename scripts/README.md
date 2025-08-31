# Database Backup Scripts

This directory contains scripts for backing up the Polyglotio database.

## backup-database.js

A Node.js script that creates a SQL dump of the MySQL database running in Docker.

### Usage

```bash
# Basic usage (using npm script)
yarn db:backup

# Or run directly
node scripts/backup-database.js

# With custom environment variables
BACKUP_DIR=/path/to/backups yarn db:backup
```

### Features

- ✅ Creates timestamped SQL backup files
- ✅ Checks if Docker container is running
- ✅ Uses `mysqldump` with proper options (single-transaction, routines, triggers)
- ✅ Configurable via environment variables
- ✅ Shows backup file size and summary
- ✅ Lists recent backups
- ✅ Comprehensive error handling

### Configuration

Copy `backup.env.example` to `backup.env` and customize as needed:

```bash
cp scripts/backup.env.example scripts/backup.env
```

Available environment variables:

| Variable            | Default               | Description                |
| ------------------- | --------------------- | -------------------------- |
| `DB_HOST`           | `localhost`           | Database host              |
| `DB_PORT`           | `3307`                | Database port              |
| `DB_NAME`           | `polyglotio`          | Database name              |
| `DB_USERNAME`       | `polyglotio_user`     | Database username          |
| `DB_PASSWORD`       | `polyglotio_password` | Database password          |
| `BACKUP_DIR`        | `./backups`           | Directory to store backups |
| `DB_CONTAINER_NAME` | `polyglotio-mysql`    | Docker container name      |

### Prerequisites

1. Docker must be running
2. The MySQL container (`polyglotio-mysql`) must be running
3. Node.js must be installed

### Backup File Format

Backup files are named with timestamps:

```
polyglotio_backup_2024-01-15_14-30-25.sql
```

### Examples

```bash
# Create backup with default settings
yarn db:backup

# Custom backup directory
BACKUP_DIR=/tmp/backups yarn db:backup

# Load environment from file
source scripts/backup.env && yarn db:backup

# Help
node scripts/backup-database.js --help
```

### Restoring from Backup

To restore a backup file:

```bash
# Using docker exec
docker exec -i polyglotio-mysql mysql -u polyglotio_user -ppolyglotio_password polyglotio < backups/polyglotio_backup_2024-01-15_14-30-25.sql

# Or if you have mysql client installed locally
mysql -h localhost -P 3307 -u polyglotio_user -ppolyglotio_password polyglotio < backups/polyglotio_backup_2024-01-15_14-30-25.sql
```

## Troubleshooting

### Container not running

```
Error: Docker container 'polyglotio-mysql' is not running
```

**Solution:** Start the container with `yarn docker:up` or `docker-compose up -d`

### Permission denied

```
Error: permission denied
```

**Solution:** Make the script executable: `chmod +x scripts/backup-database.js`

### Backup directory issues

```
Error: Cannot create backup directory
```

**Solution:** Ensure the parent directory exists and you have write permissions

### MySQL connection issues

```
Error: Access denied for user
```

**Solution:** Check your database credentials in the environment variables
