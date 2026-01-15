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

/** Robust address resolver: explicit > VITE_* > addresses.<net>.json > throw */
export function resolveAddress(id: string, explicit?: string): string {
  // 1) explicit param wins
  if (explicit && explicit !== "") return explicit;

  const key = normalizeKey(id);
  const envKey = keyToViteEnv(key);

  // 2) Vite env override if present
  const viaEnv = getEnv(envKey) as string | undefined;
  if (viaEnv && viaEnv !== "") return viaEnv;

  // 3) JSON address book by network
  const net = currentNetwork();
  const book = BOOKS[net];
  if (book && book[key]) return book[key];

  // 4) fail clearly
  throw new Error(
    `Missing contract address: ${key} (env ${envKey}) for network=${net}`
  );
}

export type AddressMap = Record<string, string>;

/** Resolve all known addresses for the active network. */
export function getAddresses(): AddressMap {
  const net = currentNetwork();
  const book = BOOKS[net] ?? {};
  const out: AddressMap = {};

  for (const key of Object.keys(book)) {
    out[key] = resolveAddress(key);
  }

  return out;
}
