-- AlterTable
ALTER TABLE "Inquilino" ADD COLUMN     "moveOutDate" TIMESTAMP(3),
ADD COLUMN     "moveOutReason" TEXT;

-- CreateTable
CREATE TABLE "InquilinoHistorial" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "inquilinoId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "fromPropertyId" INTEGER,
    "fromPropertyName" TEXT,
    "fromRoomId" INTEGER,
    "fromRoomNumber" TEXT,
    "toPropertyId" INTEGER,
    "toPropertyName" TEXT,
    "toRoomId" INTEGER,
    "toRoomNumber" TEXT,
    "reason" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InquilinoHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InquilinoHistorial_inquilinoId_idx" ON "InquilinoHistorial"("inquilinoId");

-- CreateIndex
CREATE INDEX "InquilinoHistorial_tenantId_idx" ON "InquilinoHistorial"("tenantId");

-- AddForeignKey
ALTER TABLE "InquilinoHistorial" ADD CONSTRAINT "InquilinoHistorial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquilinoHistorial" ADD CONSTRAINT "InquilinoHistorial_inquilinoId_fkey" FOREIGN KEY ("inquilinoId") REFERENCES "Inquilino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Habilitar Row Level Security (RLS) en InquilinoHistorial
ALTER TABLE "InquilinoHistorial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InquilinoHistorial" FORCE ROW LEVEL SECURITY;

-- Crear política de aislamiento para InquilinoHistorial
CREATE POLICY inquilino_historial_tenant_isolation ON "InquilinoHistorial" FOR ALL
USING (
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
  OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::integer
);
