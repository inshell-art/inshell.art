export const TAG = process.env.DEVNET_TAG ?? "v0.4.3";
export const HOST = process.env.DEVNET_HOST ?? "localhost";
export const PORT = process.env.DEVNET_PORT
  ? Number(process.env.DEVNET_PORT)
  : 5050;
export const DEVNET_URL = process.env.DEVNET_URL ?? `http://${HOST}:${PORT}`;
