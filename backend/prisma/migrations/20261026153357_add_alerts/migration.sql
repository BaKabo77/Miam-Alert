-- CreateTable
CREATE TABLE "Alert" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "expiredCount" INTEGER NOT NULL,
    "urgentCount" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Alert_householdId_date_key" ON "Alert"("householdId", "date");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
