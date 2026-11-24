import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '../generated/prisma/client.js';

export const dataDir = (): string | null => process.env.MIB_DATA_DIR || null;

export function writePrivate(file: string, content: string) {
  writeFileSync(file, content, { encoding: 'utf8', mode: 0o600 });
  try {
    chmodSync(file, 0o600);
  } catch {
  }
}

function ensureJwtSecret(dir: string) {
  if (process.env.JWT_SECRET) return;
  const file = path.join(dir, 'secrets.json');
  let secrets: { jwtSecret?: string } = {};
  try {
    secrets = JSON.parse(readFileSync(file, 'utf8')) as typeof secrets;
  } catch {
  }
  if (!secrets.jwtSecret) {
    secrets.jwtSecret = randomBytes(48).toString('base64');
    writePrivate(file, JSON.stringify(secrets));
  }
  process.env.JWT_SECRET = secrets.jwtSecret;
}

export function splitSql(sql: string): string[] {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function applyMigrations(migrationsDir: string, log: (m: string) => void = () => undefined) {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "_mib_migrations" ("name" TEXT NOT NULL PRIMARY KEY, "appliedAt" TEXT NOT NULL)');
    const done = new Set((await prisma.$queryRawUnsafe<{ name: string }[]>('SELECT "name" FROM "_mib_migrations"')).map((r) => r.name));
    const legacy = await prisma
      .$queryRawUnsafe<{ migration_name: string }[]>('SELECT "migration_name" FROM "_prisma_migrations"')
      .catch(() => [] as { migration_name: string }[]);
    for (const r of legacy) {
      if (!done.has(r.migration_name)) {
        await prisma.$executeRawUnsafe('INSERT INTO "_mib_migrations" ("name","appliedAt") VALUES (?, ?)', r.migration_name, new Date().toISOString());
        done.add(r.migration_name);
      }
    }
    const names = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(path.join(migrationsDir, d.name, 'migration.sql')))
      .map((d) => d.name)
      .sort();
    for (const name of names) {
      if (done.has(name)) continue;
      const statements = splitSql(readFileSync(path.join(migrationsDir, name, 'migration.sql'), 'utf8'));
      await prisma.$transaction(async (tx) => {
        for (const s of statements) await tx.$executeRawUnsafe(s);
        await tx.$executeRawUnsafe('INSERT INTO "_mib_migrations" ("name","appliedAt") VALUES (?, ?)', name, new Date().toISOString());
      });
      log(`migrasi diterapkan: ${name}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

export async function prepareRuntime(log: (m: string) => void = () => undefined) {
  const dir = dataDir();
  if (dir) {
    mkdirSync(dir, { recursive: true });
    ensureJwtSecret(dir);
    process.env.DATABASE_URL ||= `file:${path.join(dir, 'mib.db').replace(/\\/g, '/')}`;
  }
  if (process.env.MIB_AUTO_MIGRATE === '1') {
    const migrations = process.env.MIB_MIGRATIONS_DIR || path.resolve(import.meta.dirname, '../../prisma/migrations');
    await applyMigrations(migrations, log);
  }
}
