import { Router } from "express";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const USERS_FILE = path.join(__dirname, "../Storage/UserStorage.json");
const PROPERTY_FILE = path.join(__dirname, "../Storage/PropertyStorage.json");
const BOOKING_FILE = path.join(__dirname, "../Storage/BookingStorage.json");
const NOTIFICATION_FILE = path.join(__dirname, "../Storage/NotificationStorage.json");
const COMPLAINT_FILE = path.join(__dirname, "../Storage/ComplaintsStorage.json");

// ==================== HELPER FUNCTIONS ====================

const readJSON = (filePath) => {
  try {
    const data = readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading", filePath, err.message);
    return null;
  }
};

const writeJSON = (filePath, data) => {
  try {
    writeFileSync(filePath, JSON.stringify(data, null, 4), "utf8");
  } catch (err) {
    console.error("Error writing", filePath, err.message);
  }
};

// ==================== USER MANAGEMENT ROUTES ====================

// Get all users with filters
router.get("/users", (req, res) => {
  try {
    const { status, role, search } = req.query;

    const data = readJSON(USERS_FILE);
    if (!data || !data.Users) {
      return res.status(500).json({ success: false, message: "Failed to read users" });
    }

    let users = data.Users;

    // Filter by role
    if (role) {
      users = users.filter(u => u.role && u.role.toLowerCase() === role.toLowerCase());
    }

    // Search by username, email, or phone
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(u =>
        (u.username && u.username.toLowerCase().includes(searchLower)) ||
        (u.email && u.email.toLowerCase().includes(searchLower)) ||
        (u.phone && u.phone.includes(search))
      );
    }

    // Remove passwords from response
    const usersResponse = users.map(u =>
    (
      {
        userId: u.userId,
        username: u.username,
        userMail: u.email,
        userPhone: u.phone,
        userRole: u.role,
        userStatus: u.status,
      }
    )
    );

    res.json({
      success: true,
      count: usersResponse.length,
      data: usersResponse
    });
  } catch (error) {
    console.error("Error in /users:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get user by ID
router.get("/users/:id", (req, res) => {
  try {
    const { id } = req.params;
    const data = readJSON(USERS_FILE);

    if (!data || !data.Users) {
      return res.status(500).json({ success: false, message: "Failed to read users" });
    }

    const user = data.Users.find(u => u.userId === parseInt(id));

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Remove password from response
    const userResponse = {
      userId: user.userId,
      username: user.username,
      userMail: user.email,
      userPhone: user.phone,
      userRole: user.role,
      userStatus: user.status,
    };

    res.json({
      success: true,
      data: userResponse
    });
  } catch (error) {
    console.error("Error in /users/:id:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Block/Unblock user
router.put("/users/:id/block", (req, res) => {
  try {
    const { id } = req.params;
    const { block } = req.body;

    if (block === undefined) {
      return res.status(400).json({ success: false, message: "Block status is required" });
    }

    const data = readJSON(USERS_FILE);
    if (!data || !data.Users) {
      return res.status(500).json({ success: false, message: "Failed to read users" });
    }

    const userIndex = data.Users.findIndex(u => u.userId === parseInt(id));

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Update user status
    data.Users[userIndex].status = block ? "Blocked" : "Active";
    writeJSON(USERS_FILE, data);

    const updated = data.Users[userIndex];
    const userResponse = {
      userId: updated.userId,
      username: updated.username,
      userMail: updated.email,
      userPhone: updated.phone,
      userRole: updated.role,
      userStatus: updated.status,
    };

    res.json({
      success: true,
      message: `User ${block ? 'blocked' : 'unblocked'} successfully`,
      data: userResponse
    });
  } catch (error) {
    console.error("Error in /users/:id/block:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Delete user (soft delete)
router.delete("/users/:id", (req, res) => {
  try {
    const { id } = req.params;
    const data = readJSON(USERS_FILE);

    if (!data || !data.Users) {
      return res.status(500).json({ success: false, message: "Failed to read users" });
    }

    const userIndex = data.Users.findIndex(u => u.userId === parseInt(id));

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Soft delete by changing status
    data.Users[userIndex].status = "DELETED";
    writeJSON(USERS_FILE, data);

    res.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    console.error("Error in DELETE /users/:id:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ==================== PROPERTY MANAGEMENT ROUTES ====================

// Get all properties with filters
router.get("/properties", (req, res) => {
  try {
    const { status, city, minPrice, maxPrice, hasWifi, hasParking, hasPool, search } = req.query;

    const data = readJSON(PROPERTY_FILE);
    if (!data || !data.properties) {
      return res.status(500).json({ success: false, message: "Failed to read properties" });
    }

    let properties = data.properties;

    // Filter by status
    if (status) {
      properties = properties.filter(p =>
        p.propertyStatus && p.propertyStatus.toLowerCase() === status.toLowerCase()
      );
    }

    // Filter by city
    if (city) {
      properties = properties.filter(p =>
        p.address && p.address.city &&
        p.address.city.toLowerCase().includes(city.toLowerCase())
      );
    }

    // Filter by price range
    if (minPrice) {
      properties = properties.filter(p =>
        (p.pricePerDay || p.pricePreDay || 0) >= parseFloat(minPrice)
      );
    }
    if (maxPrice) {
      properties = properties.filter(p =>
        (p.pricePerDay || p.pricePreDay || 0) <= parseFloat(maxPrice)
      );
    }

    // Filter by amenities
    if (hasWifi === 'true') {
      properties = properties.filter(p => p.hasWifi === true);
    }
    if (hasParking === 'true') {
      properties = properties.filter(p => p.hasParking === true);
    }
    if (hasPool === 'true') {
      properties = properties.filter(p => p.hasPool === true);
    }

    // Search by property name or description
    if (search) {
      const searchLower = search.toLowerCase();
      properties = properties.filter(p =>
        (p.propertyName && p.propertyName.toLowerCase().includes(searchLower)) ||
        (p.propertyDescription && p.propertyDescription.toLowerCase().includes(searchLower))
      );
    }

    res.json({
      success: true,
      count: properties.length,
      data: properties
    });
  } catch (error) {
    console.error("Error in /properties:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get property by ID
router.get("/properties/:id", (req, res) => {
  try {
    const { id } = req.params;
    const data = readJSON(PROPERTY_FILE);

    if (!data || !data.properties) {
      return res.status(500).json({ success: false, message: "Failed to read properties" });
    }

    const property = data.properties.find(p => p.propertyId === parseInt(id));

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    res.json({
      success: true,
      data: property
    });
  } catch (error) {
    console.error("Error in /properties/:id:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ==================== BOOKING MANAGEMENT ROUTES ====================

// Get all bookings with filters
router.get("/bookings", (req, res) => {
  try {
    const { status, userId, propertyId } = req.query;

    const data = readJSON(BOOKING_FILE);
    if (!data || !data.bookings) {
      return res.status(500).json({ success: false, message: "Failed to read bookings" });
    }

    let bookings = data.bookings;

    // Filter by status
    if (status) {
      bookings = bookings.filter(b => b.bookingStatus === (status === 'true'));
    }

    // Filter by user
    if (userId) {
      bookings = bookings.filter(b => b.userId === parseInt(userId));
    }

    // Filter by property
    if (propertyId) {
      bookings = bookings.filter(b => b.propertyId === parseInt(propertyId));
    }

    res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error("Error in /bookings:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get booking by ID
router.get("/bookings/:id", (req, res) => {
  try {
    const { id } = req.params;
    const data = readJSON(BOOKING_FILE);

    if (!data || !data.bookings) {
      return res.status(500).json({ success: false, message: "Failed to read bookings" });
    }

    const booking = data.bookings.find(b => b.bookingId === parseInt(id));

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error("Error in /bookings/:id:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ==================== NOTIFICATION MANAGEMENT ROUTES ====================

// Get all notifications with filters
router.get("/notifications", (req, res) => {
  try {
    const { userId } = req.query;

    const data = readJSON(NOTIFICATION_FILE);
    if (!data || !data.notifications) {
      return res.status(500).json({ success: false, message: "Failed to read notifications" });
    }

    let notifications = data.notifications;

    // Filter by user
    if (userId) {
      notifications = notifications.filter(n =>
        n.userId === parseInt(userId) || n.notificationTarget === 'ALL'
      );
    }

    res.json({
      success: true,
      count: notifications.length,
      data: notifications
    });
  } catch (error) {
    console.error("Error in /notifications:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Create notification
router.post("/notifications", (req, res) => {
  try {
    const {
      notificationTitle,
      notificationMessage,
      notificationType,
      notificationTarget,
      userId
    } = req.body;

    if (!notificationTitle || !notificationMessage || !notificationType || !notificationTarget) {
      return res.status(400).json({
        success: false,
        message: "Title, message, type, and target are required"
      });
    }

    const data = readJSON(NOTIFICATION_FILE);
    if (!data) {
      return res.status(500).json({ success: false, message: "Failed to read notifications" });
    }

    if (!data.notifications) {
      data.notifications = [];
    }

    const newNotification = {
      notificationId: data.notifications.length > 0
        ? Math.max(...data.notifications.map(n => n.notificationId || 0)) + 1
        : 1,
      notificationTitle,
      notificationMessage,
      notificationType,
      notificationTarget,
      notificationCreatedOn: new Date().toISOString(),
      notificationIsRead: false,
      userId: userId ? parseInt(userId) : null
    };

    data.notifications.push(newNotification);
    writeJSON(NOTIFICATION_FILE, data);

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: newNotification
    });
  } catch (error) {
    console.error("Error in POST /notifications:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ==================== COMPLAINT MANAGEMENT ROUTES ====================

// Get all complaints with filters
router.get("/complaints", (req, res) => {
  try {
    const { status, type, userId } = req.query;

    const data = readJSON(COMPLAINT_FILE);
    if (!data || !data.complaints) {
      return res.status(500).json({ success: false, message: "Failed to read complaints" });
    }

    let complaints = data.complaints;

    // Filter by status
    if (status) {
      complaints = complaints.filter(c =>
        c.complaintStatus && c.complaintStatus.toLowerCase() === status.toLowerCase()
      );
    }

    // Filter by type
    if (type) {
      complaints = complaints.filter(c =>
        c.complaintType && c.complaintType.toLowerCase() === type.toLowerCase()
      );
    }

    // Filter by user
    if (userId) {
      complaints = complaints.filter(c => c.userId === parseInt(userId));
    }

    res.json({
      success: true,
      count: complaints.length,
      data: complaints
    });
  } catch (error) {
    console.error("Error in /complaints:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get complaint by ID
router.get("/complaints/:id", (req, res) => {
  try {
    const { id } = req.params;
    const data = readJSON(COMPLAINT_FILE);

    if (!data || !data.complaints) {
      return res.status(500).json({ success: false, message: "Failed to read complaints" });
    }

    const complaint = data.complaints.find(c => c.complaintId === parseInt(id));

    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    res.json({
      success: true,
      data: complaint
    });
  } catch (error) {
    console.error("Error in /complaints/:id:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Update complaint status
router.put("/complaints/:id/status", (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    const validStatuses = ['PENDING', 'ACTIVE', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({ success: false, message: "Invalid complaint status" });
    }

    const data = readJSON(COMPLAINT_FILE);
    if (!data || !data.complaints) {
      return res.status(500).json({ success: false, message: "Failed to read complaints" });
    }

    const complaintIndex = data.complaints.findIndex(c => c.complaintId === parseInt(id));

    if (complaintIndex === -1) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    data.complaints[complaintIndex].complaintStatus = status.toUpperCase();
    writeJSON(COMPLAINT_FILE, data);

    res.json({
      success: true,
      message: "Complaint status updated successfully",
      data: data.complaints[complaintIndex]
    });
  } catch (error) {
    console.error("Error in PUT /complaints/:id/status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Delete property (soft delete)
router.delete("/properties/:id", (req, res) => {
  try {
    const { id } = req.params;
    const data = readJSON(PROPERTY_FILE);

    if (!data || !data.properties) {
      return res.status(500).json({ success: false, message: "Failed to read properties" });
    }

    const propertyIndex = data.properties.findIndex(p => p.propertyId === parseInt(id));

    if (propertyIndex === -1) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    // Soft delete by changing status
    data.properties[propertyIndex].propertyStatus = "DELETED";
    writeJSON(PROPERTY_FILE, data);

    res.json({
      success: true,
      message: "Property deleted successfully"
    });
  } catch (error) {
    console.error("Error in DELETE /properties/:id:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;