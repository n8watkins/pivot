import { defaultNotificationPreference, readNotificationPreference } from "./notifications";
import { ensureSession, getDatabase, initializeDatabase } from "./session";

export async function readCurrentNotificationPreference() {
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (!db) return defaultNotificationPreference;
  await initializeDatabase();
  return readNotificationPreference(db, sessionId);
}
