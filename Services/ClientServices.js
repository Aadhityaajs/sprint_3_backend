import axios from "axios";
import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_FILE = path.join(__dirname, "../Storage/UserStorage.json");
const PROPERTY_FILE = path.join(__dirname, "../Storage/PropertyStorage.json");
const BOOKING_FILE = path.join(__dirname, "../Storage/BookingStorage.json");

const banking_url = "http://10.23.244.173:5000/api/transaction/external";

// ---------------- JSON HELPERS ----------------
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    console.error("Error reading", filePath, err.message);
    return {};
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ---------- PROPERTY ROUTES ----------
router.post('/getAllProperties', (req, res) => {
  const data = readJSON(PROPERTY_FILE);
  res.json(data);
});

// ---------- PAYMENT ROUTE ----------
router.post("/makePayment", async (req, res) => {
  try {
    const { cardNumber, cvv } = req.body;

    const data = {
      "amount": 2500,
      "merchant": {
        "identifier": "spacefinders-account1",
        "identifierType": "account_id",
        "name": "SpaceFinders"
      },
      "paymentMethod": {
        "type": "card",
        "details": {
          "cardNumber": cardNumber.replaceAll(" ", ""),
          "cvv": cvv,
          "expiry": "2035-11-25",
          "pin": "1224"
        }
      },
      "orderId": "Roomdemodemoneoneofnfoenfoenfoefno",
      "description": "Dummy-Room Transaction"
    };

    const bankResponse = await axios.post(banking_url, data, {
      headers: { "Content-Type": "application/json" }
    });

    if (bankResponse.status >= 200 && bankResponse.status < 300) {
      return res.status(200).send("Payment successful");
    } else {
      return res.status(400).send("Payment failed");
    }
  } catch (err) {
    console.log("Payment error:", err.message);
    return res.status(400).send("Payment failed");
  }
});

// ---------- PROPERTY ROUTES ----------
router.get("/properties", (req, res) => {
  const data = readJSON(PROPERTY_FILE);
  console.log("data: ", data);
  console.log("data.properties: ", data.properties);
  console.log("data.properties || []: ", data.properties || [])
  res.json(data.properties || []);
});

router.get("/properties/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const data = readJSON(PROPERTY_FILE);
  const property = (data.properties || []).find(p => p.propertyId === id);

  if (!property) return res.status(404).json({ message: "Property not found" });

  res.json(property);
});

// ---------- USERS ----------
router.get("/users", (req, res) => {
  const data = readJSON(USERS_FILE);
  res.json(data.users || []);
});

// ---------- BOOKINGS ----------
router.get("/bookings", (req, res) => {
  const data = readJSON(BOOKING_FILE);
  res.json(data.bookings || []);
});

router.post("/bookings", (req, res) => {
  const data = readJSON(BOOKING_FILE);
  const bookings = data.bookings || [];
  const newBooking = req.body;

  if (!newBooking.propertyId || !newBooking.checkInDate || !newBooking.checkOutDate)
    return res.status(400).json({ message: "Missing propertyId / checkInDate / checkOutDate" });

  const ci = new Date(newBooking.checkInDate);
  const co = new Date(newBooking.checkOutDate);

  if (isNaN(ci) || isNaN(co))
    return res.status(400).json({ message: "Invalid dates" });

  const hasOverlap = bookings.some(b => {
    if (b.propertyId !== newBooking.propertyId) return false;

    const bci = new Date(b.checkInDate);
    const bco = new Date(b.checkOutDate);

    return ci <= bco && bci <= co;
  });

  if (hasOverlap)
    return res.status(400).json({ message: "Property already booked for selected dates" });

  newBooking.bookingId = newBooking.bookingId || Date.now();

  bookings.push(newBooking);
  writeJSON(BOOKING_FILE, { bookings });

  res.json({ message: "Booking saved", booking: newBooking });
});

router.delete("/bookings/:id", (req, res) => {
  const id = parseInt(req.params.id);

  const data = readJSON(BOOKING_FILE);
  const bookings = data.bookings || [];

  const filtered = bookings.filter(b => b.bookingId !== id);

  writeJSON(BOOKING_FILE, { bookings: filtered });
  res.json({ message: "Booking deleted" });
});

export default router;
