-- CreateTable
CREATE TABLE "AllowedFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'READ',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AllowedFolder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "tool" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    CONSTRAINT "Approval_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AllowedFolder_workspaceId_path_key" ON "AllowedFolder"("workspaceId", "path");

-- CreateIndex
CREATE INDEX "Approval_workspaceId_createdAt_idx" ON "Approval"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Approval_userId_status_idx" ON "Approval"("userId", "status");

