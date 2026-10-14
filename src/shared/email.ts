const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Emails are matched after trimming spaces and lowercasing. Nothing else is
 * folded (no Gmail dot or plus-tag rules), so two real people never merge.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}
