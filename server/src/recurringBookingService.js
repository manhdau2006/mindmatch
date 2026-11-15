import { prisma } from "./db.js";
import {
  bookingInclude,
  check,
  expireHolds,
  integer,
  lockParticipants,
} from "./bookingService.js";
import { validateWeeklySchedule } from "./weeklySchedule.js";
import {
  calendarDate,
  firstOccurrence,
  recurringOverlap,
  recurringOverlapsSlot,
  vietnamDate,
} from "./recurrence.js";

export function requestHoldHours() {
  const hours = Number(process.env.REQUEST_HOLD_HOURS || 24);
  check(
    Number.isFinite(hours) && hours > 0 && hours <= 168,
    "REQUEST_HOLD_HOURS phải từ trên 0 đến 168 giờ",
    500,
  );
  return hours;
}

export async function paymentConfig(db = prisma) {
  return db.paymentConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

function recurrenceInput(body, now) {
  const schedule = validateWeeklySchedule({
    ...body,
    sessionsPerWeek: body.weekdays?.length,
  });
  const recurrenceStart = calendarDate(body.startDate);
  check(
    body.endDate === undefined ||
      body.endDate === null ||
      typeof body.endDate === "string",
    "Ngày kết thúc không hợp lệ",
    400,
  );
  const recurrenceEnd = body.endDate ? calendarDate(body.endDate) : null;
  check(
    recurrenceStart && body.startDate >= vietnamDate(now),
    "Ngày bắt đầu phải là ngày hợp lệ từ hôm nay",
    400,
  );
  check(
    !body.endDate || (recurrenceEnd && recurrenceEnd >= recurrenceStart),
    "Ngày kết thúc phải từ ngày bắt đầu",
    400,
  );
  const rule = {
    recurrenceWeekdays: schedule.weekdays,
    recurrenceStart,
    recurrenceEnd,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    timeZone: "Asia/Ho_Chi_Minh",
  };
  const first = firstOccurrence(rule);
  check(
    first && first > now,
    "Buổi học đầu tiên phải ở tương lai và trong khoảng ngày đã chọn",
    400,
  );
  return { rule, first };
}

async function validMatch(db, matchId, studentId) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: { student: true, tutor: { include: { weeklySchedule: true } } },
  });
  check(
    match?.active &&
      match.studentId === studentId &&
      match.student.role === "student" &&
      match.tutor.role === "tutor" &&
      !match.student.isBanned &&
      !match.tutor.isBanned,
    "Hai bên cần Match hợp lệ để nhận lớp",
    403,
  );
  return match;
}

function withinAvailability(rule, tutor) {
  const available = tutor.weeklySchedule;
  check(
    available &&
      rule.recurrenceWeekdays.every((day) =>
        available.weekdays.includes(day),
      ) &&
      rule.startTime >= available.startTime &&
      rule.endTime <= available.endTime,
    "Lịch chọn phải thuộc lịch rảnh hằng tuần của đúng gia sư",
    409,
  );
}

async function checkConflicts(db, rule, match, excludeId) {
  const now = new Date();
  const existing = await db.booking.findMany({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      match: {
        OR: [{ tutorId: match.tutorId }, { studentId: match.studentId }],
      },
      OR: [
        { kind: "recurring_class", status: "confirmed" },
        {
          kind: "recurring_class",
          status: "pending_tutor",
          expiresAt: { gt: now },
        },
        { kind: "single_session", status: { in: ["confirmed", "completed"] } },
        { kind: "single_session", status: "held", expiresAt: { gt: now } },
      ],
    },
    include: { slot: true },
  });
  check(
    !existing.some((booking) =>
      booking.kind === "recurring_class"
        ? recurringOverlap(rule, booking)
        : booking.slot && recurringOverlapsSlot(rule, booking.slot),
    ),
    "Lịch định kỳ trùng với lịch đang được giữ hoặc đã xác nhận của gia sư/học viên",
    409,
  );
}

export async function createRecurringRequest(studentId, body) {
  integer(body.matchId);
  const initial = await prisma.match.findUnique({
    where: { id: body.matchId },
  });
  check(
    initial && initial.studentId === studentId,
    "Match không thuộc học viên này",
    403,
  );
  return prisma.$transaction(async (db) => {
    await lockParticipants(db, [studentId, initial.tutorId]);
    const match = await validMatch(db, initial.id, studentId);
    check(
      match.tutorId === initial.tutorId,
      "Match đã thay đổi, vui lòng gửi lại yêu cầu",
    );
    const now = new Date();
    const { rule, first } = recurrenceInput(body, now);
    withinAvailability(rule, match.tutor);
    await checkConflicts(db, rule, match);
    const config = await paymentConfig(db);
    const amount = integer(config.acceptanceFeeVnd, 1000);
    const expiresAt = new Date(
      Math.min(now.getTime() + requestHoldHours() * 3600000, first.getTime()),
    );
    return db.booking.create({
      data: {
        matchId: match.id,
        kind: "recurring_class",
        status: "pending_tutor",
        expiresAt,
        ...rule,
        transaction: {
          create: {
            amount,
            purpose: "class_acceptance",
            payerId: match.tutorId,
            currency: "vnd",
            provider: "local",
            commissionBps: 10000,
            commission: amount,
            tutorIncome: 0,
          },
        },
      },
      include: bookingInclude,
    });
  });
}

async function lockedRequest(db, tutorId, bookingId) {
  const initial = await db.booking.findUnique({
    where: { id: bookingId },
    include: { match: true },
  });
  check(initial, "Không tìm thấy yêu cầu", 404);
  check(
    initial.kind === "recurring_class" && initial.match.tutorId === tutorId,
    "Chỉ gia sư nhận yêu cầu mới được xử lý",
    403,
  );
  await lockParticipants(db, [initial.match.studentId, tutorId]);
  await db.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingId} FOR UPDATE`;
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: bookingInclude,
  });
  check(
    booking.match.tutorId === tutorId &&
      booking.match.studentId === initial.match.studentId,
    "Match đã thay đổi trong khi xử lý, vui lòng tải lại yêu cầu",
    409,
  );
  return booking;
}

export async function rejectRecurringRequest(tutorId, bookingId, body) {
  check(
    body.reason === undefined ||
      (typeof body.reason === "string" && body.reason.trim().length <= 500),
    "Lý do từ chối tối đa 500 ký tự",
    400,
  );
  await expireHolds();
  return prisma.$transaction(async (db) => {
    const booking = await lockedRequest(db, tutorId, bookingId);
    if (booking.status === "rejected") return booking;
    check(
      booking.status === "pending_tutor" && booking.expiresAt > new Date(),
      "Yêu cầu đã được xử lý hoặc hết hạn",
    );
    await db.transaction.update({
      where: { bookingId },
      data: { status: "cancelled" },
    });
    return db.booking.update({
      where: { id: bookingId },
      data: {
        status: "rejected",
        rejectionReason: body.reason?.trim() || null,
      },
      include: bookingInclude,
    });
  });
}

export async function payAcceptanceFee(tutorId, bookingId, body) {
  check(
    ["success", "failure"].includes(body.outcome),
    "Chọn kết quả thanh toán giả lập",
    400,
  );
  check(
    typeof body.attemptId === "string" &&
      /^[A-Za-z0-9_-]{16,100}$/.test(body.attemptId),
    "Cần attemptId 16–100 ký tự cho mỗi lần thanh toán",
    400,
  );
  await expireHolds();
  return prisma.$transaction(async (db) => {
    const booking = await lockedRequest(db, tutorId, bookingId);
    const transaction = booking.transaction;
    check(
      transaction?.purpose === "class_acceptance" &&
        transaction.payerId === tutorId,
      "Người đóng phí phải là gia sư nhận yêu cầu",
      403,
    );
    const eventId = `acceptance:${transaction.id}:${body.attemptId}`;
    const outcome = body.outcome === "success" ? "paid" : "failed";
    const previous = await db.paymentEvent.findUnique({
      where: { id: eventId },
    });
    if (previous) {
      check(
        previous.outcome === outcome,
        "Một attemptId chỉ được dùng cho cùng một kết quả thanh toán",
      );
      return booking;
    }
    if (transaction.status === "succeeded") return booking;
    check(
      booking.status === "pending_tutor" && booking.expiresAt > new Date(),
      "Yêu cầu đã được xử lý hoặc hết hạn",
    );
    const match = await validMatch(
      db,
      booking.matchId,
      booking.match.studentId,
    );
    withinAvailability(booking, match.tutor);
    await checkConflicts(db, booking, match, booking.id);
    // Recheck the deadline immediately before committing the simulated charge.
    check(booking.expiresAt > new Date(), "Yêu cầu đã hết hạn");
    await db.paymentEvent.create({
      data: { id: eventId, transactionId: transaction.id, outcome },
    });
    await db.transaction.update({
      where: { id: transaction.id },
      data: { status: outcome === "paid" ? "succeeded" : "failed" },
    });
    return db.booking.update({
      where: { id: booking.id },
      data:
        outcome === "paid"
          ? { status: "confirmed", confirmedAt: new Date() }
          : { status: "pending_tutor" },
      include: bookingInclude,
    });
  });
}
