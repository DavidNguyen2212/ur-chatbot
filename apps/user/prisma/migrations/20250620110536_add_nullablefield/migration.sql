/*
  Warnings:

  - A unique constraint covering the columns `[contactEmail]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "logo" DROP NOT NULL,
ALTER COLUMN "address" DROP NOT NULL,
ALTER COLUMN "settings" DROP NOT NULL,
ALTER COLUMN "billingEmail" DROP NOT NULL,
ALTER COLUMN "billingAddress" DROP NOT NULL,
ALTER COLUMN "knowledgeDatabaseUrl" DROP NOT NULL,
ALTER COLUMN "knowledgeDatabaseNamespace" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_contactEmail_key" ON "Organization"("contactEmail");
