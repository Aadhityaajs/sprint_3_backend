import express from 'express';

const router = express();
import { readStorage, writeStorage, getNextComplaintId } from '../Utility/storageHandler.js';

function todayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Middleware: require x-user-id and x-user-role headers.
 * Attaches req.user = { id: number, role: 'client'|'host'|'admin' }
 */
router.use((req, res, next) => {
  const rawId = req.header('x-user-id');
  const rawRole = req.header('x-user-role');

  if (!rawId || !rawRole) {
    return res.status(400).json({ error: 'Missing x-user-id or x-user-role headers' });
  }
  const id = Number(rawId);
  const role = String(rawRole || '').toLowerCase();

  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid x-user-id header' });
  }
  if (!['client', 'host', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid x-user-role header (must be client|host|admin)' });
  }

  req.user = { id, role };
  next();
});

/**
 * GET /api/complaints
 * Query params (optional): id (number), userType (client|host), from (YYYY-MM-DD), to (YYYY-MM-DD)
 * If no query params provided, returns all complaints.
 */
router.get('/', async (req, res) => {
  try {
    const { id, userType, from, to } = req.query;
    const storage = await readStorage();
    let rows = storage.complaints || [];

    // Filter by exact id if provided
    if (id) {
      const num = Number(id);
      if (Number.isNaN(num)) return res.status(400).json({ error: 'Invalid id query param' });
      rows = rows.filter((r) => Number(r.complaintId) === num);
      return res.json({ complaints: rows });
    }

    // userType filter (client/host)
    if (userType) {
      const ut = String(userType).toLowerCase();
      if (!['client', 'host'].includes(ut)) {
        return res.status(400).json({ error: 'Invalid userType: must be client or host' });
      }
      rows = rows.filter((r) => (r.clientOrHost || '').toLowerCase() === ut);
    }

    // Date range filters (createdOn)
    if (from || to) {
      let fromDate = from ? new Date(from) : null;
      let toDate = to ? new Date(to) : null;
      if (from && isNaN(fromDate)) return res.status(400).json({ error: 'Invalid from date' });
      if (to && isNaN(toDate)) return res.status(400).json({ error: 'Invalid to date' });
      if (toDate) {
        // make end of day inclusive
        toDate.setHours(23, 59, 59, 999);
      }
      rows = rows.filter((r) => {
        const created = new Date(r.createdOn);
        if (fromDate && created < fromDate) return false;
        if (toDate && created > toDate) return false;
        return true;
      });
    }

    return res.json({ complaints: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/complaints
 * Body: { bookingId, complaintDescription }
 * x-user-role must be client or host (admin cannot create)
 * x-user-id is used as the userId (body.userId is ignored)
 */
router.post('/', async (req, res) => {
  try {
    const { id: headerUserId, role } = req.user;

    if (role === 'admin') {
      return res.status(403).json({ error: 'admin users cannot create complaints' });
    }

    const { bookingId, complaintDescription } = req.body || {};

    if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });
    if (!complaintDescription || String(complaintDescription).trim() === '') {
      return res.status(400).json({ error: 'complaintDescription is required' });
    }

    const numericBookingId = Number(bookingId);
    if (Number.isNaN(numericBookingId)) return res.status(400).json({ error: 'bookingId must be a number' });

    const storage = await readStorage();
    const newId = await getNextComplaintId();

    const newComplaint = {
      complaintId: newId,
      bookingId: numericBookingId,
      userId: headerUserId,
      clientOrHost: role, // 'client' or 'host'
      complaintDescription: String(complaintDescription).trim(),
      complaintStatus: 'active', // starts active
      createdOn: todayYMD(),
      resolvedOn: '' // empty until resolved
    };

    storage.complaints.unshift(newComplaint);
    await writeStorage(storage);

    return res.status(201).json(newComplaint);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/complaints/:id/resolve
 * Only admin allowed.
 * Sets complaintStatus = "closed" and resolvedOn = today (YYYY-MM-DD)
 */
router.patch('/:id/resolve', async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'admin') return res.status(403).json({ error: 'Only admin can resolve complaints' });

    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid complaint id' });

    const storage = await readStorage();
    const idx = (storage.complaints || []).findIndex((c) => Number(c.complaintId) === id);
    if (idx === -1) return res.status(404).json({ error: 'Complaint not found' });

    storage.complaints[idx].complaintStatus = 'closed';
    storage.complaints[idx].resolvedOn = todayYMD();

    await writeStorage(storage);
    return res.json(storage.complaints[idx]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/complaints/:id/delete
 * Soft-delete: set complaintStatus = "deleted"
 * Only client/host allowed AND they can only delete **their own** complaints.
 * admin cannot delete per your specification.
 */
router.patch('/:id/delete', async (req, res) => {
  try {
    const { id: headerUserId, role } = req.user;
    if (role === 'admin') {
      return res.status(403).json({ error: 'admin users cannot delete complaints' });
    }

    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid complaint id' });

    const storage = await readStorage();
    const idx = (storage.complaints || []).findIndex((c) => Number(c.complaintId) === id);
    if (idx === -1) return res.status(404).json({ error: 'Complaint not found' });

    const complaint = storage.complaints[idx];

    // ownership check
    if (Number(complaint.userId) !== Number(headerUserId)) {
      return res.status(403).json({ error: 'You can only delete your own complaints' });
    }

    // Soft-delete: set status to deleted; keep resolvedOn untouched
    complaint.complaintStatus = 'deleted';

    await writeStorage(storage);
    return res.json(complaint);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;