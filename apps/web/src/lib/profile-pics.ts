/** Gender-based fallback profile photos from `/public/images`. */

const MALE_PROFILE_PICS = [
  '/images/0f082bab6296279a06b37e2adcd7c1bc9b7c3632.jpg',
  '/images/0e2dd88560cca4575ae082984a0f1f6599c18efe.jpg',
  '/images/ac14041ac26bbe5c9695b589b9182e652bf31fb8.jpg',
  '/images/99c43eded20a16e728d814dc14da5c32dfddc0d7.jpg',
  '/images/f388a4c9361d2fe7ef47b1d8f2656b8620c4ba10.jpg',
] as const;

const FEMALE_PROFILE_PICS = [
  '/images/10e1626b5e02a36afc6dadf08e6c001a990dc98e.jpg',
  '/images/a421cc68bfeb162320821eb4560d219a7e4cbe46.jpg',
] as const;

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Picks a stable fallback avatar from the gender pool.
 * Same `seed` (e.g. student id) always returns the same image.
 */
export function getFallbackProfilePic(
  gender: string | null | undefined,
  seed = 'default',
): string {
  const normalized = (gender ?? '').toLowerCase();
  const pool =
    normalized === 'female' || normalized === 'f' ? FEMALE_PROFILE_PICS : MALE_PROFILE_PICS;
  return pool[hashSeed(seed) % pool.length];
}
