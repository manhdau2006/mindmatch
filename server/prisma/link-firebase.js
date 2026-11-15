import "dotenv/config";
import { prisma } from "../src/db.js";

// Explicit mapping by the team/admin. Roles remain database-owned.
const [email, firebaseUid] = process.argv.slice(2);
if (!email || !firebaseUid)
  throw new Error(
    "Dùng: node prisma/link-firebase.js <backend-email> <firebase-uid>",
  );
try {
  const user = await prisma.user.update({
    where: { email },
    data: { firebaseUid },
  });
  console.log(`Đã ánh xạ Firebase UID với User ${user.id} (${user.role})`);
} finally {
  await prisma.$disconnect();
}
