-- CreateTable
CREATE TABLE "store_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "legalName" TEXT NOT NULL DEFAULT '',
    "documentId" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "supportHours" TEXT NOT NULL DEFAULT '',
    "deliveryEstimate" TEXT NOT NULL DEFAULT '',
    "siteUrl" TEXT NOT NULL DEFAULT '',
    "paymentMethods" JSONB NOT NULL DEFAULT '[]',
    "wompiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "wompiMerchantName" TEXT NOT NULL DEFAULT '',
    "wompiFeeBps" INTEGER NOT NULL DEFAULT 0,
    "wompiFeeFixedCop" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_products" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "accessMode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "conditions" TEXT NOT NULL DEFAULT '',
    "coverage" TEXT,
    "deliveryEstimate" TEXT,
    "ageRating" TEXT,
    "priceCop" INTEGER NOT NULL,
    "compareAtCop" INTEGER,
    "availability" TEXT NOT NULL DEFAULT 'por_confirmar',
    "availabilityCheckedAt" TIMESTAMP(3),
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_provider_products" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "costCop" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_provider_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_orders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "priceCop" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerWhatsapp" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendiente_pago',
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "providerId" TEXT,
    "costCop" INTEGER,
    "providerRefunded" BOOLEAN NOT NULL DEFAULT false,
    "feeCop" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "wompiAttempts" INTEGER NOT NULL DEFAULT 0,
    "wompiStatus" TEXT,
    "wompiTransactionId" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_order_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "store_order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_files" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_products_slug_key" ON "store_products"("slug");

-- CreateIndex
CREATE INDEX "store_provider_products_productId_idx" ON "store_provider_products"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "store_provider_products_providerId_productId_key" ON "store_provider_products"("providerId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "store_orders_code_key" ON "store_orders"("code");

-- CreateIndex
CREATE INDEX "store_orders_customerWhatsapp_idx" ON "store_orders"("customerWhatsapp");

-- CreateIndex
CREATE INDEX "store_orders_status_idx" ON "store_orders"("status");

-- CreateIndex
CREATE INDEX "store_orders_createdAt_idx" ON "store_orders"("createdAt");

-- CreateIndex
CREATE INDEX "store_order_events_orderId_createdAt_idx" ON "store_order_events"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "store_files_orderId_idx" ON "store_files"("orderId");

-- AddForeignKey
ALTER TABLE "store_provider_products" ADD CONSTRAINT "store_provider_products_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "store_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_provider_products" ADD CONSTRAINT "store_provider_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "store_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "store_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "store_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_order_events" ADD CONSTRAINT "store_order_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "store_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_files" ADD CONSTRAINT "store_files_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "store_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Reglas que Prisma no expresa
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_single_row" CHECK ("id" = 1);
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_availability_check" CHECK ("availability" IN ('por_confirmar', 'disponible', 'agotado'));
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_price_check" CHECK ("priceCop" > 0 AND ("compareAtCop" IS NULL OR "compareAtCop" > "priceCop"));
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_status_check" CHECK ("status" IN ('pendiente_pago', 'pago_reportado', 'pago_verificado', 'pendiente_proveedor', 'en_proceso', 'entregado', 'cancelado', 'reembolsado'));
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_amounts_check" CHECK ("priceCop" > 0 AND ("costCop" IS NULL OR "costCop" >= 0) AND ("feeCop" IS NULL OR "feeCop" >= 0));

ALTER TABLE "store_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_provider_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_order_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_files" ENABLE ROW LEVEL SECURITY;
