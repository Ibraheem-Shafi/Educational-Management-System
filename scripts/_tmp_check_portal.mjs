import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const parent = await prisma.parent.findFirst({
  where: { email: 'rashid.ahmad@nexium.edu.pk', deletedAt: null },
  include: { studentParents: { include: { student: { select: { fullName: true } } } } },
});
console.log('parent:', parent?.fullName, 'children:', parent?.studentParents.map((sp) => sp.student.fullName));

const student = await prisma.student.findFirst({
  where: { email: 'ali.khan@nexium.edu.pk', deletedAt: null },
  select: { fullName: true, branchId: true },
});
console.log('student:', student);

await prisma.$disconnect();
