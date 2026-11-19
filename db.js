import { MongoClient } from "mongodb";
import { dbName } from "./config.js";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(dbName);

await Promise.all([
  db.collection("services").createIndex({ status: 1, category: 1 }),
  db.collection("services").createIndex({ serviceName: "text" }),
  db.collection("appointments").createIndex({ serviceId: 1, appointmentDate: 1, timeSlot: 1, status: 1 }),
  db.collection("appointments").createIndex({ createdAt: -1 }),
  db.collection("appointments").createIndex({ status: 1 }),
  db.collection("appointments").createIndex({ appointmentDate: 1, timeSlot: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["pending", "confirmed"] } }, name: "unique_active_appointment_slot" }),
  db.collection("appointments").createIndex({ customerId: 1, createdAt: -1 }),
  db.collection("user").createIndex({ role: 1, createdAt: -1 }),
  db.collection("transactions").createIndex({ stripeSessionId: 1 }, { unique: true, sparse: true }),
]);

export { client, db };
