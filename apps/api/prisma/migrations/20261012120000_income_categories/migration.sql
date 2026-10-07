-- Income gets its own categories, separate from expenses.
ALTER TYPE "TransactionCategory" ADD VALUE IF NOT EXISTS 'SALARY';
ALTER TYPE "TransactionCategory" ADD VALUE IF NOT EXISTS 'FREELANCE';
ALTER TYPE "TransactionCategory" ADD VALUE IF NOT EXISTS 'BUSINESS';
ALTER TYPE "TransactionCategory" ADD VALUE IF NOT EXISTS 'SALES';
ALTER TYPE "TransactionCategory" ADD VALUE IF NOT EXISTS 'GIFT';
ALTER TYPE "TransactionCategory" ADD VALUE IF NOT EXISTS 'RENTAL';
