import { prisma } from "./db.js";

export function check(condition, message, status = 409) {
  if (!condition) throw Object.assign(new Error(message), { status });
}

export function integer(value, min = 1, max = 100000000) {
  check(
    Number.isSafeInteger(value) && value >= min && value <= max,
    "Giá trị số không hợp lệ",
    400,
  );
  return value;
}

export const userSummary = {
  select: { id: true, name: true, role: true, weeklySchedule: true },
};
export const bookingInclude = {
  match: { include: { student: userSummary, tutor: userSummary } },
  slot: true,
  transaction: {
    include: {
      payer: { select: { id: true, name: true, role: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  },
};
export const demoEnabled = () =>
  process.env.PAYMENT_MODE === "local" &&
  process.env.AUTH_MODE === "dev" &&
  process.env.NODE_ENV !== "production";

export async function expireHolds() {
  return prisma.$transaction(async (db) => {
    const result = await db.booking.updateMany({
      where: {
        status: { in: ["held", "pending_tutor"] },
        expiresAt: { lte: new Date() },
      },
      data: { status: "expired" },
    });
    await db.transaction.updateMany({
      where: {
        purpose: "class_acceptance",
        status: { in: ["pending", "failed"] },
        booking: { status: "expired" },
      },
      data: { status: "cancelled" },
    });
    return result;
  });
}

export async function lockParticipants(db, ids) {
  for (const id of [...new Set(ids)].sort((a, b) => a - b)) {
    await db.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
  }
}

export async function lockSlot(db, slotId) {
  await db.$queryRaw`SELECT id FROM tutor_slots WHERE id = ${slotId} FOR UPDATE`;
}

export async function settlePayment({
  eventId,
  transactionId,
  success,
  amount,
  currency,
  sessionId,
  provider,
}) {
  return prisma.$transaction(async (db) => {
    const initial = await db.transaction.findUnique({
      where: { id: transactionId },
      include: { booking: true },
    });
    check(initial, "Không tìm thấy giao dịch", 404);
    check(
      initial.purpose === "lesson_deposit",
      "Thông báo cổng thanh toán chỉ áp dụng cho giao dịch lịch sử",
      400,
    );
    const match = await db.match.findUnique({
      where: { id: initial.booking.matchId },
    });
    await lockParticipants(db, [match.studentId, match.tutorId]);
    await lockSlot(db, initial.booking.slotId);
    const payment = await db.transaction.findUnique({
      where: { id: transactionId },
      include: { booking: true },
    });
    check(
      payment.provider === provider &&
        payment.amount === amount &&
        payment.currency === currency,
      "Thông báo không khớp giao dịch",
      400,
    );
    if (provider === "stripe")
      check(payment.sessionId === sessionId, "Session không khớp", 400);
    const existing = await db.paymentEvent.findUnique({
      where: { id: eventId },
    });
    if (existing) return payment;
    await db.paymentEvent.create({
      data: {
        id: eventId,
        transactionId,
        outcome: success ? "paid" : "failed",
      },
    });
    if (["succeeded", "refund_required", "refunded"].includes(payment.status))
      return payment;
    const booking = payment.booking;
    const valid = booking.status === "held" && booking.expiresAt > new Date();
    if (success) {
      await db.transaction.update({
        where: { id: transactionId },
        data: { status: valid ? "succeeded" : "refund_required" },
      });
      if (valid)
        await db.booking.update({
          where: { id: booking.id },
          data: { status: "confirmed" },
        });
      else if (booking.status === "held")
        await db.booking.update({
          where: { id: booking.id },
          data: { status: "expired" },
        });
    } else {
      await db.transaction.update({
        where: { id: transactionId },
        data: { status: "failed" },
      });
      if (booking.status === "held")
        await db.booking.update({
          where: { id: booking.id },
          data: { status: valid ? "cancelled" : "expired" },
        });
    }
    return db.transaction.findUnique({ where: { id: transactionId } });
  });
}

export async function wallet(db, tutorId) {
  const earned = await db.transaction.aggregate({
    where: {
      status: "succeeded",
      booking: { status: "completed", match: { tutorId } },
    },
    _sum: { tutorIncome: true },
  });
  const pending = await db.transaction.aggregate({
    where: {
      status: "succeeded",
      booking: { status: "confirmed", match: { tutorId } },
    },
    _sum: { tutorIncome: true },
  });
  const withdrawals = await db.withdrawal.findMany({
    where: { tutorId },
    orderBy: { createdAt: "desc" },
  });
  const reserved = withdrawals
    .filter((w) => ["requested", "approved", "paid"].includes(w.status))
    .reduce((sum, w) => sum + w.amount, 0);
  return {
    earned: earned._sum.tutorIncome || 0,
    pending: pending._sum.tutorIncome || 0,
    available: (earned._sum.tutorIncome || 0) - reserved,
    withdrawals,
  };
}
