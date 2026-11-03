-- Creaciones ya aplicadas: un reenvío desde la app sin conexión recibe la misma respuesta.
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "userId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "status" INTEGER,
  "body" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("userId", "key"),
  CONSTRAINT "idempotency_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "idempotency_keys_createdAt_idx" ON "idempotency_keys"("createdAt");
