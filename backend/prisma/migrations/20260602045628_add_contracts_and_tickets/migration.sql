-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "receiptImageUrl" TEXT,
ADD COLUMN     "receiptStatus" TEXT NOT NULL DEFAULT 'APROBADO',
ADD COLUMN     "rejectionReason" TEXT;

-- CreateTable
CREATE TABLE "Contrato" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "inquilinoId" INTEGER NOT NULL,
    "roomId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE_FIRMA',
    "signatureUrl" TEXT,
    "acceptedTerms" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceTicket" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "inquilinoId" INTEGER NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "roomId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIA',
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "comments" TEXT,
    "cost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contrato_inquilinoId_key" ON "Contrato"("inquilinoId");

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_inquilinoId_fkey" FOREIGN KEY ("inquilinoId") REFERENCES "Inquilino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_inquilinoId_fkey" FOREIGN KEY ("inquilinoId") REFERENCES "Inquilino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Habilitar Row Level Security (RLS) en Contrato
ALTER TABLE "Contrato" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contrato" FORCE ROW LEVEL SECURITY;

-- Crear política de aislamiento para Contrato
CREATE POLICY contrato_tenant_isolation ON "Contrato" FOR ALL
USING (
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
  OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::integer
);

-- Habilitar Row Level Security (RLS) en MaintenanceTicket
ALTER TABLE "MaintenanceTicket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaintenanceTicket" FORCE ROW LEVEL SECURITY;

-- Crear política de aislamiento para MaintenanceTicket
CREATE POLICY ticket_tenant_isolation ON "MaintenanceTicket" FOR ALL
USING (
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL
  OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::integer
);
