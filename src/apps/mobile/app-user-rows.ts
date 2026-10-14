import { isIsoDate } from "@/shared/dates";
import { isValidEmail, normalizeEmail } from "@/shared/email";

/** The columns of app_users.csv. */
export const APP_USER_COLUMNS = ["user_id", "email", "created_at"] as const;

/** One row of app_users.csv, values exactly as written. */
export type RawAppUserRow = Record<(typeof APP_USER_COLUMNS)[number], string>;

/** An app account after cleaning, ready to store. */
export type CleanAppUser = {
  userId: string;
  email: string;
  createdOn: string;
};

export type AppUserCheck =
  | { ok: true; appUser: CleanAppUser }
  | { ok: false; reason: string };

/** Why a row cannot be loaded, or null when it is fine. */
function findProblem(row: RawAppUserRow): string | null {
  if (row.user_id.trim() === "") return "Missing user ID";
  if (!isValidEmail(normalizeEmail(row.email))) return "Invalid email";
  if (!isIsoDate(row.created_at.trim())) return "Invalid created date";
  return null;
}

/** Checks one source row and, when it is usable, returns its cleaned form. */
export function cleanAppUserRow(row: RawAppUserRow): AppUserCheck {
  const problem = findProblem(row);
  if (problem) return { ok: false, reason: problem };

  return {
    ok: true,
    appUser: {
      userId: row.user_id.trim(),
      email: normalizeEmail(row.email),
      createdOn: row.created_at.trim(),
    },
  };
}
