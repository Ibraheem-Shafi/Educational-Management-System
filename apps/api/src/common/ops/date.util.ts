import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function parseYmd(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return date;
}

export function toYmd(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export function toIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

export function asNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

export function containsSearch(search: string | undefined, fields: string[]) {
  const term = search?.trim();
  if (!term) return {};
  return {
    OR: fields.map((field) => ({ [field]: { contains: term, mode: 'insensitive' as const } })),
  };
}
