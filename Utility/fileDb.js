import { promises as fs } from 'node:fs';
import path from "path";
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROPERTIY_FILE = path.join(__dirname, "../Storage/PropertyStorage.json");
const USERS_FILE = path.join(__dirname, "../Storage/UserStorage.json");
const BOOKINGS_FILE = path.join(__dirname, "../Storage/BookingStorage.json");

export async function readJson(name) {
  try {
    if (name === "properties.json") {
      const data = await fs.readFile(PROPERTIY_FILE, "utf8");
      const parsed = JSON.parse(data);
      return parsed;
    }
    if (name === "bookings.json") {
      const data = await fs.readFile(BOOKINGS_FILE, "utf8");
      const parsed = JSON.parse(data);
      return parsed;
    }
    if (name === "users.json") {
      const data = await fs.readFile(USERS_FILE, "utf8");
      const parsed = JSON.parse(data);
      return parsed;
    }
  } catch (e) {
    // if file missing or invalid, return a safe default structure depending on filename
    if (name === "properties.json") return { properties: [] };
    if (name === "bookings.json") return { bookings: [] };
    if (name === "users.json") return { users: [] };
    return {};
  }
}

export async function writeJson(name, data) {
  if (name === "properties.json") {
    await fs.writeFile(PROPERTIY_FILE, JSON.stringify(data, null, 2));
  }
  if (name === "bookings.json") {
    await fs.writeFile(BOOKINGS_FILE, JSON.stringify(data, null, 2));
  }
  if (name === "users.json") {
    await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2));
  }
}

