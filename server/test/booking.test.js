import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { prisma } from "../src/db.js";
import {
  validateWeeklySchedule,
  weeklyOccurrences,
} from "../src/weeklySchedule.js";

const port = 5031;
const base = `http://127.0.0.1:${port}/api`;
const webhookSecret = "whsec_local_regression_only";
const children = [];

async function startServer(serverPort = port, extra = {}) {
  const child = spawn(process.execPath, ["index.js"], {
    env: {
      ...process.env,
      PORT: String(serverPort),
      AUTH_MODE: "dev",
      PAYMENT_MODE: "stripe",
      STRIPE_SECRET_KEY: "sk_test_local_regression_only",
      STRIPE_WEBHOOK_SECRET: webhookSecret,
      NODE_ENV: "test",
      ...extra,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  for (let index = 0; index < 100; index++) {
    if (child.exitCode !== null) throw new Error(output);
    if (output.includes(`:${serverPort}`)) {
      const response = await fetch(`http://127.0.0.1:${serverPort}/api/health`);
      if (response.ok) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server startup timeout ${output}`);
}

async function api(account, route, method = "GET", body) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(account ? { "x-user-id": String(account.id) } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  return { status: response.status, body: await response.json() };
}

async function storedLegacyBooking(match, tutor, index, overrides = {}) {
  const startsAt = new Date(Date.now() + (48 + index * 2) * 3600000);
  const slot = await prisma.tutorSlot.create({
    data: {
      tutorId: tutor.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3600000),
      price: 200000,
    },
  });
  return prisma.booking.create({
    data: {
      kind: "single_session",
      matchId: match.id,
      slotId: slot.id,
      status: overrides.status || "held",
      expiresAt: overrides.expiresAt || new Date(Date.now() + 600000),
      transaction: {
        create: {
          purpose: "lesson_deposit",
          payerId: match.studentId,
          amount: 60000,
          commissionBps: 1000,
          commission: 6000,
          tutorIncome: 54000,
          provider: "stripe",
          sessionId: `cs_legacy_${randomUUID()}`,
          status: overrides.paymentStatus || "pending",
        },
      },
    },
    include: { transaction: true, slot: true },
  });
}

async function signedWebhook(booking, extra = {}, signatureOverride) {
  const event = {
    id: extra.eventId || `evt_legacy_${randomUUID()}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: booking.transaction.sessionId,
        metadata: { transactionId: booking.transaction.id },
        amount_total: extra.amount ?? booking.transaction.amount,
        currency: "vnd",
        payment_status: "paid",
      },
    },
  };
  const payload = JSON.stringify(event);
  const stripe = new Stripe("sk_test_local_regression_only");
  const signature =
    signatureOverride ||
    stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });
  const response = await fetch(`${base}/payments/stripe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });
  return {
    status: response.status,
    body: await response.json(),
    eventId: event.id,
  };
}

test("Weekly schedule keeps Vietnam calendar dates and future occurrences", () => {
  const schedule = validateWeeklySchedule({
    weekdays: [5, 1, 3],
    sessionsPerWeek: 3,
    startTime: "19:00",
    endTime: "20:00",
  });
  assert.deepEqual(schedule.weekdays, [1, 3, 5]);
  const occurrences = weeklyOccurrences(
    schedule,
    new Date("2026-11-15T17:30:00Z"),
  );
  assert.equal(occurrences.length, 12);
  assert.equal(
    occurrences[0].startsAt.toISOString(),
    "2026-11-16T12:00:00.000Z",
  );
  const future = weeklyOccurrences(schedule, new Date("2026-11-16T12:30:00Z"));
  assert.equal(future[0].startsAt.toISOString(), "2026-11-18T12:00:00.000Z");
  const sunday = weeklyOccurrences(
    { ...schedule, weekdays: [7], startTime: "00:30", endTime: "01:30" },
    new Date("2026-11-14T17:00:00Z"),
  );
  assert.equal(sunday[0].startsAt.toISOString(), "2026-11-14T17:30:00.000Z");
});

test("Weekly availability, historical transactions and shared chat regressions", async (t) => {
  const marker = randomUUID();
  const users = [];
  let oldConfig;
  try {
    await startServer();
    for (const role of ["student", "student", "tutor", "admin"]) {
      users.push(
        await prisma.user.create({
          data: {
            email: `support-${marker}-${users.length}@test.invalid`,
            name: `Support test ${role}`,
            role,
          },
        }),
      );
    }
    const [student, other, tutor, admin] = users;
    const match = await prisma.match.create({
      data: { studentId: student.id, tutorId: tutor.id },
    });
    oldConfig = await prisma.paymentConfig.findUnique({ where: { id: 1 } });

    await t.test(
      "students and tutors save preferences, reject invalid input and see matched schedules",
      async () => {
        assert.equal((await api(null, "/bookings/me")).status, 401);
        assert.equal((await api(student, "/bookings/schedule")).body, null);
        const draft = {
          weekdays: [5, 1, 3],
          sessionsPerWeek: 3,
          startTime: "19:00",
          endTime: "20:00",
        };
        const saved = await api(student, "/bookings/schedule", "PUT", {
          ...draft,
          userId: other.id,
        });
        assert.equal(saved.status, 200);
        assert.equal(saved.body.userId, student.id);
        assert.deepEqual(saved.body.weekdays, [1, 3, 5]);
        assert.equal((await api(other, "/bookings/schedule")).body, null);
        assert.equal(
          (await api(tutor, "/bookings/schedule", "PUT", draft)).status,
          200,
        );
        assert.equal(
          (await api(admin, "/bookings/schedule", "PUT", draft)).status,
          403,
        );
        assert.equal(
          (await api(student, "/bookings/matches")).body[0].tutor.weeklySchedule
            .sessionsPerWeek,
          3,
        );
        assert.equal(
          (await api(tutor, "/bookings/matches")).body[0].student.weeklySchedule
            .sessionsPerWeek,
          3,
        );
        for (const invalid of [
          { weekdays: [] },
          { weekdays: [1, 1] },
          { weekdays: [8] },
          { sessionsPerWeek: 0 },
          { startTime: "25:00" },
          { endTime: "18:00" },
        ]) {
          assert.equal(
            (
              await api(student, "/bookings/schedule", "PUT", {
                ...draft,
                ...invalid,
              })
            ).status,
            400,
          );
        }
      },
    );

    await t.test(
      "tutor slot publishing remains idempotent and protected by role and overlap checks",
      async () => {
        assert.equal(
          (
            await api(student, "/bookings/slots/weekly", "POST", {
              price: 200000,
            })
          ).status,
          403,
        );
        const published = await api(tutor, "/bookings/slots/weekly", "POST", {
          price: 200000,
        });
        assert.equal(published.status, 201);
        assert.ok(published.body.createdCount > 0);
        assert.equal(
          (
            await api(tutor, "/bookings/slots/weekly", "POST", {
              price: 200000,
            })
          ).body.createdCount,
          0,
        );
        const slot = (await api(student, `/bookings/slots?tutorId=${tutor.id}`))
          .body[0];
        assert.ok(slot);
        assert.equal(
          (
            await api(tutor, "/bookings/slots", "POST", {
              startsAt: slot.startsAt,
              endsAt: slot.endsAt,
              price: 200000,
            })
          ).status,
          409,
        );
      },
    );

    await t.test(
      "historical single-session payments still verify raw signatures and ignore duplicate events",
      async () => {
        const booking = await storedLegacyBooking(match, tutor, 1);
        assert.equal(
          (await api(student, "/bookings/")).body.find(
            (item) => item.id === booking.id,
          ).kind,
          "single_session",
        );
        const invalid = await signedWebhook(booking, {}, "invalid");
        assert.equal(invalid.status, 400);
        assert.equal((await signedWebhook(booking, { amount: 1 })).status, 400);
        const eventId = `evt_duplicate_${marker}`;
        assert.equal((await signedWebhook(booking, { eventId })).status, 200);
        assert.equal((await signedWebhook(booking, { eventId })).status, 200);
        assert.equal(
          await prisma.paymentEvent.count({ where: { id: eventId } }),
          1,
        );
        assert.equal(
          (await prisma.booking.findUnique({ where: { id: booking.id } }))
            .status,
          "confirmed",
        );
        const stored = await prisma.transaction.findUnique({
          where: { id: booking.transaction.id },
        });
        assert.equal(stored.status, "succeeded");
        assert.equal(stored.purpose, "lesson_deposit");
        assert.equal(stored.payerId, student.id);
      },
    );

    await t.test(
      "late historical payment retains expired booking and records refund liability",
      async () => {
        const booking = await storedLegacyBooking(match, tutor, 2, {
          expiresAt: new Date(Date.now() - 1000),
        });
        assert.equal(
          (await api(student, "/bookings/")).body.find(
            (item) => item.id === booking.id,
          ).status,
          "expired",
        );
        assert.equal((await signedWebhook(booking)).status, 200);
        assert.equal(
          (await prisma.booking.findUnique({ where: { id: booking.id } }))
            .status,
          "expired",
        );
        assert.equal(
          (
            await prisma.transaction.findUnique({
              where: { id: booking.transaction.id },
            })
          ).status,
          "refund_required",
        );
      },
    );

    await t.test(
      "historical income and commission snapshots remain available in finance views",
      async () => {
        const booking = await storedLegacyBooking(match, tutor, 3, {
          status: "completed",
          paymentStatus: "succeeded",
        });
        const wallet = await api(tutor, "/bookings/finance/wallet");
        assert.equal(wallet.status, 200);
        assert.equal(wallet.body.earned, 54000);
        assert.equal(
          (await api(student, "/bookings/finance/wallet")).status,
          403,
        );
        assert.equal(
          (await api(student, "/bookings/finance/admin")).status,
          403,
        );
        assert.equal(
          (
            await api(admin, "/bookings/finance/config", "PATCH", {
              commissionBps: 2000,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await prisma.transaction.findUnique({
              where: { id: booking.transaction.id },
            })
          ).commissionBps,
          1000,
        );
        const overview = await api(admin, "/bookings/finance/admin");
        assert.equal(overview.status, 200);
        assert.equal(
          overview.body.transactions.find(
            (item) => item.id === booking.transaction.id,
          ).purpose,
          "lesson_deposit",
        );
      },
    );

    await t.test(
      "shared chat still creates conversations, persists messages and checks membership",
      async () => {
        const created = await api(student, "/conversations", "POST", {
          studentId: student.id,
          tutorId: tutor.id,
        });
        assert.equal(created.status, 201, JSON.stringify(created.body));
        const sent = await api(
          student,
          `/conversations/${created.body.id}/messages`,
          "POST",
          { content: "Recurring workflow chat regression" },
        );
        assert.equal(sent.status, 201);
        const history = await api(
          tutor,
          `/conversations/${created.body.id}/messages`,
        );
        assert.ok(history.body.some((item) => item.id === sent.body.id));
        assert.equal(
          (await api(other, `/conversations/${created.body.id}/messages`))
            .status,
          403,
        );
      },
    );

    await t.test(
      "production ignores forged development identity headers",
      async () => {
        await startServer(port + 1, { NODE_ENV: "production" });
        const response = await fetch(
          `http://127.0.0.1:${port + 1}/api/bookings/me`,
          { headers: { "x-user-id": String(admin.id) } },
        );
        assert.equal(response.status, 401);
      },
    );
  } finally {
    for (const child of children) child.kill();
    const ids = users.map((account) => account.id);
    const bookingFilter = { match: { studentId: { in: ids } } };
    await prisma.$transaction(
      async (db) => {
        await db.paymentEvent.deleteMany({
          where: { transaction: { booking: bookingFilter } },
        });
        await db.transaction.deleteMany({ where: { booking: bookingFilter } });
        await db.booking.deleteMany({ where: bookingFilter });
        await db.match.deleteMany({ where: { studentId: { in: ids } } });
        await db.tutorSlot.deleteMany({ where: { tutorId: { in: ids } } });
        await db.withdrawal.deleteMany({ where: { tutorId: { in: ids } } });
        await db.conversation.deleteMany({ where: { studentId: { in: ids } } });
        if (oldConfig)
          await db.paymentConfig.update({
            where: { id: 1 },
            data: {
              commissionBps: oldConfig.commissionBps,
              acceptanceFeeVnd: oldConfig.acceptanceFeeVnd,
              updatedBy: oldConfig.updatedBy,
            },
          });
        await db.user.deleteMany({ where: { id: { in: ids } } });
      },
      { timeout: 30000 },
    );
    await prisma.$disconnect();
  }
});
