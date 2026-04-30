#!/usr/bin/env tsx
/**
 * PostgreSQL Backup Script
 * Usage: tsx scripts/backup.ts [--retention=7]
 * Creates daily dumps with automatic rotation
 */
import { execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const DATABASE_URL = process.env.DATABASE_URL;
const RETENTION_DAYS = parseInt(process.argv.find(a => a.startsWith('--retention='))?.split('=')[1] || '7', 10);

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function getDbNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace('/', '');
  } catch {
    return 'saas_contabilistico';
  }
}

function cleanOldBackups(dir: string, retentionDays: number) {
  const now = Date.now();
  const maxAge = retentionDays * 24 * 60 * 60 * 1000;
  
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.sql.gz')) continue;
    const filePath = join(dir, file);
    const age = now - statSync(filePath).mtimeMs;
    if (age > maxAge) {
      console.log(`🗑️  Removing old backup: ${file}`);
      unlinkSync(filePath);
    }
  }
}

function main() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  ensureDir(BACKUP_DIR);

  const dbName = getDbNameFromUrl(DATABASE_URL);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${dbName}_${timestamp}.sql.gz`;
  const filepath = join(BACKUP_DIR, filename);

  console.log(`📦 Backing up database: ${dbName}`);
  console.log(`💾 Destination: ${filepath}`);

  try {
    // pg_dump with compression
    const cmd = `pg_dump "${DATABASE_URL}" --verbose --no-owner --no-acl --format=p | gzip > "${filepath}"`;
    execSync(cmd, { stdio: 'inherit', shell: 'powershell' });

    const stats = statSync(filepath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`✅ Backup complete: ${filename} (${sizeMB} MB)`);

    // Clean old backups
    console.log(`🧹 Cleaning backups older than ${RETENTION_DAYS} days...`);
    cleanOldBackups(BACKUP_DIR, RETENTION_DAYS);

    console.log('🎉 All done!');
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

main();
