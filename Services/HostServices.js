import express from 'express';
import cors from 'cors';
import { viewAllProperties, viewDeletedProperties, viewPropertyById, addProperty, updateProperty, deleteProperty, viewBookings, revenue } from './Controller/HostController.js'

const router = express();

router.use(cors());
router.use(express.json());

const base = "/api/host";

router.get("/properties/:userId", viewAllProperties);
router.get("/properties/deleted/:userId", viewDeletedProperties);
router.get("/viewPropertyById/:propertyId", viewPropertyById); // single property
router.post("/property", addProperty);
router.put("/updateProperty", updateProperty);
router.delete("/deleteProperty/:propertyId", deleteProperty);
router.get("/bookings/:userId", viewBookings);
router.get("/revenue/:userId", revenue); 

export default router;