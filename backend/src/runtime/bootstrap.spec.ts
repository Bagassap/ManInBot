import { describe, expect, it } from 'vitest';
import { splitSql } from './bootstrap.js';

describe('splitSql', () => {
  it('memecah pernyataan, membuang komentar dan baris kosong', () => {
    const sql = `-- CreateTable
CREATE TABLE "A" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "A_name_key" ON "A"("name");
`;
    const out = splitSql(sql);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/^CREATE TABLE "A"/);
    expect(out[0]).toContain('"name" TEXT\n)');
    expect(out[1]).toBe('CREATE UNIQUE INDEX "A_name_key" ON "A"("name")');
  });
  it('migrasi Prisma "RedefineTables" tetap terbaca sebagai beberapa pernyataan', () => {
    const sql = `-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_A" ("id" TEXT NOT NULL PRIMARY KEY);
INSERT INTO "new_A" ("id") SELECT "id" FROM "A";
DROP TABLE "A";
ALTER TABLE "new_A" RENAME TO "A";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
`;
    expect(splitSql(sql)).toHaveLength(8);
  });
});
