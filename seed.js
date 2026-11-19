import { db } from "./db.js";
import { auth } from "./auth.js";

const services = [
  { serviceName: "The Signature Cut", category: "Haircut & Styling", description: "A considered cut shaped around your features, finished with a soft, effortless style.", price: 1800, duration: 60, image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=1000&q=85" },
  { serviceName: "Soft Dimension Color", category: "Hair Coloring", description: "Dimensional, natural-looking color with a glossy finish and a custom consultation.", price: 6800, duration: 150, image: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1000&q=85" },
  { serviceName: "The Skin Reset Facial", category: "Facial & Skincare", description: "A restorative facial tailored to your skin, with gentle exfoliation and a calming mask.", price: 3200, duration: 75, image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1000&q=85" },
  { serviceName: "Scalp & Repair Ritual", category: "Hair Treatment", description: "A deeply nourishing scalp ritual and repair treatment to restore softness and shine.", price: 2600, duration: 70, image: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1000&q=85" },
  { serviceName: "Barely There Manicure", category: "Manicure & Pedicure", description: "A clean, unhurried manicure with nail shaping, cuticle care, and a nourishing finish.", price: 1500, duration: 50, image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1000&q=85" },
  { serviceName: "Soft Occasion Makeup", category: "Makeup", description: "Polished, lightweight makeup for celebrations, events, and the lovely in-between.", price: 4500, duration: 90, image: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1000&q=85" },
  { serviceName: "The Unwind Massage", category: "Spa & Massage", description: "A soothing full-body massage to ease tension and make room for a slower moment.", price: 5200, duration: 90, image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=85" },
  { serviceName: "The Easy Blowout", category: "Haircut & Styling", description: "A smooth, bouncy blowout finished to suit your plans, from everyday to occasion-ready.", price: 2000, duration: 45, image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1000&q=85" },
];

const collection = db.collection("services");
if (await collection.countDocuments() === 0) {
  const now = new Date();
  await collection.insertMany(services.map((service) => ({ ...service, status: "active", createdAt: now })));
  console.log("Eight SalonBook services added.");
} else console.log("Services already exist; no changes made.");

if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const users = db.collection("user");
  let admin = await users.findOne({ email: process.env.ADMIN_EMAIL.toLowerCase() });
  if (!admin) {
    await auth.api.signUpEmail({ body: { name: "SalonBook Admin", email: process.env.ADMIN_EMAIL.toLowerCase(), password: process.env.ADMIN_PASSWORD } });
    admin = await users.findOne({ email: process.env.ADMIN_EMAIL.toLowerCase() });
  }
  if (admin) {
    await users.updateOne({ _id: admin._id }, { $set: { role: "admin", isBlocked: false } });
    console.log(`Admin account ready for ${process.env.ADMIN_EMAIL}.`);
  }
} else console.log("Set ADMIN_EMAIL and ADMIN_PASSWORD to create the evaluation admin account.");

process.exit(0);
