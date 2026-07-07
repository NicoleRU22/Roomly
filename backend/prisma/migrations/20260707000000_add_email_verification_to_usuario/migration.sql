-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Usuario" ADD COLUMN "verificationToken" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "verificationTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_verificationToken_key" ON "Usuario"("verificationToken");
