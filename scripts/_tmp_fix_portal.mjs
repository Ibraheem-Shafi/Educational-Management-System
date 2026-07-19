import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const cfg = JSON.parse(
  fs.readFileSync(path.resolve('docs/templates/nexium.demo.json'), 'utf-8'),
);

let parentUpdates = 0;
for (const p of cfg.parents) {
  if (!p.email) continue;
  const existing = await prisma.parent.findFirst({ where: { cnic: p.cnic, deletedAt: null } });
  if (existing && existing.email !== p.email) {
    await prisma.parent.update({ where: { id: existing.id }, data: { email: p.email } });
    console.log(`parent ${existing.fullName}: ${existing.email} -> ${p.email}`);
    parentUpdates++;
  }
}

let studentUpdates = 0;
for (const s of cfg.students) {
  if (!s.email) continue;
  const existing = await prisma.student.findFirst({
    where: {
      OR: [
        { cnicOrBForm: s.cnic },
        { customFields: { path: ['_demoKey'], equals: s.demoKey } },
      ],
      deletedAt: null,
    },
  });
  if (existing && existing.email !== s.email) {
    await prisma.student.update({ where: { id: existing.id }, data: { email: s.email } });
    console.log(`student ${existing.fullName}: ${existing.email} -> ${s.email}`);
    studentUpdates++;
  }
}

console.log(`\nDone. parents updated: ${parentUpdates}, students updated: ${studentUpdates}`);
await prisma.$disconnect();
