import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { buildValidationExceptionBody } from '../utils/validation.util';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  transform(value: unknown) {
    if (!this.schema) return value;
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(buildValidationExceptionBody(result.error));
    }
    return result.data;
  }
}

export function createZodPipe(schema: ZodSchema) {
  return new ZodValidationPipe(schema);
}
