import "dotenv/config";

for (const key of ["MONGODB_URI", "CLIENT_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET", "JWT_SECRET"]) {
  if (!process.env[key] || process.env[key].includes("replace_with")) throw new Error(`Set ${key} in your .env file.`);
}
if (process.env.BETTER_AUTH_SECRET.length < 32 || process.env.JWT_SECRET.length < 32) throw new Error("Use secrets with at least 32 characters.");
const clientOrigin = new URL(process.env.CLIENT_URL).origin;
new URL(process.env.BETTER_AUTH_URL);
const dbName = process.env.DB_NAME || "salonbook";

export { clientOrigin, dbName };
