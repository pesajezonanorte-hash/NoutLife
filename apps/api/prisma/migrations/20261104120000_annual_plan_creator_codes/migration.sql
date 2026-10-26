-- AlterTable
ALTER TABLE "users" ADD COLUMN     "billingInterval" TEXT NOT NULL DEFAULT 'month',
ADD COLUMN     "creatorCodeAt" TIMESTAMP(3),
ADD COLUMN     "creatorCodeId" TEXT;

-- AlterTable
ALTER TABLE "subscription_payments" ADD COLUMN     "billingInterval" TEXT NOT NULL DEFAULT 'month',
ADD COLUMN     "creatorCodeId" TEXT,
ADD COLUMN     "discountInCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "creator_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "sharePercent" INTEGER NOT NULL DEFAULT 30,
    "shareMonths" INTEGER DEFAULT 6,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_code_payments" (
    "id" TEXT NOT NULL,
    "creatorCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "amountInCents" INTEGER NOT NULL,
    "discountInCents" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_code_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "creator_codes_code_key" ON "creator_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "creator_code_payments_reference_key" ON "creator_code_payments"("reference");

-- CreateIndex
CREATE INDEX "creator_code_payments_creatorCodeId_paidAt_idx" ON "creator_code_payments"("creatorCodeId", "paidAt");

-- CreateIndex
CREATE INDEX "creator_code_payments_userId_idx" ON "creator_code_payments"("userId");

-- CreateIndex
CREATE INDEX "users_creatorCodeId_idx" ON "users"("creatorCodeId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_creatorCodeId_fkey" FOREIGN KEY ("creatorCodeId") REFERENCES "creator_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_creatorCodeId_fkey" FOREIGN KEY ("creatorCodeId") REFERENCES "creator_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_code_payments" ADD CONSTRAINT "creator_code_payments_creatorCodeId_fkey" FOREIGN KEY ("creatorCodeId") REFERENCES "creator_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

