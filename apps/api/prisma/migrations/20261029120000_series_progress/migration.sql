-- AlterTable
ALTER TABLE "recreation_entries" ADD COLUMN "season" INTEGER,
ADD COLUMN "episode" INTEGER,
ADD COLUMN "totalSeasons" INTEGER,
ADD COLUMN "totalEpisodes" INTEGER,
ADD COLUMN "episodesWatched" INTEGER NOT NULL DEFAULT 0;
