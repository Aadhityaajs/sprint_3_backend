import { Router } from "express";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { verifyHashPassword, hashPassword } from "../Utility/encrypt.js";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, "../Storage/UserStorage.json");
const BOOKINGS_FILE = path.join(__dirname, "../Storage/BookingStorage.json");
console.log(USERS_FILE);

// Helper functions
function cleanUsername(name) {
  return name.replace(/\s+/g, "").toLowerCase();
}

function isStrongPassword(password) {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
}

function normalizeIds(users) {
  return users.map((user, index) => ({ ...user, userId: user.userId || Date.now() + index }));
}

const readUsers = () => {
  try {
    const data = readFileSync(USERS_FILE, "utf8");
    let parsed = JSON.parse(data);
    if (parsed.Users) {
      parsed.Users = normalizeIds(parsed.Users);
      writeUsers(parsed);
    }
    return parsed;
  } catch (e) {
    return { Users: [] };
  }
};

const writeUsers = (users) => {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 4), "utf8");
};

/* ---------------- SIGNUP ---------------- */
router.post("/signup", async (request, response) => {
  try {
    let { username, email, phone, address = {}, password, role, securityQuestion, securityAnswer } = request.body;

    if (!username || !password) {
      return response.status(400).json({ success: false, message: "Username & password required" });
    }

    if (!securityQuestion || !securityAnswer) {
      return response.status(400).json({ success: false, message: "Security question required" });
    }

    const cleaned = cleanUsername(username);

    if (!isStrongPassword(password)) {
      return response.status(400).json({
        success: false,
        message: "Weak password. Must be 8 chars incl uppercase, lowercase, number & special"
      });
    }

    const users = readUsers();
    const usersArray = users.Users;

    const existing = usersArray.find(u => u.username === cleaned);
    if (existing) {
      return response.status(400).json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await hashPassword(password);
    const hashedSecurity = await hashPassword(securityAnswer);

    const newUser = {
      userId: Date.now(),
      username: cleaned,
      email: email || "",
      phone: phone || "",
      address: {
        building: address.building || address.buildingNo || "",
        street: address.street || "",
        city: address.city || "",
        pincode: address.pincode || "",
        state: address.state || "",
        country: address.country || "India",
      },
      hashedPassword: hashedPassword,
      status: "Active",
      role: role || "user",
      securityQuestion,
      securityAnswer: hashedSecurity
    };

    usersArray.push(newUser);
    writeUsers({ Users: usersArray });

    return response.json({
      success: true,
      message: "Signup successful",
      user: { username: cleaned, role: newUser.role }
    });
  } catch (err) {
    console.error("/signup err", err);
    return response.status(500).json({ success: false, message: "Server error" });
  }
});

/* ---------------- LOGIN ---------------- */
router.post("/login", async (request, response) => {
  try {
    const { username, password } = request.body;

    if (!username || !password) {
      return response.status(400).json({ success: false, message: "Missing fields" });
    }

    const cleaned = cleanUsername(username);
    const users = readUsers();
    const usersArray = users.Users;

    const user = usersArray.find((u) => u.username === cleaned);

    if (!user) {
      return response.status(400).json({ success: false, message: "Invalid username" });
    }

    if (user.status === "deleted") {
      return response.status(403).json({ success: false, message: "Account deleted" });
    }

    if (user.status === "blocked") {
      return response.status(403).json({ success: false, message: "Account blocked" });
    }

    const isMatch = await verifyHashPassword(password, user.hashedPassword);

    if (!isMatch) {
      return response.status(400).json({ success: false, message: "Incorrect password" });
    }

    const safe = { ...user };
    delete safe.hashedPassword;
    delete safe.securityAnswer;

    return response.json({
      success: true,
      message: "Login successful",
      user: safe
    });
  } catch (err) {
    console.error("/login err", err);
    return response.status(500).json({ success: false, message: "Server error" });
  }
});

/* ---------------- FORGOT PASSWORD -> return question ---------------- */
router.post("/forgot-password", (req, res) => {
  const { username } = req.body;
  const cleaned = cleanUsername(username || "");
  const users = readUsers();
  const usersArray = users.Users;
  const user = usersArray.find(u => u.username === cleaned);

  if (!user) {
    return res.status(400).json({ success: false, message: "User not found" });
  }

  res.json({ success: true, question: user.securityQuestion || "" });
});

/* ---------------- RESET PASSWORD (forgot) ---------------- */
router.post("/reset-password", async (req, res) => {
  try {
    const { username, answer, newPassword } = req.body;
    const cleaned = cleanUsername(username || "");

    let users = readUsers();
    let usersArray = users.Users;
    const idx = usersArray.findIndex(u => u.username === cleaned);

    if (idx === -1) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    const user = usersArray[idx];

    const okAnswer = await verifyHashPassword((answer || "").trim(), user.securityAnswer || "");
    if (!okAnswer) {
      return res.status(400).json({ success: false, message: "Incorrect security answer" });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Weak password. Must be 8 chars incl uppercase, lowercase, number & special"
      });
    }

    // prevent reusing the old password
    const isSameAsOld = await verifyHashPassword(newPassword, user.hashedPassword);
    if (isSameAsOld) {
      return res.status(400).json({ success: false, message: "New password must not be same as old password" });
    }

    usersArray[idx].hashedPassword = await hashPassword(newPassword);
    writeUsers({ Users: usersArray });

    res.json({ success: true, message: "Password reset successful" });
  } catch (err) {
    console.error("/reset-password err", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ---------------- CHANGE PASSWORD (profile) ---------------- */
router.post("/change-password", async (req, res) => {
  try {
    const { username, oldPassword, newPassword } = req.body;

    if (!username || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const cleaned = cleanUsername(username);
    let users = readUsers();
    let usersArray = users.Users;
    const idx = usersArray.findIndex(u => u.username === cleaned);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = usersArray[idx];
    const okOld = await verifyHashPassword(oldPassword, user.hashedPassword);

    if (!okOld) {
      return res.status(400).json({ success: false, message: "Old password incorrect" });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Weak password. Must be 8 chars incl uppercase, lowercase, number & special"
      });
    }

    const isSame = await verifyHashPassword(newPassword, user.hashedPassword);
    if (isSame) {
      return res.status(400).json({ success: false, message: "New password must not be same as old password" });
    }

    usersArray[idx].hashedPassword = await hashPassword(newPassword);
    writeUsers({ Users: usersArray });

    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    console.error("/change-password err", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ---------------- UPDATE (profile) ---------------- */
router.put("/update", async (req, res) => {
  try {
    const updated = req.body;

    if (!updated || !updated.username) {
      return res.status(400).json({ success: false, message: "username required" });
    }

    const cleaned = cleanUsername(updated.username);
    let users = readUsers();
    let usersArray = users.Users;
    const idx = usersArray.findIndex(u => u.username === cleaned);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Don't allow password changes through update - use change-password endpoint
    delete updated.password;
    delete updated.hashedPassword;
    delete updated.securityAnswer;

    // keep status if not provided
    updated.status = updated.status || usersArray[idx].status;

    usersArray[idx] = { ...usersArray[idx], ...updated };
    writeUsers({ Users: usersArray });

    const safe = { ...usersArray[idx] };
    delete safe.hashedPassword;
    delete safe.securityAnswer;

    res.json({ success: true, message: "Profile updated", user: safe });
  } catch (err) {
    console.error("/update err", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ---------------- SOFT DELETE ---------------- */
router.post("/delete", (req, res) => {
  const { username } = req.body;
  const cleaned = cleanUsername(username || "");

  let users = readUsers();
  let usersArray = users.Users;
  const idx = usersArray.findIndex(u => u.username === cleaned);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  usersArray[idx].status = "deleted";
  writeUsers({ Users: usersArray });

  res.json({ success: true, message: "Account soft deleted" });
});

/* ---------------- GET ELIGIBLE BOOKINGS FOR COMPLAINTS ---------------- */
router.get("/eligible-bookings/:userId", (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const userRole = req.header('x-user-role')?.toLowerCase();

    console.log("=== ELIGIBLE BOOKINGS REQUEST ===");
    console.log("User ID:", userId);
    console.log("User Role:", userRole);

    if (!userId || !userRole) {
      return res.status(400).json({ success: false, message: "Missing userId or role" });
    }

    // Read bookings from storage
    const bookingsData = JSON.parse(readFileSync(BOOKINGS_FILE, "utf8"));
    const bookings = bookingsData.bookings || [];
    console.log("Total bookings:", bookings.length);

    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log("Today (Local):", today.toString());

    // Helper to parse "YYYY-MM-DD" as local date
    const parseLocalDate = (dateStr) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d); // Month is 0-indexed
    };

    // Filter bookings based on user role and date criteria
    const eligibleBookings = bookings.filter(booking => {
      // Filter by user role
      const isUserBooking = userRole === 'client'
        ? Number(booking.userId) === userId
        : Number(booking.hostId) === userId;

      if (!isUserBooking) return false;

      // Parse dates as local dates
      const checkIn = parseLocalDate(booking.checkInDate);
      const checkOut = parseLocalDate(booking.checkOutDate);

      // Calculate 7 days after checkout
      const sevenDaysAfterCheckout = new Date(checkOut);
      sevenDaysAfterCheckout.setDate(sevenDaysAfterCheckout.getDate() + 7);

      // Check date criteria:
      // 1. Check-in is today
      // 2. Today is between check-in and check-out
      // 3. Today is within 7 days after check-out

      // Use getTime() for accurate comparison
      const t = today.getTime();
      const ci = checkIn.getTime();
      const co = checkOut.getTime();
      const seven = sevenDaysAfterCheckout.getTime();

      const isCheckInToday = ci === t;
      const isBetweenDates = t >= ci && t <= co;
      const isWithinSevenDaysAfter = t > co && t <= seven;

      const isEligible = isCheckInToday || isBetweenDates || isWithinSevenDaysAfter;

      if (isEligible) {
        console.log(`Booking ${booking.bookingId} is ELIGIBLE:`, {
          checkIn: booking.checkInDate,
          checkOut: booking.checkOutDate,
          reason: isCheckInToday ? 'Check-in Today' : isBetweenDates ? 'Active' : 'Recent'
        });
      }

      return isEligible;
    });

    // Return only booking IDs
    const bookingIds = eligibleBookings.map(b => b.bookingId);
    console.log("Eligible IDs:", bookingIds);

    res.json({
      success: true,
      bookingIds: bookingIds
    });
  } catch (err) {
    console.error("/eligible-bookings err", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;