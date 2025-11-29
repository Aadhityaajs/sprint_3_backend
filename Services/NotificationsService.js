import { Router } from "express";
import { readNotificationStorage, getNextNotificationId, writeNotificationStorage } from '../Utility/notificationHandler.js';
const router = Router();

function todayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ---------------------------
// GET ALL NOTIFICATIONS
// ---------------------------
router.get("/", async (req, res) => {
  try {
    const storage = await readNotificationStorage();
    res.json(storage);
  } catch (err) {
    res.status(500).json({ error: "Failed to read notifications" });
  }
});

// ---------------------------
// CREATE A NOTIFICATION
// ---------------------------
router.post("/", async (req, res) => {
  try {
    const {
      userId,
      notificationTitle,
      message,
      notificationType,
      target,
      createdBy
    } = req.body;

    if (!userId || !notificationTitle || !message) {
      return res.status(400).json({
        error: "userId, notificationTitle, and message are required"
      });
    }

    const storage = await readNotificationStorage();
    const notificationId = await getNextNotificationId();

    const newNotification = {
      notificationId,
      userId: Number(userId),
      notificationTitle: String(notificationTitle),
      message: String(message),
      notificationType: notificationType || "general",
      target: target || "",
      createdBy: createdBy || `user-${userId}`,
      createdon: todayYMD(),
      isRead: false,
      readOn: ""
    };

    storage.notification.unshift(newNotification);
    await writeNotificationStorage(storage);

    res.status(201).json(newNotification);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save notification" });
  }
});

// ---------------------------
// MARK AS READ
// ---------------------------
router.put("/:id/read", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const storage = await readNotificationStorage();

    const notif = storage.notification.find(n => n.notificationId === id);

    if (!notif)
      return res.status(404).json({ error: "Notification not found" });

    notif.isRead = true;
    notif.readOn = todayYMD();

    await writeNotificationStorage(storage);
    res.json({ message: "Marked as read", data: notif });
  } catch (err) {
    res.status(500).json({ error: "Failed to update notification" });
  }
});

// ---------------------------
// DELETE NOTIFICATION
// ---------------------------
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const storage = await readNotificationStorage();
    storage.notification = storage.notification.filter(
      n => n.notificationId !== id
    );

    await writeNotificationStorage(storage);

    res.json({ message: "Notification deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

export default router;
