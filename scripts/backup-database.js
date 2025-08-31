#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Database backup script for Polyglotio MySQL database
 * Creates SQL dump files with timestamp
 */

// Configuration
const DEFAULT_CONFIG = {
  host: 'localhost',
  port: '3307',
  database: 'polyglotio',
  username: 'polyglotio_user',
  password: 'polyglotio_password',
  backupDir: './backups',
  containerName: 'polyglotio-mysql',
};

/**
 * Parse environment variables or use defaults
 */
function getConfig() {
  return {
    host: process.env.DB_HOST || DEFAULT_CONFIG.host,
    port: process.env.DB_PORT || DEFAULT_CONFIG.port,
    database: process.env.DB_NAME || DEFAULT_CONFIG.database,
    username: process.env.DB_USERNAME || DEFAULT_CONFIG.username,
    password: process.env.DB_PASSWORD || DEFAULT_CONFIG.password,
    backupDir: process.env.BACKUP_DIR || DEFAULT_CONFIG.backupDir,
    containerName:
      process.env.DB_CONTAINER_NAME || DEFAULT_CONFIG.containerName,
  };
}

/**
 * Generate timestamp for backup filename
 */
function getTimestamp() {
  const now = new Date();
  return now
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace(/T/, '_')
    .split('.')[0];
}

/**
 * Ensure backup directory exists
 */
function ensureBackupDir(backupDir) {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`✅ Created backup directory: ${backupDir}`);
  }
}

/**
 * Check if Docker container is running
 */
function checkDockerContainer(containerName) {
  return new Promise((resolve, reject) => {
    exec(
      `docker ps --filter "name=${containerName}" --format "{{.Names}}"`,
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Error checking container: ${error.message}`));
          return;
        }

        const isRunning = stdout.trim() === containerName;
        resolve(isRunning);
      }
    );
  });
}

/**
 * Create database backup using mysqldump
 */
function createBackup(config, filename) {
  return new Promise((resolve, reject) => {
    const { host, port, database, username, password, containerName } = config;

    // Use docker exec to run mysqldump inside the container
    const mysqldumpCmd = `mysqldump -h localhost -P 3306 -u ${username} -p${password} --single-transaction --routines --triggers ${database}`;
    const dockerCmd = `docker exec ${containerName} ${mysqldumpCmd}`;

    console.log(`🔄 Creating backup: ${filename}`);
    console.log(`📊 Database: ${database}`);

    exec(
      dockerCmd,
      { maxBuffer: 1024 * 1024 * 50 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Backup failed: ${error.message}`));
          return;
        }

        if (
          stderr &&
          !stderr.includes('Using a password on the command line')
        ) {
          console.warn(`⚠️  Warning: ${stderr}`);
        }

        // Write backup to file
        fs.writeFileSync(filename, stdout);

        // Get file size
        const stats = fs.statSync(filename);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

        resolve({
          filename,
          size: fileSizeInMB,
          records: (stdout.match(/INSERT INTO/g) || []).length,
        });
      }
    );
  });
}

/**
 * Main backup function
 */
async function main() {
  try {
    console.log('🚀 Starting database backup...\n');

    const config = getConfig();
    const timestamp = getTimestamp();
    const filename = path.join(
      config.backupDir,
      `polyglotio_backup_${timestamp}.sql`
    );

    // Ensure backup directory exists
    ensureBackupDir(config.backupDir);

    // Check if Docker container is running
    console.log(`🔍 Checking Docker container: ${config.containerName}`);
    const isContainerRunning = await checkDockerContainer(config.containerName);

    if (!isContainerRunning) {
      throw new Error(
        `Docker container '${config.containerName}' is not running. Start it with: docker-compose up -d`
      );
    }
    console.log('✅ Docker container is running\n');

    // Create backup
    const result = await createBackup(config, filename);

    console.log('\n🎉 Backup completed successfully!');
    console.log(`📁 File: ${result.filename}`);
    console.log(`📊 Size: ${result.size} MB`);
    console.log(`📝 Tables with data: ${result.records} INSERT statements`);

    // Show recent backups
    const backupFiles = fs
      .readdirSync(config.backupDir)
      .filter(
        file => file.startsWith('polyglotio_backup_') && file.endsWith('.sql')
      )
      .sort()
      .reverse()
      .slice(0, 5);

    if (backupFiles.length > 1) {
      console.log('\n📋 Recent backups:');
      backupFiles.forEach((file, index) => {
        const filePath = path.join(config.backupDir, file);
        const stats = fs.statSync(filePath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        const date = new Date(stats.mtime).toLocaleString();
        const indicator = index === 0 ? '👆 (latest)' : '';
        console.log(`   ${file} - ${sizeInMB} MB - ${date} ${indicator}`);
      });
    }
  } catch (error) {
    console.error('\n❌ Backup failed:', error.message);
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
📦 Polyglotio Database Backup Tool

Usage: node scripts/backup-database.js

Environment Variables:
  DB_HOST              Database host (default: localhost)
  DB_PORT              Database port (default: 3307)
  DB_NAME              Database name (default: polyglotio)
  DB_USERNAME          Database username (default: polyglotio_user)
  DB_PASSWORD          Database password (default: polyglotio_password)
  BACKUP_DIR           Backup directory (default: ./backups)
  DB_CONTAINER_NAME    Docker container name (default: polyglotio-mysql)

Examples:
  yarn backup                          # Use default settings
  BACKUP_DIR=/tmp/backups yarn backup  # Custom backup directory
  
The script will create a timestamped SQL file in the backup directory.
`);
  process.exit(0);
}

// Run the backup
main();
