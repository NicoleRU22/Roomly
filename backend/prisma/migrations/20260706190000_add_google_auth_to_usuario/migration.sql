-- AlterTable
ALTER TABLE "Usuario" ALTER COLUMN "password" DROP NOT NULL;
ALTER TABLE "Usuario" ADD COLUMN "googleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_googleId_key" ON "Usuario"("googleId");
