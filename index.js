import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { clientOrigin } from "./config.js";
import { db } from "./db.js";
import { api } from "./routes.js";
import { issueAccessToken, requireJwt } from "./security.js";
import { passwordValid } from "./domain.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60_000, limit: 80, standardHeaders: "draft-8", legacyHeaders: false }));
app.use(cookieParser());
app.post("/api/webhooks/stripe", express.raw({ type: "application/json", limit: "1mb" }));
app.use(express.json({ limit: "10mb" }));
app.get("/api/health", (req, res) => res.json({ status: "healthy", app: "SalonBook" }));
app.post("/api/auth/sign-up/email", async (req, res, next) => {
  if (!passwordValid(req.body?.password)) return res.status(400).json({ message: "Use at least 6 characters with one uppercase and one lowercase letter." });
  try {
    const headers = fromNodeHeaders(req.headers);
    headers.set("content-type", "application/json");
    const response = await auth.handler(new Request(`${process.env.BETTER_AUTH_URL || "http://localhost:5000"}/api/auth/sign-up/email`, { method: "POST", headers, body: JSON.stringify(req.body) }));
    res.status(response.status);
    response.headers.forEach((value, key) => { if (key !== "set-cookie") res.setHeader(key, value); });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader("set-cookie", cookies);
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) { next(error); }
});
app.all("/api/auth/*splat", toNodeHandler(auth));
app.post("/api/token", issueAccessToken);
app.delete("/api/token", (req, res) => res.clearCookie("salon_access", { path: "/" }).json({ success: true }));
app.get("/api/me", requireJwt, (req, res) => res.json({ user: req.user }));
app.get("/api/config", (req, res) => res.json({ googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), uploadEnabled: Boolean(process.env.IMGBB_API_KEY), paymentEnabled: Boolean(process.env.STRIPE_SECRET_KEY) }));
api(app);
app.use((req, res) => res.status(404).json({ message: "API route not found." }));
app.use((error, req, res, next) => {
  console.error(error.message);
  res.status(error.status || 500).json({ message: error.status ? error.message : "Server error. Please try again." });
});

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`SalonBook API listening on ${port}`));

export { app, db };
