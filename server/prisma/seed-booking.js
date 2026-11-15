import "dotenv/config";
import { prisma } from "../src/db.js";

const definitions = [
  {
    email: "cong.student@mindmatch.test",
    name: "Công (học viên demo)",
    role: "student",
  },
  {
    email: "other.student@mindmatch.test",
    name: "Học viên thứ hai demo",
    role: "student",
  },
  {
    email: "booking.tutor@mindmatch.test",
    name: "Gia sư demo",
    role: "tutor",
    price: 200000,
  },
  { email: "booking.admin@mindmatch.test", name: "Admin demo", role: "admin" },
  {
    email: "demo.an.student@mindmatch.test",
    name: "Nguyễn Hoàng An (demo)",
    role: "student",
  },
  {
    email: "demo.binh.student@mindmatch.test",
    name: "Trần Thanh Bình (demo)",
    role: "student",
  },
  {
    email: "demo.chi.student@mindmatch.test",
    name: "Lê Minh Chi (demo)",
    role: "student",
  },
  {
    email: "demo.dung.student@mindmatch.test",
    name: "Phạm Anh Dũng (demo)",
    role: "student",
  },
  {
    email: "demo.ha.student@mindmatch.test",
    name: "Đỗ Thu Hà (demo)",
    role: "student",
  },
  {
    email: "demo.huy.student@mindmatch.test",
    name: "Vũ Quang Huy (demo)",
    role: "student",
  },
  {
    email: "demo.lan.student@mindmatch.test",
    name: "Nguyễn Mai Lan (demo)",
    role: "student",
  },
  {
    email: "demo.minh.student@mindmatch.test",
    name: "Trần Đức Minh (demo)",
    role: "student",
  },
  {
    email: "demo.ngoc.student@mindmatch.test",
    name: "Lê Bảo Ngọc (demo)",
    role: "student",
  },
  {
    email: "demo.phuc.student@mindmatch.test",
    name: "Phạm Gia Phúc (demo)",
    role: "student",
  },
  {
    email: "demo.minhanh.tutor@mindmatch.test",
    name: "Thầy Minh Anh - Toán (demo)",
    role: "tutor",
    price: 150000,
  },
  {
    email: "demo.thuha.tutor@mindmatch.test",
    name: "Cô Thu Hà - Tiếng Anh (demo)",
    role: "tutor",
    price: 180000,
  },
  {
    email: "demo.quanghuy.tutor@mindmatch.test",
    name: "Thầy Quang Huy - Vật lý (demo)",
    role: "tutor",
    price: 220000,
  },
  {
    email: "demo.mailan.tutor@mindmatch.test",
    name: "Cô Mai Lan - Hóa học (demo)",
    role: "tutor",
    price: 250000,
  },
  {
    email: "demo.ducminh.tutor@mindmatch.test",
    name: "Thầy Đức Minh - Lập trình (demo)",
    role: "tutor",
    price: 300000,
  },
  {
    email: "demo.ngoclinh.tutor@mindmatch.test",
    name: "Cô Ngọc Linh - Ngữ văn (demo)",
    role: "tutor",
    price: 280000,
  },
  {
    email: "demo.tuanphong.tutor@mindmatch.test",
    name: "Thầy Tuấn Phong - Tin học (demo)",
    role: "tutor",
    price: 350000,
  },
];

const dayCount = 3;
const slotsPerDay = 8;
const hourMs = 3600000;

async function main() {
  const dateParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  // 02:00 UTC is 09:00 in Vietnam. Calendar arithmetic follows Vietnam's date.
  const firstStart = new Date(
    Date.UTC(
      Number(dateParts.year),
      Number(dateParts.month) - 1,
      Number(dateParts.day) + 1,
      2,
    ),
  );
  const windowEnd = new Date(firstStart.getTime() + dayCount * 24 * hourMs);
  let createdSlots = 0;
  let createdMatches = 0;

  const users = await prisma.$transaction(
    async (db) => {
      const seededUsers = [];
      for (const definition of definitions) {
        const { price, ...userData } = definition;
        const user = await db.user.upsert({
          where: { email: userData.email },
          update: {},
          create: userData,
        });
        seededUsers.push({ ...user, price });
      }
      const demoWeekdays = Array.from({ length: dayCount }, (_, day) => {
        const date = new Date(firstStart.getTime() + day * 24 * hourMs);
        return date.getUTCDay() || 7;
      }).sort((a, b) => a - b);
      await db.weeklySchedule.createMany({
        data: seededUsers
          .filter((user) => user.role !== "admin")
          .map((user, index) => ({
            userId: user.id,
            weekdays: demoWeekdays,
            sessionsPerWeek: 2 + (index % 2),
            startTime: "09:00",
            endTime: "10:00",
          })),
        skipDuplicates: true,
      });
      const students = seededUsers.filter((user) => user.role === "student");
      const tutors = seededUsers.filter((user) => user.role === "tutor");
      const matches = await db.match.createMany({
        data: students.flatMap((student) =>
          tutors.map((tutor) => ({
            studentId: student.id,
            tutorId: tutor.id,
            source: "demo",
          })),
        ),
        skipDuplicates: true,
      });
      createdMatches = matches.count;

      for (const tutor of tutors) {
        // The availability API uses this same lock when creating a tutor's slots.
        await db.$queryRaw`SELECT id FROM users WHERE id = ${tutor.id} FOR UPDATE`;
        const existingSlots = await db.tutorSlot.findMany({
          where: {
            tutorId: tutor.id,
            startsAt: { lt: windowEnd },
            endsAt: { gt: firstStart },
          },
        });
        const slots = [];
        for (let day = 0; day < dayCount; day++) {
          for (let hour = 0; hour < slotsPerDay; hour++) {
            const startsAt = new Date(
              firstStart.getTime() + (day * 24 + hour) * hourMs,
            );
            const endsAt = new Date(startsAt.getTime() + hourMs);
            const overlaps = existingSlots.some(
              (slot) => slot.startsAt < endsAt && slot.endsAt > startsAt,
            );
            if (overlaps) continue;
            slots.push({
              tutorId: tutor.id,
              startsAt,
              endsAt,
              price: tutor.price,
            });
          }
        }
        const result = await db.tutorSlot.createMany({
          data: slots,
          skipDuplicates: true,
        });
        createdSlots += result.count;
      }
      await db.paymentConfig.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1 },
      });
      return seededUsers;
    },
    { timeout: 60000 },
  );

  const baseUrl = process.env.FRONTEND_URL || "http://127.0.0.1:3000";
  const roles = { student: "Học viên", tutor: "Gia sư", admin: "Admin" };
  for (const user of users) {
    const url = new URL("/bookings", baseUrl);
    url.searchParams.set("as", String(user.id));
    console.log(`${roles[user.role]} ${user.id} - ${user.name} | ${url}`);
  }
  const students = users.filter((user) => user.role === "student");
  const tutors = users.filter((user) => user.role === "tutor");
  console.log(
    `Demo ready: ${students.length} students, ${tutors.length} tutors, ${createdMatches} new matches, ${createdSlots} new slots.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
