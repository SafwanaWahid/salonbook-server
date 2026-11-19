import crypto from "node:crypto";

const serviceCategories = ["Haircut & Styling", "Hair Coloring", "Hair Treatment", "Facial & Skincare", "Makeup", "Manicure & Pedicure", "Spa & Massage"];

function passwordValid(password) {
  return typeof password === "string" && password.length >= 6 && password.length <= 128 && /[A-Z]/.test(password) && /[a-z]/.test(password);
}

function isSecureImageUrl(value) {
  try { return new URL(value).protocol === "https:"; }
  catch { return false; }
}

function parseImageDataUrl(value, maxBytes = 6 * 1024 * 1024) {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match || match[2].length % 4 !== 0) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > maxBytes || bytes.toString("base64") !== match[2]) return null;
  return { mimeType: `image/${match[1].toLowerCase()}`, base64: match[2], bytes: bytes.length };
}

function verifyStripeSignature(payload, signatureHeader, secret, now = Date.now()) {
  if (!Buffer.isBuffer(payload) || !signatureHeader || !secret) return false;
  const entries = String(signatureHeader).split(",").map((entry) => entry.split("="));
  const timestamp = entries.find(([key]) => key === "t")?.[1];
  const signatures = entries.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload.toString("utf8")}`).digest("hex");
  return signatures.some((signature) => /^[a-f0-9]{64}$/i.test(signature) && crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex")));
}

export { isSecureImageUrl, parseImageDataUrl, passwordValid, serviceCategories, verifyStripeSignature };
