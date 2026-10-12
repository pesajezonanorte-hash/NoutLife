-- Private wardrobe item photos (compressed JPEG data encoded as base64).
ALTER TABLE "clothing_items"
  ADD COLUMN IF NOT EXISTS "photoData" TEXT;
