import { ObjectId } from "mongodb";
import { db } from "./db.js";
import { requireJwt, requireRole } from "./security.js";
import { isSecureImageUrl, serviceCategories, verifyStripeSignature } from "./domain.js";

const api = (app) => {
  const services = db.collection("services");
  const appointments = db.collection("appointments");
  const users = db.collection("user");
  const transactions = db.collection("transactions");
  const activeStatuses = ["pending", "confirmed"];
  const timeSlots = ["10:00 AM", "11:30 AM", "01:00 PM", "02:30 PM", "04:00 PM", "05:30 PM", "07:00 PM"];
  const idFilter = (id) => ObjectId.isValid(id) ? { _id: new ObjectId(id) } : null;
  const serialize = (doc) => ({ ...doc, _id: String(doc._id) });

  app.get("/api/services", async (req, res, next) => {
    try {
      const where = { status: "active" };
      if (req.query.category) where.category = String(req.query.category);
      if (req.query.q) where.serviceName = { $regex: String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      const sort = req.query.sort === "price-low" ? { price: 1 } : req.query.sort === "price-high" ? { price: -1 } : { createdAt: -1 };
      const result = await services.find(where).sort(sort).toArray();
      res.json({ services: result.map(serialize) });
    } catch (error) { next(error); }
  });
  app.get("/api/services/:id", async (req, res, next) => {
    try {
      const filter = idFilter(req.params.id);
      if (!filter) return res.status(404).json({ message: "Service not found." });
      const service = await services.findOne({ ...filter, status: "active" });
      if (!service) return res.status(404).json({ message: "This service is unavailable." });
      res.json({ service: serialize(service) });
    } catch (error) { next(error); }
  });
  app.get("/api/admin/services", requireJwt, requireRole("admin"), async (req, res, next) => {
    try { res.json({ services: (await services.find().sort({ createdAt: -1 }).toArray()).map(serialize) }); } catch (error) { next(error); }
  });
  app.post("/api/services", requireJwt, requireRole("admin"), async (req, res, next) => {
    try {
      const { serviceName, category, description, price, duration, image } = req.body;
      const status = req.body.status || "active";
      if (!serviceName?.trim() || !serviceCategories.includes(category) || !description?.trim() || !(Number(price) > 0) || !(Number(duration) > 0) || !isSecureImageUrl(image) || !["active", "inactive"].includes(status)) return res.status(400).json({ message: "Complete all service fields with a secure image URL, valid category, positive price, duration, and status." });
      const doc = { serviceName: serviceName.trim(), category, description: description.trim(), price: Number(price), duration: Number(duration), image, status, createdAt: new Date() };
      const result = await services.insertOne(doc);
      res.status(201).json({ service: serialize({ ...doc, _id: result.insertedId }) });
    } catch (error) { next(error); }
  });
  app.patch("/api/services/:id", requireJwt, requireRole("admin"), async (req, res, next) => {
    try {
      const filter = idFilter(req.params.id);
      if (!filter) return res.status(404).json({ message: "Service not found." });
      const allowed = ["serviceName", "category", "description", "price", "duration", "image", "status"];
      const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
      if (typeof update.serviceName === "string") update.serviceName = update.serviceName.trim();
      if (typeof update.description === "string") update.description = update.description.trim();
      if ("serviceName" in update && !update.serviceName || "description" in update && !update.description) return res.status(400).json({ message: "Service name and description cannot be empty." });
      if ("price" in update) update.price = Number(update.price);
      if ("duration" in update) update.duration = Number(update.duration);
      if (update.category && !serviceCategories.includes(update.category)) return res.status(400).json({ message: "Choose a valid service category." });
      if (update.image && !isSecureImageUrl(update.image)) return res.status(400).json({ message: "Service images must use a secure HTTPS URL." });
      if (update.price !== undefined && !(update.price > 0) || update.duration !== undefined && !(update.duration > 0)) return res.status(400).json({ message: "Price and duration must be positive." });
      if (update.status && !["active", "inactive"].includes(update.status)) return res.status(400).json({ message: "Choose a valid service status." });
      const result = await services.findOneAndUpdate(filter, { $set: update }, { returnDocument: "after" });
      if (!result) return res.status(404).json({ message: "Service not found." });
      res.json({ service: serialize(result) });
    } catch (error) { next(error); }
  });
  app.delete("/api/services/:id", requireJwt, requireRole("admin"), async (req, res, next) => {
    try {
      const filter = idFilter(req.params.id);
      if (!filter) return res.status(404).json({ message: "Service not found." });
      const result = await services.deleteOne(filter);
      if (!result.deletedCount) return res.status(404).json({ message: "Service not found." });
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  app.get("/api/availability", async (req, res, next) => {
    try {
      const date = String(req.query.date || "");
      const serviceFilter = idFilter(String(req.query.serviceId || ""));
      const requestedDate = new Date(`${date}T00:00:00.000Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(requestedDate.getTime()) || requestedDate.toISOString().slice(0, 10) !== date || !serviceFilter || requestedDate < new Date(new Date().toISOString().slice(0, 10))) return res.status(400).json({ message: "Choose a valid service and future date." });
      const service = await services.findOne({ ...serviceFilter, status: "active" });
      if (!service) return res.status(404).json({ message: "This service is unavailable." });
      const booked = await appointments.find({ appointmentDate: date, status: { $in: activeStatuses } }, { projection: { timeSlot: 1 } }).toArray();
      const unavailable = new Set(booked.map((item) => item.timeSlot));
      res.json({ timeSlots: timeSlots.filter((slot) => !unavailable.has(slot)) });
    } catch (error) { next(error); }
  });

  app.post("/api/appointments", requireJwt, requireRole("customer"), async (req, res, next) => {
    try {
      const { serviceId, appointmentDate, timeSlot, message = "" } = req.body;
      const serviceFilter = idFilter(serviceId);
      const date = new Date(`${appointmentDate}T00:00:00.000Z`);
      if (!serviceFilter || Number.isNaN(date.getTime()) || date < new Date(new Date().toISOString().slice(0, 10)) || !timeSlots.includes(timeSlot)) return res.status(400).json({ message: "Choose a valid future date and available time slot." });
      const service = await services.findOne({ ...serviceFilter, status: "active" });
      if (!service) return res.status(400).json({ message: "This service is not available for booking." });
      const collision = await appointments.findOne({ appointmentDate, timeSlot, status: { $in: activeStatuses } });
      if (collision) return res.status(409).json({ message: "That time is already booked. Please choose another slot." });
      const now = new Date();
      const doc = { serviceId: service._id, customerId: new ObjectId(req.user.id), appointmentDate, timeSlot, message: String(message).trim().slice(0, 500), servicePrice: service.price, paymentStatus: "unpaid", status: "pending", createdAt: now };
      const result = await appointments.insertOne(doc);
      res.status(201).json({ appointment: serialize({ ...doc, _id: result.insertedId }) });
    } catch (error) { if (error?.code === 11000) return res.status(409).json({ message: "That time is already booked. Please choose another slot." }); next(error); }
  });
  app.get("/api/appointments/mine", requireJwt, requireRole("customer"), async (req, res, next) => {
    try {
      const list = await appointments.aggregate([
        { $match: { customerId: new ObjectId(req.user.id) } },
        { $sort: { createdAt: -1 } },
        { $lookup: { from: "services", localField: "serviceId", foreignField: "_id", as: "service" } },
        { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
      ]).toArray();
      res.json({ appointments: list.map((row) => ({ ...serialize(row), service: row.service ? serialize(row.service) : null })) });
    } catch (error) { next(error); }
  });
  app.patch("/api/appointments/:id/cancel", requireJwt, requireRole("customer"), async (req, res, next) => {
    try {
      const filter = idFilter(req.params.id);
      if (!filter) return res.status(404).json({ message: "Appointment not found." });
      const result = await appointments.updateOne({ ...filter, customerId: new ObjectId(req.user.id), status: "pending" }, { $set: { status: "cancelled" } });
      if (!result.modifiedCount) return res.status(409).json({ message: "Only your own pending appointments can be cancelled." });
      res.json({ success: true });
    } catch (error) { next(error); }
  });
  app.get("/api/admin/appointments", requireJwt, requireRole("admin"), async (req, res, next) => {
    try {
      const list = await appointments.aggregate([
        { $sort: { createdAt: -1 } },
        { $lookup: { from: "services", localField: "serviceId", foreignField: "_id", as: "service" } },
        { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
        { $lookup: { from: "user", localField: "customerId", foreignField: "_id", as: "customer" } },
        { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      ]).toArray();
      res.json({ appointments: list.map(({ customer, service, ...row }) => ({ ...serialize(row), service: service ? serialize(service) : null, customer: customer ? { id: String(customer._id), name: customer.name, email: customer.email, phone: customer.phone } : null })) });
    } catch (error) { next(error); }
  });
  app.patch("/api/admin/appointments/:id/status", requireJwt, requireRole("admin"), async (req, res, next) => {
    try {
      const { status } = req.body;
      const filter = idFilter(req.params.id);
      if (!filter) return res.status(404).json({ message: "Appointment not found." });
      if (!["confirmed", "cancelled"].includes(status)) return res.status(400).json({ message: "Choose a valid appointment status." });
      const allowedFrom = status === "confirmed" ? "pending" : { $in: ["pending", "confirmed"] };
      const result = await appointments.updateOne({ ...filter, status: allowedFrom }, { $set: { status } });
      if (!result.modifiedCount) return res.status(409).json({ message: "This appointment can no longer be updated." });
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  app.post("/api/appointments/:id/checkout", requireJwt, requireRole("customer"), async (req, res, next) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ message: "Payments are not configured yet." });
      const filter = idFilter(req.params.id);
      if (!filter) return res.status(404).json({ message: "Appointment not found." });
      const appointment = await appointments.findOne({ ...filter, customerId: new ObjectId(req.user.id), status: "confirmed", paymentStatus: "unpaid" });
      if (!appointment) return res.status(409).json({ message: "Only confirmed, unpaid appointments can be paid." });
      const service = await services.findOne({ _id: appointment.serviceId });
      const body = new URLSearchParams({
        mode: "payment", success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/payment/cancel`, customer_email: req.user.email,
        "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "bdt",
        "line_items[0][price_data][unit_amount]": String(Math.round(appointment.servicePrice * 100)),
        "line_items[0][price_data][product_data][name]": service?.serviceName || "Salon appointment",
        "metadata[appointmentId]": String(appointment._id), "metadata[customerId]": req.user.id,
      });
      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
      const checkout = await response.json();
      if (!response.ok) return res.status(502).json({ message: checkout.error?.message || "Could not start checkout." });
      await appointments.updateOne({ ...filter }, { $set: { stripeSessionId: checkout.id } });
      res.json({ checkoutUrl: checkout.url });
    } catch (error) { next(error); }
  });
  app.get("/api/transactions", requireJwt, async (req, res, next) => {
    try {
      const where = req.user.role === "admin" ? {} : { customerId: new ObjectId(req.user.id) };
      const result = await transactions.aggregate([
        { $match: where }, { $sort: { createdAt: -1 } },
        { $lookup: { from: "appointments", localField: "appointmentId", foreignField: "_id", as: "appointment" } },
        { $unwind: { path: "$appointment", preserveNullAndEmptyArrays: true } },
        { $lookup: { from: "services", localField: "appointment.serviceId", foreignField: "_id", as: "service" } },
        { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
        { $lookup: { from: "user", localField: "customerId", foreignField: "_id", as: "customer" } },
        { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      ]).toArray();
      res.json({ transactions: result.map((row) => ({ ...serialize(row), appointment: row.appointment ? serialize(row.appointment) : null, service: row.service ? serialize(row.service) : null, customer: row.customer ? { name: row.customer.name, email: row.customer.email } : null })) });
    } catch (error) { next(error); }
  });

  app.get("/api/admin/overview", requireJwt, requireRole("admin"), async (req, res, next) => {
    try {
      const [totalCustomers, totalServices, totalAppointments, pendingAppointments, confirmedAppointments, paid] = await Promise.all([
        users.countDocuments({ role: "customer" }), services.countDocuments({ status: "active" }), appointments.countDocuments(), appointments.countDocuments({ status: "pending" }), appointments.countDocuments({ status: "confirmed" }), transactions.countDocuments({ status: "paid" }),
      ]);
      res.json({ totalCustomers, totalServices, totalAppointments, pendingAppointments, confirmedAppointments, successfulPayments: paid });
    } catch (error) { next(error); }
  });
  app.get("/api/customer/overview", requireJwt, requireRole("customer"), async (req, res, next) => {
    try {
      const customerId = new ObjectId(req.user.id);
      const [total, pending, confirmed, cancelled] = await Promise.all([
        appointments.countDocuments({ customerId }), appointments.countDocuments({ customerId, status: "pending" }), appointments.countDocuments({ customerId, status: "confirmed" }), appointments.countDocuments({ customerId, status: "cancelled" }),
      ]);
      res.json({ totalAppointments: total, pendingAppointments: pending, confirmedAppointments: confirmed, cancelledAppointments: cancelled });
    } catch (error) { next(error); }
  });
  app.get("/api/admin/users", requireJwt, requireRole("admin"), async (req, res, next) => {
    try {
      const list = await users.find({ role: { $ne: "admin" } }, { projection: { name: 1, email: 1, image: 1, phone: 1, isBlocked: 1, createdAt: 1 } }).sort({ createdAt: -1 }).toArray();
      res.json({ users: list.map((user) => ({ ...user, _id: String(user._id) })) });
    } catch (error) { next(error); }
  });
  app.patch("/api/admin/users/:id/block", requireJwt, requireRole("admin"), async (req, res, next) => {
    try {
      const filter = idFilter(req.params.id);
      if (!filter) return res.status(404).json({ message: "User not found." });
      const isBlocked = Boolean(req.body.isBlocked);
      const result = await users.updateOne({ ...filter, role: { $ne: "admin" } }, { $set: { isBlocked } });
      if (!result.matchedCount) return res.status(404).json({ message: "Customer not found." });
      res.json({ success: true, isBlocked });
    } catch (error) { next(error); }
  });
  app.patch("/api/profile", requireJwt, async (req, res, next) => {
    try {
      const { name, image, phone } = req.body;
      const update = {};
      if (typeof name === "string" && name.trim()) update.name = name.trim().slice(0, 100);
      if (typeof image === "string" && image && !isSecureImageUrl(image)) return res.status(400).json({ message: "Profile images must use a secure HTTPS URL." });
      if (typeof image === "string") update.image = image.slice(0, 2000);
      if (typeof phone === "string") update.phone = phone.trim().slice(0, 40);
      const result = await users.updateOne({ _id: new ObjectId(req.user.id) }, { $set: update });
      if (!result.matchedCount) return res.status(404).json({ message: "Profile not found." });
      res.json({ success: true });
    } catch (error) { next(error); }
  });
  app.post("/api/uploads", requireJwt, async (req, res) => {
    if (!process.env.IMGBB_API_KEY) return res.status(503).json({ message: "Image uploads are not configured yet." });
    const image = String(req.body?.image || "").replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
    if (!image || image.length > 8_000_000) return res.status(400).json({ message: "Choose an image under 6 MB." });
    try {
      const body = new URLSearchParams({ image });
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(process.env.IMGBB_API_KEY)}`, { method: "POST", body });
      const data = await response.json();
      if (!response.ok || !data.success) return res.status(502).json({ message: "Image upload failed." });
      res.json({ url: data.data.url });
    } catch { res.status(502).json({ message: "Image upload failed. Try again." }); }
  });

  app.post("/api/webhooks/stripe", async (req, res) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return res.status(503).send("Webhook not configured");
    if (!verifyStripeSignature(req.body, req.headers["stripe-signature"], secret)) return res.status(400).send("Invalid signature");
    try {
      const event = JSON.parse(req.body.toString("utf8"));
      if (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") {
        const checkout = event.data.object;
        const appointmentId = ObjectId.isValid(checkout.metadata?.appointmentId) ? new ObjectId(checkout.metadata.appointmentId) : null;
        const customerId = ObjectId.isValid(checkout.metadata?.customerId) ? new ObjectId(checkout.metadata.customerId) : null;
        if (!appointmentId || !customerId) return res.status(400).send("Missing payment metadata");
        const appointment = await appointments.findOne({ _id: appointmentId, customerId, status: "confirmed", stripeSessionId: checkout.id });
        if (appointment) {
          await transactions.updateOne({ stripeSessionId: checkout.id }, {
            $set: { appointmentId: appointment._id, customerId, amount: Number(checkout.amount_total) / 100, currency: checkout.currency, status: "paid" },
            $setOnInsert: { stripeSessionId: checkout.id, createdAt: new Date() },
          }, { upsert: true });
          await appointments.updateOne({ _id: appointment._id, paymentStatus: { $ne: "paid" } }, { $set: { paymentStatus: "paid" } });
        }
      }
      if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
        const checkout = event.data.object;
        if (ObjectId.isValid(checkout.metadata?.appointmentId)) {
          const appointmentId = new ObjectId(checkout.metadata.appointmentId);
          if (!ObjectId.isValid(checkout.metadata?.customerId)) return res.status(400).send("Missing customer metadata");
          await transactions.updateOne({ stripeSessionId: checkout.id }, { $setOnInsert: { appointmentId, customerId: new ObjectId(checkout.metadata.customerId), amount: Number(checkout.amount_total || 0) / 100, currency: checkout.currency || "bdt", stripeSessionId: checkout.id, status: "failed", createdAt: new Date() } }, { upsert: true });
        }
      }
      res.json({ received: true });
    } catch (error) { console.error("Stripe webhook processing failed:", error.message); res.status(400).send("Webhook processing failed"); }
  });
};

export { api };
