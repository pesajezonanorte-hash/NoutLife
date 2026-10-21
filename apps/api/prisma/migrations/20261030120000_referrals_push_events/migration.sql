-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "inviterDays" INTEGER NOT NULL DEFAULT 0,
    "inviteeDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referrals_inviteeId_key" ON "referrals"("inviteeId");

-- CreateIndex
CREATE INDEX "referrals_inviterId_activatedAt_idx" ON "referrals"("inviterId", "activatedAt");

-- CreateIndex
CREATE INDEX "referrals_inviteeId_activatedAt_idx" ON "referrals"("inviteeId", "activatedAt");

-- CreateIndex
CREATE INDEX "push_events_kind_category_createdAt_idx" ON "push_events"("kind", "category", "createdAt");

-- CreateIndex
CREATE INDEX "push_events_userId_createdAt_idx" ON "push_events"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_events" ADD CONSTRAINT "push_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
