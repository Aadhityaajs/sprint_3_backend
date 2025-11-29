import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const STORAGE_FILE = path.join(__dirname, '../Storage/NotificationStorage.json');
export const STORAGE_DIR = path.dirname(STORAGE_FILE);

let writeQueue = Promise.resolve();

export async function ensureStorageFile() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });

  try {
    const stat = await fs.stat(STORAGE_FILE);

    if (stat.size === 0) {
      await fs.writeFile(STORAGE_FILE, JSON.stringify({ notification: [] }, null, 2));
    } else {
      const raw = await fs.readFile(STORAGE_FILE, "utf8");
      try {
        const obj = JSON.parse(raw);
        if (!obj.notification || !Array.isArray(obj.notification)) {
          await fs.writeFile(STORAGE_FILE, JSON.stringify({ notification: [] }, null, 2));
        }
      } catch {
        await fs.writeFile(STORAGE_FILE, JSON.stringify({ notification: [] }, null, 2));
      }
    }
  } catch {
    await fs.writeFile(STORAGE_FILE, JSON.stringify({ notification: [] }, null, 2));
  }
}

export async function readNotificationStorage() {
  await ensureStorageFile();
  const raw = await fs.readFile(STORAGE_FILE, "utf8");
  const obj = JSON.parse(raw);
  if (!obj.notification) obj.notification = [];
  return obj;
}

export async function writeNotificationStorage(data) {
  writeQueue = writeQueue.then(async () => {
    await ensureStorageFile();
    const tmp = STORAGE_FILE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(data, null, 2));
    await fs.rename(tmp, STORAGE_FILE);
  });
  return writeQueue;
}

// Auto-generate incremental ID
export async function getNextNotificationId() {
  const storage = await readNotificationStorage();
  const rows = storage.notification;
  const max = rows.reduce((m, n) => Math.max(m, Number(n.notificationId) || 0), 0);
  return max + 1;
}

