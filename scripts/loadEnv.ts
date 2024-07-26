import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = process.env.NODE_ENV || "dev";

const envFile = path.resolve(__dirname, `../config/.env.${env}`);

dotenv.config({ path: envFile });
