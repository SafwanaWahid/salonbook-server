import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { db } from "./db.js";

const issuer = "salonbook-api";
const audience = "salonbook-client";
const isProduction = process.env.NODE_ENV === "production";
const cookieOptions = { httpOnly: true, secure: isProduction, sameSite: isProduction ? "none" : "lax", path: "/" };

async function sessionUser(req) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  return session?.user ?? null;
}

async function issueAccessToken(req, res) {
  const user = await sessionUser(req);
  if (!user) return res.status(401).json({ message: "Sign in to continue." });
  const dbUser = ObjectId.isValid(user.id) ? await db.collection("user").findOne({ _id: new ObjectId(user.id) }) : null;
  if (dbUser?.isBlocked) return res.status(403).json({ message: "This account is blocked." });
  const token = jwt.sign({ role: dbUser?.role || "customer" }, process.env.JWT_SECRET, {
    subject: user.id, issuer, audience, expiresIn: "15m",
  });
  res.cookie("salon_access", token, { ...cookieOptions, maxAge: 15 * 60 * 1000 }).json({ user: { id: user.id, name: user.name, email: user.email, image: user.image, role: dbUser?.role || "customer" } });
}

async function requireJwt(req, res, next) {
  try {
    const token = req.cookies?.salon_access || req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ message: "Sign in to continue." });
    const claims = jwt.verify(token, process.env.JWT_SECRET, { issuer, audience });
    if (!ObjectId.isValid(claims.sub)) return res.status(401).json({ message: "Invalid user session." });
    const user = await db.collection("user").findOne({ _id: new ObjectId(claims.sub) });
    if (!user) return res.status(401).json({ message: "Account not found." });
    if (user.isBlocked) return res.status(403).json({ message: "This account is blocked." });
    req.user = { id: String(user._id), name: user.name, email: user.email, image: user.image, role: user.role || "customer" };
    next();
  } catch {
    res.status(401).json({ message: "Your session expired. Please sign in again." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ message: "You do not have permission to do that." });
}

export { cookieOptions, issueAccessToken, requireJwt, requireRole, sessionUser };
