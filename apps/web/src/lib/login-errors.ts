/** Maps `/login?error=` codes to user-facing copy. */
export const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  parent_portal_disabled:
    'The parent portal is currently disabled. Please contact your school administrator if you need access.',
  student_portal_disabled:
    'The student portal is currently disabled. Please contact your school administrator if you need access.',
};

export function getLoginErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return LOGIN_ERROR_MESSAGES[code] ?? null;
}

/** Errors that mean the user was kicked off a disabled portal — do not auto-resume into it. */
export function isPortalDisabledLoginError(code: string | null | undefined): boolean {
  return code === 'parent_portal_disabled' || code === 'student_portal_disabled';
}
