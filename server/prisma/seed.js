// Dữ liệu mẫu để test chat. Chạy: npm run db:seed (chạy lại nhiều lần không bị nhân đôi)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const avatar = (photo) => `https://images.unsplash.com/${photo}?w=100&h=100&fit=crop&crop=faces`;

const users = [
  { email: 'an.student@mindmatch.test', name: 'Nguyễn Văn An', role: 'student', avatar: avatar('photo-1500648767791-00dcc994a43e') },
  { email: 'tuan.tutor@mindmatch.test', name: 'Thầy Hoàng Tuấn', role: 'tutor', avatar: avatar('photo-1534528741775-53994a69daeb') },
  { email: 'linh.tutor@mindmatch.test', name: 'Cô Mai Linh', role: 'tutor', avatar: avatar('photo-1494790108377-be9c29b29330') },
  { email: 'duc.tutor@mindmatch.test', name: 'Anh Minh Đức', role: 'tutor', avatar: avatar('photo-1507003211169-0a1dd7228f2d') },
];

const conversations = [
  { tutor: 'duc.tutor@mindmatch.test', messages: [] },
  {
    tutor: 'linh.tutor@mindmatch.test',
    messages: [
      ['student', 'Cô ơi cô xem bài luận giúp em chưa ạ?', true],
      ['tutor', 'Bài tập Writing Task 2 cô đã sửa xong rồi nha.', true],
    ],
  },
  {
    tutor: 'tuan.tutor@mindmatch.test',
    messages: [
      ['tutor', 'Chào em, tối mai 19h học được không?', true],
      ['student', 'Dạ được ạ, em chuẩn bị sẵn bài tập rồi thầy.', true],
      ['tutor', 'Hẹn em 19h tối mai học qua Zoom nhé!', false],
    ],
  },
];

async function main() {
  const byEmail = {};
  for (const u of users) {
    byEmail[u.email] = await prisma.user.upsert({ where: { email: u.email }, update: u, create: u });
  }
  const student = byEmail['an.student@mindmatch.test'];

  for (const c of conversations) {
    const tutor = byEmail[c.tutor];
    const conversation = await prisma.conversation.upsert({
      where: { studentId_tutorId: { studentId: student.id, tutorId: tutor.id } },
      update: {},
      create: { studentId: student.id, tutorId: tutor.id },
    });
    if (await prisma.message.count({ where: { conversationId: conversation.id } })) continue;

    for (const [from, content, isRead] of c.messages) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: from === 'student' ? student.id : tutor.id,
          content,
          isRead,
        },
      });
    }
    await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
  }

  console.log('Users:', Object.values(byEmail).map((u) => `${u.id}=${u.name}`).join(', '));
}

main().finally(() => prisma.$disconnect());
