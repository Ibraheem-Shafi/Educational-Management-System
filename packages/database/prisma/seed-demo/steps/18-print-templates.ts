import type { PrismaClient } from '@prisma/client';
import {
  DEFAULT_PRINT_TEMPLATE_FIELDS,
  DEFAULT_PRINT_TEMPLATE_NAMES,
  printDocumentTypes,
} from '@eims/shared';

export async function seedPrintTemplates(prisma: PrismaClient): Promise<void> {
  for (const type of printDocumentTypes) {
    const existing = await prisma.printDocumentTemplate.findFirst({
      where: { type, branchId: null },
    });
    const data = {
      name: DEFAULT_PRINT_TEMPLATE_NAMES[type],
      paperSize: type === 'id_card' ? 'a5' : type === 'fee_receipt' ? 'thermal80' : 'a4',
      fields: DEFAULT_PRINT_TEMPLATE_FIELDS[type],
      headerText: null as string | null,
      footerText: null as string | null,
      extraNote:
        type === 'fee_invoice'
          ? 'Please pay by the due date at the campus accounts office or via the online portal.'
          : null,
      isActive: true,
    };
    if (existing) {
      await prisma.printDocumentTemplate.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.printDocumentTemplate.create({
        data: { type, branchId: null, ...data },
      });
    }
  }
}
