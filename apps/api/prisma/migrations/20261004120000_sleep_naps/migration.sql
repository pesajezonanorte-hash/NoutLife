-- Sleep: naps are logged alongside nights but excluded from night averages.
ALTER TABLE "sleep_logs" ADD COLUMN "isNap" BOOLEAN NOT NULL DEFAULT false;
