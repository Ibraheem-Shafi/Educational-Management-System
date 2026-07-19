/**
 * Re-export common field schemas used across create/update DTOs.
 * Import these in schema files instead of raw z.string() for consistent messages.
 */
export {
  MSG,
  requiredId,
  requiredString,
  optionalString,
  optionalEmail,
  optionalPhone,
  requiredPhone,
  optionalCnic,
  requiredCnic,
  optionalPositiveNumber,
  requiredPositiveNumber,
} from './messages';
