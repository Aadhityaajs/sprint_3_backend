import { readJson, writeJson } from '../../Utility/fileDb.js'; 

function response(success, message, data = null) {
  return { success, message, data };
}

function isValidISODate(s) {
  if (!s || typeof s !== "string") return false;
  const d = new Date(s);
  return !isNaN(d) && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toISODateOnly(s) {
  if (!isValidISODate(s)) return null;
  return s;
}

// today between start and end (inclusive)
function isDateTodayBetween(start, end) {
  const ts = toISODateOnly(start);
  const te = toISODateOnly(end);
  if (!ts || !te) return false;
  const today = new Date().toISOString().split("T")[0];
  return today >= ts && today <= te;
}

function countNights(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s) || isNaN(e)) return 0;
  const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1;
}

// Accept nested address or flat; produce normalized property object
function normalizePropertyRequest(body) {
  const address = body.address || {
    buildingNo: body.buildingNo || "",
    street: body.street || "",
    city: body.city || "",
    state: body.state || "",
    country: body.country || "",
    postalCode: body.postalCode || body.pincode || body.postal || body.zip || ""
  };

  // tolerate many field name variants
  const noOfRooms = Number(body.noOfRooms ?? body.rooms ?? 1);
  const noOfBathrooms = Number(body.noOfBathrooms ?? body.noOfBathroom ?? body.bathrooms ?? 1);
  const maxNoOfGuests = Number(body.maxNoOfGuests ?? body.maxNumberOfGuest ?? body.maxNumberOfGuest ?? body.maxGuests ?? 1);
  const pricePerDay = Number(body.pricePerDay ?? body.pricePreDay ?? body.priceDay ?? 0);

  return {
    propertyId: Number(body.propertyId || 0),
    userId: Number(body.userId || body.hostId || 1),
    propertyName: body.propertyName || body.propertyTitle || body.name || "",
    propertyDescription: body.propertyDescription || body.description || "",
    noOfRooms,
    noOfBathrooms,
    maxNoOfGuests,
    pricePerDay,
    imageURL: body.imageURL || body.imageUrl || body.image || "",
    propertyAccountNumber: Number(body.propertyAccountNumber || body.accountNumber || 0),
    address,
    hasWifi: !!(body.hasWifi ?? body.hasWIFI),
    hasParking: !!body.hasParking,
    hasPool: !!body.hasPool,
    hasAc: !!(body.hasAc ?? body.hasAC),
    hasHeater: !!body.hasHeater,
    hasPetFriendly: !!body.hasPetFriendly,
    propertyStatus: (body.propertyStatus && String(body.propertyStatus)) || "AVAILABLE",
    propertyRate: Number(body.propertyRating ?? body.propertyRate ?? 0),
    propertyRatingCount: Number(body.propertyRatingCount ?? 0)
  };
}


// ------------------------- VIEW ALL PROPERTIES -----------------------------
export const viewAllProperties = async (req, res) => {
  const userId = Number(req.params.userId);
  const propDB = await readJson("properties.json");

  const list = (propDB.properties || [])
    .filter(p => p.userId === userId && String((p.propertyStatus || "AVAILABLE")).toUpperCase() !== "DELETED")
    .map(p => {
      const addr = p.address || {};
      // flatten address fields for frontend convenience (frontend expects buildingNo, street, city, state, country, postalCode)
      return {
        ...p,
        buildingNo: addr.buildingNo || "",
        street: addr.street || "",
        city: addr.city || "",
        state: addr.state || "",
        country: addr.country || "",
        postalCode: addr.postalCode || addr.pincode || ""
      };
    });

  res.json(response(true, "Loaded", list));
};

// ------------------------- VIEW DELETED PROPERTIES -------------------------
export const viewDeletedProperties = async (req, res) => {
  const userId = Number(req.params.userId);
  const props = await readJson("properties.json");

  const deleted = (props.properties || [])
    .filter(
      p =>
        p.userId === userId &&
        String((p.propertyStatus || "")).toUpperCase() === "DELETED"
    )
    .map(p => {
      const addr = p.address || {};
      return {
        ...p,
        buildingNo: addr.buildingNo || "",
        street: addr.street || "",
        city: addr.city || "",
        state: addr.state || "",
        country: addr.country || "",
        postalCode: addr.postalCode || addr.pincode || ""
      };
    });

  res.json(response(true, "Deleted properties loaded", deleted));
};


// ------------------------- VIEW SINGLE PROPERTY ---------------------------
export const viewPropertyById = async (req, res) => {
  const propertyId = Number(req.params.propertyId);
  const propDB = await readJson("properties.json");

  const prop = (propDB.properties || []).find(p => p.propertyId === propertyId);
  if (!prop) return res.json(response(false, "Property not found"));

  // flatten address
  const addr = prop.address || {};

  const merged = {
    ...prop,
    buildingNo: addr.buildingNo || "",
    street: addr.street || "",
    city: addr.city || "",
    state: addr.state || "",
    country: addr.country || "",
    postalCode: addr.postalCode || addr.pincode || ""
  };

  res.json(response(true, "Property loaded", merged));
};

// ------------------------- ADD PROPERTY ------------------------------------
export const addProperty = async (req, res) => {
  const body = req.body || {};
  const normalized = normalizePropertyRequest(body);

  // server-side validation (same rules)
  if (!normalized.propertyName || normalized.propertyName.length < 5)
    return res.json(response(false, "Property name must be at least 5 chars"));
  if (!normalized.propertyDescription || normalized.propertyDescription.length < 20)
    return res.json(response(false, "Description must be >=20 chars"));
  if (!normalized.noOfRooms || normalized.noOfRooms < 1)
    return res.json(response(false, "Rooms must be >=1"));
  if (!normalized.noOfBathrooms || normalized.noOfBathrooms < 1)
    return res.json(response(false, "Bathrooms must be >=1"));
  if (!normalized.maxNoOfGuests || normalized.maxNoOfGuests < 1)
    return res.json(response(false, "Guests must be >=1"));
  if (!normalized.pricePerDay || normalized.pricePerDay < 100)
    return res.json(response(false, "Price must be >=100"));

  const propDB = await readJson("properties.json");

  // ensure properties array exists
  if (!Array.isArray(propDB.properties)) propDB.properties = [];

  // create property id
  const newPropId = (propDB.properties.length ? propDB.properties.at(-1).propertyId : 0) + 1;

  const newProp = {
    propertyId: newPropId,
    userId: normalized.userId,
    propertyName: normalized.propertyName,
    propertyDescription: normalized.propertyDescription,
    noOfRooms: normalized.noOfRooms,
    noOfBathrooms: normalized.noOfBathrooms,
    maxNoOfGuests: normalized.maxNoOfGuests,
    pricePerDay: normalized.pricePerDay,
    imageURL: normalized.imageURL,
    propertyAccountNumber: normalized.propertyAccountNumber,
    address: {
      buildingNo: normalized.address.buildingNo || "",
      street: normalized.address.street || "",
      city: normalized.address.city || "",
      state: normalized.address.state || "",
      country: normalized.address.country || "",
      postalCode: normalized.address.postalCode || ""
    },
    hasWifi: normalized.hasWifi,
    hasParking: normalized.hasParking,
    hasPool: normalized.hasPool,
    hasAc: normalized.hasAc,
    hasHeater: normalized.hasHeater,
    hasPetFriendly: normalized.hasPetFriendly,
    propertyStatus: (normalized.propertyStatus || "AVAILABLE"),
    propertyRate: normalized.propertyRate || 0,
    propertyRatingCount: normalized.propertyRatingCount || 0
  };

  propDB.properties.push(newProp);
  await writeJson("properties.json", propDB);

  res.json(response(true, "Property Added Successfully", newProp));
};

// ------------------------- UPDATE PROPERTY ----------------------------------
export const updateProperty = async (req, res) => {
  const body = req.body || {};
  const normalized = normalizePropertyRequest(body);

  const propDB = await readJson("properties.json");
  const bookingDB = await readJson("bookings.json");

  if (!Array.isArray(propDB.properties)) propDB.properties = [];

  const prop = propDB.properties.find(p => p.propertyId === Number(normalized.propertyId || body.propertyId || 0));
  if (!prop) return res.json(response(false, "Property not found"));

  // Check if currently booked (today within any booking)
  const todayBookings = (bookingDB.bookings || []).filter(
    b =>
      b.propertyId === prop.propertyId &&
      isDateTodayBetween(b.checkInDate, b.checkOutDate) &&
      b.bookingStatus === true
  );

  if (todayBookings.length > 0) {
    return res.json(
      response(false, "Cannot update: Property is currently booked during this date")
    );
  }

  // update address fields (keep existing if missing)
  prop.address = prop.address || {};
  prop.address.buildingNo = normalized.address.buildingNo || prop.address.buildingNo || "";
  prop.address.street = normalized.address.street || prop.address.street || "";
  prop.address.city = normalized.address.city || prop.address.city || "";
  prop.address.state = normalized.address.state || prop.address.state || "";
  prop.address.country = normalized.address.country || prop.address.country || "";
  prop.address.postalCode = normalized.address.postalCode || prop.address.postalCode || "";

  // update property fields
  prop.propertyName = normalized.propertyName || prop.propertyName;
  prop.propertyDescription = normalized.propertyDescription || prop.propertyDescription;
  prop.noOfRooms = normalized.noOfRooms || prop.noOfRooms;
  prop.noOfBathrooms = normalized.noOfBathrooms || prop.noOfBathrooms;
  prop.maxNoOfGuests = normalized.maxNoOfGuests || prop.maxNoOfGuests;
  prop.pricePerDay = normalized.pricePerDay || prop.pricePerDay;
  prop.imageURL = normalized.imageURL || prop.imageURL;
  prop.propertyAccountNumber = normalized.propertyAccountNumber || prop.propertyAccountNumber;
  prop.propertyStatus = normalized.propertyStatus || prop.propertyStatus;

  await writeJson("properties.json", propDB);

  res.json(response(true, "Property Updated Successfully", prop));
};

// ------------------------- DELETE PROPERTY (SOFT) ---------------------------
export const deleteProperty = async (req, res) => {
  const propertyId = Number(req.params.propertyId);
  console.log(req.params);
  console.log(propertyId);
  const propDB = await readJson("properties.json");
  const bookingDB = await readJson("bookings.json");

  if (!Array.isArray(propDB.properties)) propDB.properties = [];

  const prop = propDB.properties.find(p => p.propertyId === propertyId);
  if (!prop) return res.json(response(false, "Property not found"));

  // Block deletion if any active/future booking exists (checkout >= today)
  const blocked = (bookingDB.bookings || []).some(b => {
    if (b.propertyId !== propertyId) return false;
    if (!isValidISODate(b.checkOutDate)) return false;
    const today = new Date().toISOString().split("T")[0];
    return today <= b.checkOutDate && b.bookingStatus === true;
  });

  if (blocked) {
    return res.json(
      response(false, "Cannot delete: Property has active/future bookings")
    );
  }

  prop.propertyStatus = "DELETED";
  await writeJson("properties.json", propDB);
  res.json(response(true, "Property Soft Deleted"));
};

// ------------------------- VIEW BOOKINGS ------------------------------------
export const viewBookings = async (req, res) => {
  const userId = Number(req.params.userId);

  const propsDB = await readJson("properties.json");
  const bookingDB = await readJson("bookings.json");
  const userDB = await readJson("users.json");

  const hostProps = (propsDB.properties || []).filter(p => p.userId === userId);

  const result = (bookingDB.bookings || [])
    .filter(b => hostProps.some(p => p.propertyId === b.propertyId))
    .map(b => {
      const prop = hostProps.find(p => p.propertyId === b.propertyId) || {};
      const addr = prop.address || {};
      const guest = (userDB.users || []).find(u => u.userId === b.userId) || {};

      return {
        ...b,
        propertyName: prop.propertyName || "",
        propertyImage: prop.imageURL || prop.imageUrl || "",
        propertyDetails: {
          description: prop.propertyDescription || "",
          rooms: prop.noOfRooms || prop.rooms || 0,
          bathrooms: prop.noOfBathrooms || prop.noOfBathroom || 0,
          pricePerDay: prop.pricePerDay || prop.pricePreDay || 0,
          maxGuests: prop.maxNoOfGuests || prop.maxNumberOfGuest || 0,
          address: {
            buildingNo: addr.buildingNo || "",
            street: addr.street || "",
            city: addr.city || "",
            state: addr.state || "",
            country: addr.country || "",
            postalCode: addr.postalCode || addr.pincode || ""
          }
        },
        guestInfo: {
          name: guest.username || guest.name || "",
          email: guest.email || "",
          phone: guest.phone || ""
        }
      };
    });

  res.json(response(true, "Bookings loaded", result));
};


// ------------------------- CALCULATE REVENUE --------------------------------
export const revenue = async (req, res) => {
  const userId = Number(req.params.userId);

  const propsDB = await readJson("properties.json");
  const bookingDB = await readJson("bookings.json");

  // properties owned by this host
  const hostProps = (propsDB.properties || []).filter(p => p.userId === userId);
  const hostPropertyIds = hostProps.map(p => p.propertyId);

  let total = 0;

  for (const b of (bookingDB.bookings || [])) {
    // must belong to this host (booking.hostId should equal userId OR property belongs to host)
    if (Number(b.hostId) !== userId && !hostPropertyIds.includes(b.propertyId)) continue;

    // only count confirmed bookings
    if (b.bookingStatus !== true) continue;

    // date must be valid
    const ci = new Date(b.checkInDate);
    const co = new Date(b.checkOutDate);

    if (isNaN(ci) || isNaN(co)) continue;

    const nights = countNights(b.checkInDate, b.checkOutDate);

    // get correct property price
    const prop = hostProps.find(p => p.propertyId === b.propertyId) || {};
    const price = prop.pricePerDay || prop.pricePreDay || 0;
    total += nights * price;
  }

  res.json(response(true, "Revenue calculated", { totalRevenue: total }));
};