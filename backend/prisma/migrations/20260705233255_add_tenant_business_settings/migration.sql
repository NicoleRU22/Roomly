-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "contractExpirationWarningDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "graceDays" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "landlordAddress" TEXT,
ADD COLUMN     "landlordRuc" TEXT,
ADD COLUMN     "lateFeePerDay" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
ADD COLUMN     "notifyComprobantePendiente" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyContratoFirmado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyTicketCreado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "whatsappTemplate" TEXT DEFAULT 'Hola {nombre}, te saludamos de Roomly. Te recordamos que tienes cobros pendientes en la plataforma. Por favor ingresa para regularizarlos.';
