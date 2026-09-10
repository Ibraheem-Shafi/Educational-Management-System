export const APP_ROLES = ['parent', 'student', 'teacher'] as const;
export type AppRole = (typeof APP_ROLES)[number];

const ROLE_ORDER: AppRole[] = ['teacher', 'parent', 'student'];

export function pickAppRole(roles: string[]): AppRole | null {
  return ROLE_ORDER.find((role) => roles.includes(role)) ?? null;
}

export function homeHref(role: AppRole): '/parent/(tabs)' | '/student/(tabs)' | '/teacher/(tabs)' {
  if (role === 'parent') return '/parent/(tabs)';
  if (role === 'student') return '/student/(tabs)';
  return '/teacher/(tabs)';
}

export function portalBase(role: 'parent' | 'student'): 'parent' | 'student' {
  return role;
}
