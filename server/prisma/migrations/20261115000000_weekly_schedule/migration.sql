CREATE TABLE "weekly_schedules" (
    "userId" INTEGER NOT NULL,
    "weekdays" INTEGER[] NOT NULL,
    "sessionsPerWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "weekly_schedules_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "weekly_schedule_days_valid" CHECK (
      cardinality("weekdays") BETWEEN 1 AND 7
      AND "weekdays" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]
    ),
    CONSTRAINT "weekly_schedule_frequency_valid" CHECK ("sessionsPerWeek" BETWEEN 1 AND 7),
    CONSTRAINT "weekly_schedule_times_valid" CHECK (
      "startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND "endTime" > "startTime"
    )
);
ALTER TABLE "weekly_schedules" ADD CONSTRAINT "weekly_schedules_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
