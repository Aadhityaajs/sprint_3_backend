import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const STORAGE_FILE = path.join(__dirname, '../Storage/complaintsStorage.json');
export const STORAGE_DIR = path.dirname(STORAGE_FILE);

let writeQueue = Promise.resolve();

/**
 * Ensures the storage file exists and contains a valid object with complaints array.
 */
export async function ensureStorageFile() {
    try {
        await fs.mkdir(STORAGE_DIR, { recursive: true });
        let stat;
        try {
            stat = await fs.stat(STORAGE_FILE);
        } catch (err) {
            // file doesn't exist -> create
            await fs.writeFile(STORAGE_FILE, JSON.stringify({ complaints: [] }, null, 2), 'utf8');
            return;
        }

        // If file size is zero or empty, initialize
        if (stat.size === 0) {
            await fs.writeFile(STORAGE_FILE, JSON.stringify({ complaints: [] }, null, 2), 'utf8');
            return;
        }

        // Try to parse to confirm valid JSON
        const raw = await fs.readFile(STORAGE_FILE, 'utf8');
        try {
            const obj = JSON.parse(raw);
            if (!obj || !Array.isArray(obj.complaints)) {
                await fs.writeFile(STORAGE_FILE, JSON.stringify({ complaints: [] }, null, 2), 'utf8');
            }
        } catch (err) {
            // invalid JSON -> reset
            await fs.writeFile(STORAGE_FILE, JSON.stringify({ complaints: [] }, null, 2), 'utf8');
        }
    } catch (err) {
        throw err;
    }
}

/**
 * Read storage (returns object with complaints array)
 */
export async function readStorage() {
    await ensureStorageFile();
    const raw = await fs.readFile(STORAGE_FILE, 'utf8');
    const obj = JSON.parse(raw);
    if (!obj.complaints) obj.complaints = [];
    return obj;
}

/**
 * Write storage safely (atomic rename) using a simple in-process queue to avoid overlapping writes.
 * @param {Object} data
 */
export async function writeStorage(data) {
    // queue writes
    writeQueue = writeQueue.then(async () => {
        await ensureStorageFile();
        const tmp = STORAGE_FILE + '.tmp';
        const content = JSON.stringify(data, null, 2);
        await fs.writeFile(tmp, content, 'utf8');
        await fs.rename(tmp, STORAGE_FILE);
    }).catch((err) => {
        console.error('Storage write error:', err);
        throw err;
    });
    return writeQueue;
}

/**
 * Returns next complaintId (numeric) by scanning existing rows.
 */
export async function getNextComplaintId() {
    const storage = await readStorage();
    const complaints = storage.complaints || [];
    const max = complaints.reduce((m, c) => Math.max(m, Number(c.complaintId) || 0), 0);
    return max + 1;
}