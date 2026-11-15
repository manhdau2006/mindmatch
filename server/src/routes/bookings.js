import { Router } from "express";
import { requireAuth } from "../auth.js";
import { prisma } from "../db.js";
import {
  bookingInclude,
  check,
  demoEnabled,
  expireHolds,
  integer,
  lockSlot,
  lockParticipants,
  userSummary,
  wallet,
} from "../bookingService.js";
import { userRoom } from "../views.js";
import {
  createRecurringRequest,
  payAcceptanceFee,
  rejectRecurringRequest,
  paymentConfig,
  requestHoldHours,
} from "../recurringBookingService.js";
import {
  publishWeeklySlots,
  validateWeeklySchedule,
} from "../weeklySchedule.js";

const role = (req, expected) =>
  check(req.user.role === expected, "Không đủ quyền", 403);
const owns = (req, booking) => {
  check(booking, "Không tìm thấy booking", 404);
  check(
    req.user.role === "admin" ||
      [booking.match.studentId, booking.match.tutorId].includes(req.userId),
    "Không đủ quyền",
    403,
  );
};

export function bookingRoutes(io) {
  function notify(booking) {
    io?.to([
      userRoom(booking.match.studentId),
      userRoom(booking.match.tutorId),
    ]).emit("booking_updated", {
      bookingId: booking.id,
      status: booking.status,
    });
    return booking;
  }
  const router = Router();
  router.use(requireAuth);
  router.use((req, res, next) => {
    req.body ??= {};
    check(
      typeof req.body === "object" && !Array.isArray(req.body),
      "Body phải là object JSON",
      400,
    );
    next();
  });
  router.get("/me", async (req, res) => {
    const weeklySchedule = await prisma.weeklySchedule.findUnique({
      where: { userId: req.userId },
    });
    res.json({ user: { ...req.user, weeklySchedule }, demo: demoEnabled() });
  });
  router.get("/schedule", async (req, res) => {
    check(["student", "tutor"].includes(req.user.role), "Không đủ quyền", 403);
    res.json(
      await prisma.weeklySchedule.findUnique({ where: { userId: req.userId } }),
    );
  });
  router.put("/schedule", async (req, res) => {
    check(["student", "tutor"].includes(req.user.role), "Không đủ quyền", 403);
    const data = validateWeeklySchedule(req.body);
    res.json(
      await prisma.$transaction(async (db) => {
        await lockParticipants(db, [req.userId]);
        return db.weeklySchedule.upsert({
          where: { userId: req.userId },
          update: data,
          create: { ...data, userId: req.userId },
        });
      }),
    );
  });
  router.post("/slots/weekly", async (req, res) => {
    role(req, "tutor");
    res.status(201).json(await publishWeeklySlots(req.userId, req.body.price));
  });
  router.get("/matches", async (req, res) => {
    check(["student", "tutor"].includes(req.user.role), "Không đủ quyền", 403);
    const participant =
      req.user.role === "student"
        ? { studentId: req.userId }
        : { tutorId: req.userId };
    res.json(
      await prisma.match.findMany({
        where: { ...participant, active: true },
        include: { tutor: userSummary, student: userSummary },
      }),
    );
  });
  router.get("/slots", async (req, res) => {
    const tutorId = integer(Number(req.query.tutorId));
    await expireHolds();
    res.json(
      await prisma.tutorSlot.findMany({
        where: { tutorId, startsAt: { gt: new Date() } },
        include: {
          bookings: {
            where: { status: { in: ["held", "confirmed", "completed"] } },
            select: { id: true },
          },
        },
        orderBy: { startsAt: "asc" },
      }),
    );
  });
  router.post("/slots", async (req, res) => {
    role(req, "tutor");
    const startsAt = new Date(req.body.startsAt);
    const endsAt = new Date(req.body.endsAt);
    const price = integer(req.body.price, 50000, 10000000);
    check(
      startsAt > new Date() &&
        endsAt > startsAt &&
        endsAt - startsAt <= 8 * 3600000,
      "Giờ bắt đầu/kết thúc không hợp lệ",
      400,
    );
    res.status(201).json(
      await prisma.$transaction(async (db) => {
        await db.$queryRaw`SELECT id FROM users WHERE id = ${req.userId} FOR UPDATE`;
        check(
          !(await db.tutorSlot.findFirst({
            where: {
              tutorId: req.userId,
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          })),
          "Khung giờ bị trùng",
        );
        return db.tutorSlot.create({
          data: { tutorId: req.userId, startsAt, endsAt, price },
        });
      }),
    );
  });
  router.get("/", async (req, res) => {
    await expireHolds();
    const where =
      req.user.role === "admin"
        ? {}
        : {
            match: { OR: [{ studentId: req.userId }, { tutorId: req.userId }] },
          };
    res.json(
      await prisma.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: { createdAt: "desc" },
      }),
    );
  });
  router.get("/config", async (req, res) => {
    const config = await paymentConfig();
    res.json({
      acceptanceFeeVnd: config.acceptanceFeeVnd,
      requestHoldHours: requestHoldHours(),
      paymentMode: "local",
      payerRole: "tutor",
    });
  });
  router.post("/requests", async (req, res) => {
    role(req, "student");
    res
      .status(201)
      .json(notify(await createRecurringRequest(req.userId, req.body)));
  });
  router.post("/:id/reject", async (req, res) => {
    role(req, "tutor");
    res.json(
      notify(await rejectRecurringRequest(req.userId, req.params.id, req.body)),
    );
  });
  router.post("/:id/pay-acceptance", async (req, res) => {
    role(req, "tutor");
    res.json(
      notify(await payAcceptanceFee(req.userId, req.params.id, req.body)),
    );
  });
  router.post(["/hold", "/:id/checkout", "/:id/demo-payment"], (req, res) => {
    res
      .status(410)
      .json({
        error:
          "Gửi yêu cầu lớp định kỳ. Gia sư đóng phí nhận lớp một lần qua pay-acceptance.",
      });
  });
  router.post("/:id/cancel", async (req, res) => {
    res.json(
      await prisma.$transaction(async (db) => {
        const initial = await db.booking.findUnique({
          where: { id: req.params.id },
          include: bookingInclude,
        });
        owns(req, initial);
        check(
          initial.kind === "single_session",
          "Yêu cầu lớp định kỳ được xử lý bởi gia sư nhận yêu cầu",
        );
        await lockParticipants(db, [
          initial.match.studentId,
          initial.match.tutorId,
        ]);
        await lockSlot(db, initial.slotId);
        const booking = await db.booking.findUnique({
          where: { id: initial.id },
          include: bookingInclude,
        });
        check(
          ["held", "confirmed"].includes(booking.status),
          "Trạng thái không cho phép hủy",
        );
        check(booking.slot.startsAt > new Date(), "Chỉ được hủy trước giờ học");
        if (booking.transaction.status === "succeeded")
          await db.transaction.update({
            where: { bookingId: booking.id },
            data: { status: "refund_required" },
          });
        return db.booking.update({
          where: { id: booking.id },
          data: { status: "cancelled" },
        });
      }),
    );
  });
  router.post("/:id/complete", async (req, res) => {
    role(req, "admin");
    res.json(
      await prisma.$transaction(async (db) => {
        const booking = await db.booking.findUnique({
          where: { id: req.params.id },
          include: bookingInclude,
        });
        check(booking, "Không tìm thấy booking", 404);
        check(
          booking.kind === "single_session",
          "Luồng hoàn tất một buổi chỉ áp dụng cho lịch sử buổi lẻ",
        );
        await lockParticipants(db, [
          booking.match.studentId,
          booking.match.tutorId,
        ]);
        await lockSlot(db, booking.slotId);
        check(
          booking.slot.endsAt <= new Date() || demoEnabled(),
          "Buổi học chưa kết thúc",
        );
        const result = await db.booking.updateMany({
          where: { id: booking.id, status: "confirmed" },
          data: { status: "completed" },
        });
        check(result.count === 1, "Booking chưa xác nhận hoặc đã hoàn tất");
        return { completed: true };
      }),
    );
  });
  router.get("/finance/wallet", async (req, res) => {
    role(req, "tutor");
    res.json(await wallet(prisma, req.userId));
  });
  router.post("/finance/withdrawals", async (req, res) => {
    role(req, "tutor");
    const amount = integer(req.body.amount, 1000);
    const destination = String(req.body.destination || "").trim();
    check(
      destination.length >= 3 && destination.length <= 200,
      "Nhập tài khoản nhận tiền (3–200 ký tự)",
      400,
    );
    res.status(201).json(
      await prisma.$transaction(async (db) => {
        await db.$queryRaw`SELECT id FROM users WHERE id = ${req.userId} FOR UPDATE`;
        const balance = await wallet(db, req.userId);
        check(balance.available >= amount, "Số dư có thể rút không đủ");
        return db.withdrawal.create({
          data: { tutorId: req.userId, amount, destination },
        });
      }),
    );
  });
  router.get("/finance/admin", async (req, res) => {
    role(req, "admin");
    const [transactions, withdrawals, config] = await Promise.all([
      prisma.transaction.findMany({
        include: {
          booking: { include: { match: true } },
          payer: { select: { id: true, name: true, role: true } },
          events: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.withdrawal.findMany({
        include: { tutor: userSummary },
        orderBy: { createdAt: "desc" },
      }),
      prisma.paymentConfig.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1 },
      }),
    ]);
    const paid = transactions.filter((t) =>
      ["succeeded", "refund_required"].includes(t.status),
    );
    res.json({
      transactions,
      withdrawals,
      config,
      cashflow: {
        classFeesCollected: transactions
          .filter(
            (t) => t.purpose === "class_acceptance" && t.status === "succeeded",
          )
          .reduce((sum, t) => sum + t.amount, 0),
        collected: paid.reduce((s, t) => s + t.amount, 0),
        refundLiability: paid
          .filter((t) => t.status === "refund_required")
          .reduce((s, t) => s + t.amount, 0),
        commission: paid
          .filter((t) => t.status === "succeeded")
          .reduce((s, t) => s + t.commission, 0),
        paidOut: withdrawals
          .filter((w) => w.status === "paid")
          .reduce((s, w) => s + w.amount, 0),
      },
    });
  });
  router.patch("/finance/config", async (req, res) => {
    role(req, "admin");
    const data = { updatedBy: req.userId };
    if (Object.hasOwn(req.body, "commissionBps"))
      data.commissionBps = integer(req.body.commissionBps, 0, 10000);
    if (Object.hasOwn(req.body, "acceptanceFeeVnd"))
      data.acceptanceFeeVnd = integer(req.body.acceptanceFeeVnd, 1000);
    check(
      Object.keys(data).length > 1,
      "Nhập mức phí nhận lớp hoặc cấu hình tài chính cần đổi",
      400,
    );
    res.json(
      await prisma.paymentConfig.upsert({
        where: { id: 1 },
        update: data,
        create: { id: 1, ...data },
      }),
    );
  });
  router.post("/finance/withdrawals/:id/:action", async (req, res) => {
    role(req, "admin");
    const actions = {
      approve: { from: ["requested"], to: "approved" },
      reject: { from: ["requested", "approved"], to: "rejected" },
      pay: { from: ["approved"], to: "paid" },
    };
    const action = actions[req.params.action];
    check(action, "Thao tác không hợp lệ", 400);
    if (req.params.action === "pay")
      check(demoEnabled(), "Chi trả mô phỏng chỉ có trong demo local", 403);
    const result = await prisma.withdrawal.updateMany({
      where: { id: req.params.id, status: { in: action.from } },
      data: { status: action.to, handledBy: req.userId },
    });
    check(result.count === 1, "Yêu cầu rút không tồn tại hoặc sai trạng thái");
    res.json({ status: action.to });
  });
  router.post("/finance/refunds/:id/demo", async (req, res) => {
    role(req, "admin");
    check(demoEnabled(), "Chỉ hỗ trợ hoàn tiền mô phỏng local", 403);
    const result = await prisma.transaction.updateMany({
      where: {
        id: req.params.id,
        provider: "local",
        status: "refund_required",
      },
      data: { status: "refunded" },
    });
    check(result.count === 1, "Giao dịch chưa cần hoàn tiền");
    res.json({ status: "refunded" });
  });
  return router;
}
