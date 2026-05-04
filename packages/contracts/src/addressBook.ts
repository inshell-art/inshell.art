import devnet from "./addresses/addresses.devnet.json";
import sepolia from "./addresses/addresses.sepolia.json";
// import mainnet from "./addresses/addresses.mainnet.json";

type Book = Record<string, string>;
const BOOKS: Record<string, Book> = {
  devnet,
  sepolia,
  // mainnet,
};

function getEnv(name: string): any {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? procEnv?.[name];
}

// Normalize an identifier to match Vite env var naming conventions
function normalizeKey(id: string): string {
  // strip optional Vite prefix
  const noPrefix = id.replace(/^VITE_/, "");
  // common cases:
  //   "pulse_auction" -> "pulse_auction"
  //   "PULSE_AUCTION" -> "pulse_auction"
  //   "Pulse_Auction" -> "pulse_auction"
  return noPrefix.toLowerCase();
}

// Make the matching Vite env var name from a snake_case key
function keyToViteEnv(key: string): string {
  return "VITE_" + key.toUpperCase(); // pulse_auction -> VITE_PULSE_AUCTION
}

// Pick current network (default devnet)
function currentNetwork(): string {
  return getEnv("VITE_NETWORK") ?? "devnet";
}

export function isEvmAddress(value: string | undefined | null): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function maybeResolveAddress(
  id: string,
  explicit?: string
): string | undefined {
  if (explicit && isEvmAddress(explicit)) return explicit.trim();

  const key = normalizeKey(id);
  const envKey = keyToViteEnv(key);

  const viaEnv = getEnv(envKey) as string | undefined;
  if (isEvmAddress(viaEnv)) return viaEnv.trim();

  const net = currentNetwork();
  const book = BOOKS[net];
  const fromBook = book?.[key];
  if (isEvmAddress(fromBook)) return fromBook.trim();
  return undefined;
}

/** Robust address resolver: explicit > VITE_* > addresses.<net>.json > throw */
export function resolveAddress(id: string, explicit?: string): string {
  const resolved = maybeResolveAddress(id, explicit);
  if (resolved) return resolved;

  const key = normalizeKey(id);
  const envKey = keyToViteEnv(key);
  const net = currentNetwork();
  throw new Error(
    `Missing valid Ethereum contract address: ${key} (env ${envKey}) for network=${net}`
  );
}

export type AddressMap = Record<string, string>;

/** Resolve all known addresses for the active network. */
export function getAddresses(): AddressMap {
  const net = currentNetwork();
  const book = BOOKS[net] ?? {};
  const out: AddressMap = {};

  for (const key of Object.keys(book)) {
    const resolved = maybeResolveAddress(key);
    if (resolved) out[key] = resolved;
  }

  return out;
}
