import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { isSecureImageUrl, passwordValid, verifyStripeSignature } from "./domain.js";

test("signup passwords need length, uppercase, and lowercase", () => {
  assert.equal(passwordValid("SalonPass1"), true);
  assert.equal(passwordValid("short"), false);
  assert.equal(passwordValid("lowercase1"), false);
  assert.equal(passwordValid("UPPERCASE1"), false);
  assert.equal(passwordValid("A".repeat(129)), false);
});

test("service and profile images must use HTTPS", () => {
  assert.equal(isSecureImageUrl("https://i.ibb.co/image.jpg"), true);
  assert.equal(isSecureImageUrl("http://example.com/image.jpg"), false);
  assert.equal(isSecureImageUrl("not a URL"), false);
});

test("Stripe signatures must match the timestamp and payload", () => {
  const payload = Buffer.from(JSON.stringify({ type: "checkout.session.completed" }));
  const secret = "whsec_test_signing_secret";
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", secret).update(`${timestamp}.${payload.toString("utf8")}`).digest("hex");
  assert.equal(verifyStripeSignature(payload, `t=${timestamp},v1=${digest}`, secret), true);
  assert.equal(verifyStripeSignature(payload, `t=${timestamp},v1=${"0".repeat(64)}`, secret), false);
  assert.equal(verifyStripeSignature(payload, `t=${timestamp - 301},v1=${digest}`, secret), false);
  assert.equal(verifyStripeSignature(payload, null, secret), false);
});
