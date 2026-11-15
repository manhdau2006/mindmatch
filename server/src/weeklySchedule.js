import { prisma } from "./db.js";
import { check, integer } from "./bookingService.js";

const minuteMs = 60000;
const vietnamOffsetMs = 7 * 60 * minuteMs;
const timePattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function validateWeeklySchedule(body) {
  const { weekdays, sessionsPerWeek, startTime, endTime } = body;
  check(
    Array.isArray(weekdays) &&
      weekdays.length >= 1 &&
      weekdays.length <= 7 &&
      weekdays.every((day) => Number.isInteger(day) && day >= 1 && day <= 7) &&
      new Set(weekdays).size === weekdays.length,
    "Chọn ít nhất một thứ trong tuần, mỗi thứ chỉ chọn một lần",
    400,
  );
  integer(sessionsPerWeek, 1, 7);
  check(
    typeof startTime === "string" &&
      typeof endTime === "string" &&
      timePattern.test(startTime) &&
      timePattern.test(endTime),
    "Giờ phải có dạng HH:mm",
    400,
  );
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const duration = (endHour - startHour) * 60 + endMinute - startMinute;
  check(
    duration > 0 && duration <= 480,
    "Giờ kết thúc phải sau giờ bắt đầu, tối đa 8 giờ mỗi buổi",
    400,
  );
  return {
    weekdays: [...weekdays].sort((a, b) => a - b),
    sessionsPerWeek,
    startTime,
    endTime,
  };
}

export function weeklyOccurrences(schedule, now = new Date()) {
  const localToday = new Date(now.getTime() + vietnamOffsetMs);
  const [startHour, startMinute] = schedule.startTime.split(":").map(Number);
  const [endHour, endMinute] = schedule.endTime.split(":").map(Number);
  const slots = [];
  for (let offset = 0; offset < 28; offset++) {
    const date = new Date(
      Date.UTC(
        localToday.getUTCFullYear(),
        localToday.getUTCMonth(),
        localToday.getUTCDate() + offset,
      ),
    );
    const weekday = date.getUTCDay() || 7;
    if (!schedule.weekdays.includes(weekday)) continue;
    const startsAt = new Date(
      date.getTime() +
        (startHour * 60 + startMinute) * minuteMs -
        vietnamOffsetMs,
    );
    const endsAt = new Date(
      date.getTime() + (endHour * 60 + endMinute) * minuteMs - vietnamOffsetMs,
    );
    if (startsAt > now) slots.push({ startsAt, endsAt });
  }
  return slots;
}

export async function publishWeeklySlots(tutorId, price) {
  integer(price, 50000, 10000000);
  return prisma.$transaction(async (db) => {
    // Serialize publishing with the existing single-slot and seed APIs.
    await db.$queryRaw`SELECT id FROM users WHERE id = ${tutorId} FOR UPDATE`;
    const schedule = await db.weeklySchedule.findUnique({
      where: { userId: tutorId },
    });
    check(schedule, "Lưu lịch tuần trước khi mở khung giờ nhận đặt");
    const candidates = weeklyOccurrences(schedule);
    const existing = await db.tutorSlot.findMany({
      where: {
        tutorId,
        startsAt: { lt: candidates.at(-1).endsAt },
        endsAt: { gt: candidates[0].startsAt },
      },
    });
    const available = candidates.filter(
      (candidate) =>
        !existing.some(
          (slot) =>
            slot.startsAt < candidate.endsAt &&
            slot.endsAt > candidate.startsAt,
        ),
    );
    const result = await db.tutorSlot.createMany({
      data: available.map((slot) => ({ ...slot, tutorId, price })),
      skipDuplicates: true,
    });
    return {
      createdCount: result.count,
      skippedCount: candidates.length - result.count,
    };
  });
}
