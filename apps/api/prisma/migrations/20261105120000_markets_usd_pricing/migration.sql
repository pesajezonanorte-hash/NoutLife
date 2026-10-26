-- AlterTable
ALTER TABLE "users" ADD COLUMN     "market" TEXT NOT NULL DEFAULT 'CO';

-- AlterTable
ALTER TABLE "subscription_payments" ADD COLUMN     "priceAmountInCents" INTEGER,
ADD COLUMN     "priceCurrency" TEXT;
