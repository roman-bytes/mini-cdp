/**
 * Every table and view in the database, gathered from the app that owns it.
 * Drizzle reads this file to generate migrations (`npm run db:generate`).
 */
export * from "@/apps/assistant/schema";
export * from "@/apps/mobile/schema";
export * from "@/apps/newsletter/schema";
export * from "@/apps/people/profiles-view";
export * from "@/apps/people/schema";
export * from "@/apps/web/schema";
export * from "@/shared/auth/schema";
export * from "@/shared/raw/schema";
