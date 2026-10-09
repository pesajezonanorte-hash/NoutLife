-- Nueva categoría de gasto «Ropa para mí»: compras de ropa para el usuario,
-- con atajo hacia el Espejo para registrar la prenda recién comprada.
ALTER TYPE "TransactionCategory" ADD VALUE IF NOT EXISTS 'CLOTHING_FOR_ME';
