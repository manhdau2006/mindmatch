CREATE TYPE "BookingKind" AS ENUM ('single_session', 'recurring_class');
CREATE TYPE "PaymentPurpose" AS ENUM ('lesson_deposit', 'class_acceptance');
ALTER TYPE "BookingStatus" ADD VALUE 'pending_tutor';
ALTER TYPE "BookingStatus" ADD VALUE 'rejected';
ALTER TYPE "PaymentStatus" ADD VALUE 'cancelled';

ALTER TABLE "bookings"
  ALTER COLUMN "slotId" DROP NOT NULL,
  ADD COLUMN "kind" "BookingKind" NOT NULL DEFAULT 'single_session',
  ADD COLUMN "recurrenceWeekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "recurrenceStart" DATE,
  ADD COLUMN "recurrenceEnd" DATE,
  ADD COLUMN "startTime" TEXT,
  ADD COLUMN "endTime" TEXT,
  ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "confirmedAt" TIMESTAMP(3);

ALTER TABLE "transactions"
  ADD COLUMN "purpose" "PaymentPurpose" NOT NULL DEFAULT 'lesson_deposit',
  ADD COLUMN "payerId" INTEGER;
UPDATE "transactions" AS t SET "payerId" = m."studentId"
FROM "bookings" b JOIN "matches" m ON m.id = b."matchId"
WHERE t."bookingId" = b.id;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payerId_fkey"
FOREIGN KEY ("payerId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "transactions_payerId_idx" ON "transactions" ("payerId");
ALTER TABLE "payment_config" ADD COLUMN "acceptanceFeeVnd" INTEGER NOT NULL DEFAULT 100000;
ALTER TABLE "payment_config" ADD CONSTRAINT "acceptance_fee_valid" CHECK ("acceptanceFeeVnd" BETWEEN 1000 AND 100000000);
ALTER TABLE "bookings" ADD CONSTRAINT "booking_recurrence_valid" CHECK (
  ("kind" = 'single_session' AND "slotId" IS NOT NULL)
  OR ("kind" = 'recurring_class' AND "slotId" IS NULL
    AND "recurrenceStart" IS NOT NULL
    AND ("recurrenceEnd" IS NULL OR "recurrenceEnd" >= "recurrenceStart")
    AND cardinality("recurrenceWeekdays") BETWEEN 1 AND 7
    AND "recurrenceWeekdays" <@ ARRAY[1,2,3,4,5,6,7]
    AND "startTime" IS NOT NULL AND "endTime" IS NOT NULL
    AND "startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "endTime" > "startTime"
    AND "timeZone" = 'Asia/Ho_Chi_Minh')
);
ALTER TABLE "transactions" ADD CONSTRAINT "acceptance_transaction_valid" CHECK (
  "purpose" <> 'class_acceptance' OR
  ("payerId" IS NOT NULL AND "provider" = 'local' AND "tutorIncome" = 0
    AND "commission" = "amount" AND "commissionBps" = 10000)
);
