-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Kolom workspaceId: nullable dulu, diisi dari data lama, lalu diwajibkan
ALTER TABLE "Conversation" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Workbook" ADD COLUMN "workspaceId" TEXT;

-- Setiap pengguna lama mendapat satu workspace pribadi (OWNER), lalu datanya dipindahkan ke sana
INSERT INTO "Workspace" ("id", "name", "slug", "updatedAt")
SELECT gen_random_uuid()::text,
       COALESCE(NULLIF(u."name", ''), split_part(u."email", '@', 1)) || ' (Pribadi)',
       'ws-' || substr(replace(u."id", '-', ''), 1, 16),
       CURRENT_TIMESTAMP
FROM "User" u;

INSERT INTO "Membership" ("id", "userId", "workspaceId", "role")
SELECT gen_random_uuid()::text, u."id", w."id", 'OWNER'
FROM "User" u
JOIN "Workspace" w ON w."slug" = 'ws-' || substr(replace(u."id", '-', ''), 1, 16);

UPDATE "Conversation" c SET "workspaceId" = m."workspaceId" FROM "Membership" m WHERE m."userId" = c."userId";
UPDATE "AgentRun" r SET "workspaceId" = m."workspaceId" FROM "Membership" m WHERE m."userId" = r."userId";
UPDATE "Workbook" b SET "workspaceId" = m."workspaceId" FROM "Membership" m WHERE m."userId" = b."userId";

ALTER TABLE "Conversation" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "AgentRun" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Workbook" ALTER COLUMN "workspaceId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
CREATE INDEX "Membership_workspaceId_idx" ON "Membership"("workspaceId");
CREATE UNIQUE INDEX "Membership_userId_workspaceId_key" ON "Membership"("userId", "workspaceId");
CREATE INDEX "Invite_email_idx" ON "Invite"("email");
CREATE UNIQUE INDEX "Invite_workspaceId_email_key" ON "Invite"("workspaceId", "email");
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");
CREATE INDEX "Conversation_workspaceId_userId_updatedAt_idx" ON "Conversation"("workspaceId", "userId", "updatedAt");
CREATE INDEX "AgentRun_workspaceId_createdAt_idx" ON "AgentRun"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Workbook" ADD CONSTRAINT "Workbook_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
