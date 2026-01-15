import path from "path";
import { existsSync } from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = process.env.NODE_ENV || "dev";

const candidates = [
  path.resolve(__dirname, `../apps/home/.env.${env}.local`),
  path.resolve(__dirname, `../apps/home/.env.${env}`),
  path.resolve(__dirname, `../.env.${env}.local`),
  path.resolve(__dirname, `../.env.${env}`),
];

const envFile = candidates.find((p) => existsSync(p));
if (envFile) {
  dotenv.config({ path: envFile });
}
