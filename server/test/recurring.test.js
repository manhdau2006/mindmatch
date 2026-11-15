import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { io } from "socket.io-client";
import { prisma } from "../src/db.js";

const port = 5021;
const base = `http://127.0.0.1:${port}/api/bookings`;
const marker = randomUUID();
const users = [];
const sockets = [];

function dateAfter(days) {
  const date = new Date(Date.now() + 7 * 3600000);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function api(user, path, method = "GET", body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "x-user-id": String(user.id) } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  return { status: response.status, body: await response.json() };
}

async function startServer() {
  const child = spawn(process.execPath, ["index.js"], {
    env: {
      ...process.env,
      PORT: String(port),
      AUTH_MODE: "dev",
      PAYMENT_MODE: "local",
      REQUEST_HOLD_HOURS: "24",
      NODE_ENV: "test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  try {
    for (let index = 0; index < 100; index++) {
      if (child.exitCode !== null) throw new Error(output);
      if (output.includes(`:${port}`)) {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (response.ok) return child;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Server did not start. ${output}`);
  } catch (error) {
    child.kill();
    throw error;
  }
}

async function user(role) {
  const result = await prisma.user.create({
    data: {
      email: `recurring-${marker}-${users.length}@test.invalid`,
      name: `Recurring test ${role}`,
      role,
    },
  });
  users.push(result);
  return result;
}

async function fixture() {
  const student = await user("student");
  const other = await user("student");
  const tutor = await user("tutor");
  const unrelatedTutor = await user("tutor");
  for (const account of [tutor, unrelatedTutor]) {
    await prisma.weeklySchedule.create({
      data: {
        userId: account.id,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        sessionsPerWeek: 3,
        startTime: "14:00",
        endTime: "22:00",
      },
    });
  }
  const match = await prisma.match.create({
    data: { studentId: student.id, tutorId: tutor.id },
  });
  const otherMatch = await prisma.match.create({
    data: { studentId: other.id, tutorId: tutor.id },
  });
  const secondTutorMatch = await prisma.match.create({
    data: { studentId: student.id, tutorId: unrelatedTutor.id },
  });
  return {
    student,
    other,
    tutor,
    unrelatedTutor,
    match,
    otherMatch,
    secondTutorMatch,
  };
}

function requestBody(match, overrides = {}) {
  return {
    matchId: match.id,
    weekdays: [2, 4],
    startTime: "19:00",
    endTime: "20:00",
    startDate: dateAfter(3),
    ...overrides,
  };
}

async function createRequest(data, overrides = {}) {
  const result = await api(
    data.student,
    "/requests",
    "POST",
    requestBody(data.match, overrides),
  );
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body;
}

async function pay(
  tutor,
  bookingId,
  outcome = "success",
  attemptId = randomUUID(),
) {
  return api(tutor, `/${bookingId}/pay-acceptance`, "POST", {
    outcome,
    attemptId,
  });
}

function socketEvent(socket, name, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(name, handler);
      reject(new Error(`Timed out waiting for ${name}`));
    }, 8000);
    function handler(value) {
      if (!predicate(value)) return;
      clearTimeout(timer);
      socket.off(name, handler);
      resolve(value);
    }
    socket.on(name, handler);
  });
}

async function connect(account) {
  const socket = io(`http://127.0.0.1:${port}`, {
    auth: { userId: account.id },
    transports: ["websocket"],
    autoConnect: false,
    reconnection: false,
  });
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Socket connect timeout")),
      8000,
    );
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.connect();
  });
  return socket;
}

test("Tutor-paid recurring class booking through the real API", async (t) => {
  let child;
  let oldConfig;
  try {
    child = await startServer();
    const admin = await user("admin");
    oldConfig = await prisma.paymentConfig.findUnique({ where: { id: 1 } });
    const configured = await api(admin, "/finance/config", "PATCH", {
      acceptanceFeeVnd: 100000,
    });
    assert.equal(configured.status, 200, JSON.stringify(configured.body));

    await t.test(
      "parent requests a genuine weekly class and the assigned tutor pays once",
      async () => {
        const data = await fixture();
        const config = await api(data.student, "/config");
        assert.equal(config.status, 200);
        assert.equal(config.body.acceptanceFeeVnd, 100000);
        assert.equal(config.body.payerRole, "tutor");
        const booking = await createRequest(data, {
          amount: 1,
          tutorId: data.unrelatedTutor.id,
        });
        assert.equal(booking.kind, "recurring_class");
        assert.equal(booking.status, "pending_tutor");
        assert.equal(booking.slotId, null);
        assert.deepEqual(booking.recurrenceWeekdays, [2, 4]);
        assert.equal(booking.transaction.amount, 100000);
        assert.equal(booking.transaction.purpose, "class_acceptance");
        assert.equal(booking.transaction.payerId, data.tutor.id);
        assert.equal(booking.transaction.tutorIncome, 0);
        assert.equal(
          (await api(data.tutor, "/")).body.find(
            (item) => item.id === booking.id,
          ).status,
          "pending_tutor",
        );
        const paid = await pay(data.tutor, booking.id);
        assert.equal(paid.status, 200, JSON.stringify(paid.body));
        assert.equal(paid.body.status, "confirmed");
        assert.equal(paid.body.transaction.status, "succeeded");
        assert.equal(paid.body.transaction.commission, 100000);
        for (const participant of [data.student, data.tutor]) {
          assert.equal(
            (await api(participant, "/")).body.find(
              (item) => item.id === booking.id,
            ).status,
            "confirmed",
          );
        }
        assert.equal(
          await prisma.transaction.count({ where: { bookingId: booking.id } }),
          1,
        );
        assert.equal((await api(data.tutor, "/finance/wallet")).body.earned, 0);
      },
    );

    await t.test(
      "the assigned tutor can reject and the parent sees the rejection",
      async () => {
        const data = await fixture();
        const booking = await createRequest(data);
        const rejected = await api(
          data.tutor,
          `/${booking.id}/reject`,
          "POST",
          { reason: "Lich day khong phu hop" },
        );
        assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
        assert.equal(rejected.body.status, "rejected");
        assert.equal(rejected.body.rejectionReason, "Lich day khong phu hop");
        assert.equal(rejected.body.transaction.status, "cancelled");
        assert.equal(
          (await api(data.student, "/")).body.find(
            (item) => item.id === booking.id,
          ).status,
          "rejected",
        );
        assert.equal((await pay(data.tutor, booking.id)).status, 409);
        const replacement = await api(
          data.other,
          "/requests",
          "POST",
          requestBody(data.otherMatch),
        );
        assert.equal(replacement.status, 201, JSON.stringify(replacement.body));
      },
    );

    await t.test(
      "failed payment stays pending and a new attempt can succeed",
      async () => {
        const data = await fixture();
        const booking = await createRequest(data);
        const attemptId = randomUUID();
        const failed = await pay(data.tutor, booking.id, "failure", attemptId);
        assert.equal(failed.status, 200, JSON.stringify(failed.body));
        assert.equal(failed.body.status, "pending_tutor");
        assert.equal(failed.body.transaction.status, "failed");
        assert.equal(
          (await api(data.student, "/")).body.find(
            (item) => item.id === booking.id,
          ).status,
          "pending_tutor",
        );
        const repeated = await pay(
          data.tutor,
          booking.id,
          "failure",
          attemptId,
        );
        assert.equal(repeated.status, 200);
        assert.equal(
          await prisma.paymentEvent.count({
            where: { transactionId: booking.transaction.id },
          }),
          1,
        );
        assert.equal(
          (await pay(data.tutor, booking.id, "success", attemptId)).status,
          409,
        );
        const retried = await pay(data.tutor, booking.id);
        assert.equal(retried.status, 200, JSON.stringify(retried.body));
        assert.equal(retried.body.status, "confirmed");
        assert.equal(retried.body.transaction.status, "succeeded");
        assert.equal(
          await prisma.paymentEvent.count({
            where: { transactionId: booking.transaction.id },
          }),
          2,
        );
        assert.equal(
          await prisma.transaction.count({ where: { bookingId: booking.id } }),
          1,
        );
      },
    );

    await t.test(
      "role and ownership checks protect requests, payment and rejection",
      async () => {
        const data = await fixture();
        const booking = await createRequest(data);
        assert.equal((await api(null, "/")).status, 401);
        assert.equal(
          (await api(data.tutor, "/requests", "POST", requestBody(data.match)))
            .status,
          403,
        );
        assert.equal(
          (await api(data.other, "/requests", "POST", requestBody(data.match)))
            .status,
          403,
        );
        for (const account of [
          data.student,
          data.other,
          data.unrelatedTutor,
          admin,
        ]) {
          assert.equal((await pay(account, booking.id)).status, 403);
          assert.equal(
            (await api(account, `/${booking.id}/reject`, "POST", {})).status,
            403,
          );
        }
        assert.ok(
          !(await api(data.unrelatedTutor, "/")).body.some(
            (item) => item.id === booking.id,
          ),
        );
        assert.ok(
          !(await api(data.other, "/")).body.some(
            (item) => item.id === booking.id,
          ),
        );
        assert.equal(
          await prisma.paymentEvent.count({
            where: { transactionId: booking.transaction.id },
          }),
          0,
        );
      },
    );

    await t.test(
      "requests validate Match, tutor availability, times and actual calendar dates",
      async () => {
        const data = await fixture();
        await prisma.weeklySchedule.update({
          where: { userId: data.tutor.id },
          data: { weekdays: [2, 4], startTime: "19:00", endTime: "20:00" },
        });
        await prisma.match.update({
          where: { id: data.match.id },
          data: { active: false },
        });
        assert.equal(
          (
            await api(
              data.student,
              "/requests",
              "POST",
              requestBody(data.match),
            )
          ).status,
          403,
        );
        await prisma.match.update({
          where: { id: data.match.id },
          data: { active: true },
        });
        for (const invalid of [
          { weekdays: [] },
          { weekdays: [0] },
          { weekdays: [8] },
          { weekdays: [2, 2] },
          { weekdays: ["2"] },
          { startTime: "25:00" },
          { startTime: "9:00" },
          { endTime: "18:00" },
          { startDate: dateAfter(-1) },
          { startDate: "2026-02-30" },
          { endDate: dateAfter(1) },
        ]) {
          const result = await api(
            data.student,
            "/requests",
            "POST",
            requestBody(data.match, invalid),
          );
          assert.equal(result.status, 400, JSON.stringify({ invalid, result }));
        }
        for (const outsideAvailability of [
          { weekdays: [1] },
          { startTime: "18:30" },
          { endTime: "20:30" },
        ]) {
          const result = await api(
            data.student,
            "/requests",
            "POST",
            requestBody(data.match, outsideAvailability),
          );
          assert.ok([400, 409].includes(result.status), JSON.stringify(result));
        }
        assert.equal(
          await prisma.booking.count({ where: { matchId: data.match.id } }),
          0,
        );
      },
    );

    await t.test(
      "two simultaneous overlapping requests reserve one weekly timetable",
      async () => {
        const data = await fixture();
        const results = await Promise.all([
          api(data.student, "/requests", "POST", requestBody(data.match)),
          api(data.other, "/requests", "POST", requestBody(data.otherMatch)),
        ]);
        assert.deepEqual(
          results.map((result) => result.status).sort(),
          [201, 409],
          JSON.stringify(results),
        );
        const winner = results.find((result) => result.status === 201).body;
        assert.equal(
          (await pay(data.tutor, winner.id)).body.status,
          "confirmed",
        );
        const loser =
          winner.matchId === data.match.id ? data.other : data.student;
        const losingMatch =
          winner.matchId === data.match.id ? data.otherMatch : data.match;
        assert.equal(
          (await api(loser, "/requests", "POST", requestBody(losingMatch)))
            .status,
          409,
        );
      },
    );

    await t.test(
      "infinite recurrence conflicts after four weeks while adjacent times remain valid",
      async () => {
        const data = await fixture();
        const booking = await createRequest(data);
        assert.equal(
          (await pay(data.tutor, booking.id)).body.status,
          "confirmed",
        );
        const distant = await api(
          data.other,
          "/requests",
          "POST",
          requestBody(data.otherMatch, { startDate: dateAfter(100) }),
        );
        assert.equal(distant.status, 409, JSON.stringify(distant.body));
        const adjacent = await api(
          data.other,
          "/requests",
          "POST",
          requestBody(data.otherMatch, {
            startTime: "20:00",
            endTime: "21:00",
          }),
        );
        assert.equal(adjacent.status, 201, JSON.stringify(adjacent.body));
      },
    );

    await t.test(
      "finite recurrence allows the same weekdays after its end date",
      async () => {
        const data = await fixture();
        const booking = await createRequest(data, { endDate: dateAfter(17) });
        assert.equal(
          (await pay(data.tutor, booking.id)).body.status,
          "confirmed",
        );
        const later = await api(
          data.other,
          "/requests",
          "POST",
          requestBody(data.otherMatch, { startDate: dateAfter(30) }),
        );
        assert.equal(later.status, 201, JSON.stringify(later.body));
        const differentDays = await api(
          data.other,
          "/requests",
          "POST",
          requestBody(data.otherMatch, { weekdays: [1, 3] }),
        );
        assert.equal(
          differentDays.status,
          201,
          JSON.stringify(differentDays.body),
        );
      },
    );

    await t.test(
      "a student's class also blocks a conflicting class with another tutor",
      async () => {
        const data = await fixture();
        const booking = await createRequest(data);
        assert.equal(
          (await pay(data.tutor, booking.id)).body.status,
          "confirmed",
        );
        const conflict = await api(
          data.student,
          "/requests",
          "POST",
          requestBody(data.secondTutorMatch),
        );
        assert.equal(conflict.status, 409, JSON.stringify(conflict.body));
      },
    );

    await t.test(
      "expired pending requests release the schedule and cannot be charged late",
      async () => {
        const data = await fixture();
        const booking = await createRequest(data);
        await prisma.booking.update({
          where: { id: booking.id },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });
        const history = await api(data.student, "/");
        assert.equal(
          history.body.find((item) => item.id === booking.id).status,
          "expired",
        );
        const late = await pay(data.tutor, booking.id);
        assert.equal(late.status, 409, JSON.stringify(late.body));
        const transaction = await prisma.transaction.findUnique({
          where: { id: booking.transaction.id },
        });
        assert.equal(transaction.status, "cancelled");
        assert.equal(
          await prisma.paymentEvent.count({
            where: { transactionId: transaction.id },
          }),
          0,
        );
        const available = await api(
          data.other,
          "/requests",
          "POST",
          requestBody(data.otherMatch),
        );
        assert.equal(available.status, 201, JSON.stringify(available.body));
      },
    );

    await t.test(
      "replayed and concurrent successful payments charge a class exactly once",
      async () => {
        const data = await fixture();
        const booking = await createRequest(data);
        const attemptId = randomUUID();
        const results = await Promise.all([
          pay(data.tutor, booking.id, "success", attemptId),
          pay(data.tutor, booking.id, "success", attemptId),
        ]);
        assert.deepEqual(
          results.map((result) => result.status),
          [200, 200],
          JSON.stringify(results),
        );
        assert.ok(
          results.every((result) => result.body.status === "confirmed"),
        );
        assert.equal((await pay(data.tutor, booking.id)).status, 200);
        const recorded = await prisma.transaction.findMany({
          where: { bookingId: booking.id },
        });
        assert.equal(recorded.length, 1);
        assert.equal(recorded[0].amount, 100000);
        assert.equal(recorded[0].status, "succeeded");
        assert.equal(
          await prisma.paymentEvent.count({
            where: { transactionId: recorded[0].id },
          }),
          1,
        );
      },
    );

    await t.test(
      "the fee is snapshotted once per request independently of weekday count",
      async () => {
        const first = await fixture();
        const firstBooking = await createRequest(first, {
          weekdays: [1, 2, 3, 4, 5],
        });
        assert.equal(firstBooking.transaction.amount, 100000);
        assert.equal(
          (
            await api(admin, "/finance/config", "PATCH", {
              acceptanceFeeVnd: 150000,
            })
          ).status,
          200,
        );
        const second = await fixture();
        const secondBooking = await createRequest(second, { weekdays: [6] });
        assert.equal(secondBooking.transaction.amount, 150000);
        assert.equal(
          (await pay(first.tutor, firstBooking.id)).body.transaction.amount,
          100000,
        );
        assert.equal(
          (await pay(second.tutor, secondBooking.id)).body.transaction.amount,
          150000,
        );
        assert.equal(
          (
            await api(admin, "/finance/config", "PATCH", {
              acceptanceFeeVnd: 100000,
            })
          ).status,
          200,
        );
      },
    );

    await t.test(
      "confirmation rechecks current Match and tutor availability before charging",
      async () => {
        const changedMatch = await fixture();
        const booking = await createRequest(changedMatch);
        await prisma.match.update({
          where: { id: changedMatch.match.id },
          data: { active: false },
        });
        const inactive = await pay(changedMatch.tutor, booking.id);
        assert.ok(
          [403, 409].includes(inactive.status),
          JSON.stringify(inactive.body),
        );
        assert.notEqual(
          (
            await prisma.transaction.findUnique({
              where: { id: booking.transaction.id },
            })
          ).status,
          "succeeded",
        );
        const changedSchedule = await fixture();
        const otherBooking = await createRequest(changedSchedule);
        await prisma.weeklySchedule.update({
          where: { userId: changedSchedule.tutor.id },
          data: { weekdays: [1, 3, 5] },
        });
        const unavailable = await pay(changedSchedule.tutor, otherBooking.id);
        assert.ok(
          [400, 409].includes(unavailable.status),
          JSON.stringify(unavailable.body),
        );
        assert.notEqual(
          (
            await prisma.transaction.findUnique({
              where: { id: otherBooking.transaction.id },
            })
          ).status,
          "succeeded",
        );
      },
    );

    await t.test(
      "a concurrent reject and payment produce one consistent final decision",
      async () => {
        const data = await fixture();
        const booking = await createRequest(data);
        const results = await Promise.all([
          pay(data.tutor, booking.id),
          api(data.tutor, `/${booking.id}/reject`, "POST", {
            reason: "Concurrent decision",
          }),
        ]);
        assert.deepEqual(
          results.map((result) => result.status).sort(),
          [200, 409],
          JSON.stringify(results),
        );
        const final = await prisma.booking.findUnique({
          where: { id: booking.id },
          include: { transaction: true },
        });
        assert.ok(["confirmed", "rejected"].includes(final.status));
        assert.equal(
          final.transaction.status,
          final.status === "confirmed" ? "succeeded" : "cancelled",
        );
      },
    );

    await t.test(
      "notifications reach both matched parties when a request changes",
      async () => {
        const data = await fixture();
        const parentSocket = await connect(data.student);
        const tutorSocket = await connect(data.tutor);
        const incoming = socketEvent(
          tutorSocket,
          "booking_updated",
          (value) => value.status === "pending_tutor",
        );
        const booking = await createRequest(data);
        assert.equal((await incoming).bookingId, booking.id);
        const parentConfirmed = socketEvent(
          parentSocket,
          "booking_updated",
          (value) =>
            value.bookingId === booking.id && value.status === "confirmed",
        );
        const tutorConfirmed = socketEvent(
          tutorSocket,
          "booking_updated",
          (value) =>
            value.bookingId === booking.id && value.status === "confirmed",
        );
        assert.equal((await pay(data.tutor, booking.id)).status, 200);
        await Promise.all([parentConfirmed, tutorConfirmed]);
        parentSocket.disconnect();
        tutorSocket.disconnect();
      },
    );

    await t.test(
      "legacy learner-paid entry points no longer create new deposit bookings",
      async () => {
        const data = await fixture();
        assert.equal(
          (
            await api(data.student, "/hold", "POST", {
              matchId: data.match.id,
              slotId: 1,
            })
          ).status,
          410,
        );
        assert.equal(
          (await api(data.student, "/legacy/checkout", "POST", {})).status,
          410,
        );
        assert.equal(
          (
            await api(data.student, "/legacy/demo-payment", "POST", {
              outcome: "success",
            })
          ).status,
          410,
        );
        assert.equal(
          await prisma.booking.count({ where: { matchId: data.match.id } }),
          0,
        );
      },
    );
  } finally {
    for (const socket of sockets) socket.disconnect();
    if (child) child.kill();
    const ids = users.map((account) => account.id);
    const participantFilter = {
      OR: [{ studentId: { in: ids } }, { tutorId: { in: ids } }],
    };
    const bookingFilter = { match: participantFilter };
    await prisma.$transaction(
      async (db) => {
        await db.paymentEvent.deleteMany({
          where: { transaction: { booking: bookingFilter } },
        });
        await db.transaction.deleteMany({ where: { booking: bookingFilter } });
        await db.booking.deleteMany({ where: bookingFilter });
        await db.match.deleteMany({ where: participantFilter });
        await db.tutorSlot.deleteMany({ where: { tutorId: { in: ids } } });
        await db.withdrawal.deleteMany({ where: { tutorId: { in: ids } } });
        await db.conversation.deleteMany({ where: participantFilter });
        if (oldConfig) {
          await db.paymentConfig.update({
            where: { id: 1 },
            data: {
              commissionBps: oldConfig.commissionBps,
              acceptanceFeeVnd: oldConfig.acceptanceFeeVnd,
              updatedBy: oldConfig.updatedBy,
            },
          });
        }
        await db.user.deleteMany({ where: { id: { in: ids } } });
      },
      { timeout: 30000 },
    );
    await prisma.$disconnect();
  }
});
