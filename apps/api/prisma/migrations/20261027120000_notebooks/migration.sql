-- Libreta: cuadernos con páginas (texto, dibujo, notas adhesivas) e imágenes pegadas.

-- CreateTable
CREATE TABLE "notebooks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'personal',
    "color" TEXT NOT NULL DEFAULT 'jade',
    "paper" TEXT NOT NULL DEFAULT 'ruled',
    "pageCount" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notebooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notebook_pages" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notebook_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notebook_images" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notebook_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notebooks_userId_updatedAt_idx" ON "notebooks"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "notebook_pages_notebookId_index_key" ON "notebook_pages"("notebookId", "index");

-- CreateIndex
CREATE INDEX "notebook_images_notebookId_idx" ON "notebook_images"("notebookId");

-- AddForeignKey
ALTER TABLE "notebooks" ADD CONSTRAINT "notebooks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notebook_pages" ADD CONSTRAINT "notebook_pages_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "notebooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notebook_images" ADD CONSTRAINT "notebook_images_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "notebooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
