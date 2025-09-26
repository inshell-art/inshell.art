#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."

# Optional: load Vite env for the chosen mode (devnet|sepolia|mainnet)
MODE="${MODE:-devnet}"
if [ -f scripts/util/load_vite_env.sh ]; then
	# shellcheck disable=SC1091
	. scripts/util/load_vite_env.sh
	load_vite_env "$MODE"
fi

RPC="${VITE_RPC_URL:-http://127.0.0.1:5050/rpc}"
ABI_DIR="abi/$MODE"
mkdir -p "$ABI_DIR"

must_addr() { # must_addr NAME VALUE
	[[ "${2:-}" =~ ^0x[0-9a-fA-F]+$ ]] || {
		echo "!! $1 invalid or empty: '${2:-}'" >&2
		exit 1
	}
}

must_addr VITE_PULSE_AUCTION "${VITE_PULSE_AUCTION:-}"
must_addr VITE_PATH_ADAPTER "${VITE_PATH_ADAPTER:-}"
must_addr VITE_PATH_MINTER "${VITE_PATH_MINTER:-}"
must_addr VITE_PATH_NFT "${VITE_PATH_NFT:-}"

rpc_call() { # rpc_call METHOD PARAMS_JSON
	local method="$1" params_json="$2"
	curl -sS -H 'content-type: application/json' \
		--data "$(jq -c -n --arg m "$method" --argjson p "$params_json" \
			'{jsonrpc:"2.0",method:$m,params:$p,id:1}')" \
		"$RPC"
}

get_class_at_any() { # get_class_at_any ADDRESS -> raw JSON
	local addr="$1" res params

	# Try canonical object with tag
	params="$(jq -c -n --arg a "$addr" '{block_id:{tag:"latest"}, contract_address:$a}')"
	res="$(rpc_call starknet_getClassAt "$params")"
	if jq -e '.error' >/dev/null 2>&1 <<<"$res"; then
		# Try canonical object with string "latest"
		params="$(jq -c -n --arg a "$addr" '{block_id:"latest", contract_address:$a}')"
		res="$(rpc_call starknet_getClassAt "$params")"
	fi
	if jq -e '.error' >/dev/null 2>&1 <<<"$res"; then
		# Try legacy/array params: ["latest", "0x..."]
		params="$(jq -c -n --arg a "$addr" '["latest", $a]')"
		res="$(rpc_call starknet_getClassAt "$params")"
	fi

	echo "$res"
}

pull_one() { # pull_one NiceName Address
	local nice="$1" addr="$2"
	echo -n "• $nice @ $addr … "
	local res abi
	res="$(get_class_at_any "$addr")"
	if jq -e '.error' >/dev/null 2>&1 <<<"$res"; then
		echo "error → $(jq -r '.error.message' <<<"$res")"
		return 1
	fi

	# Different nodes place abi in different spots; handle both.
	abi="$(jq -c '.result.abi // .abi // empty' <<<"$res")"
	if [ -z "$abi" ] || [ "$abi" = "null" ]; then
		echo "no abi in response"
		return 1
	fi

	jq '.abi' <<<"$abi" >"$ABI_DIR/$nice.json"
	echo "saved → $ABI_DIR/$nice.json"
}

echo "RPC: $RPC (mode=$MODE)"
pull_one PulseAuction "$VITE_PULSE_AUCTION"
pull_one PathMinterAdapter "$VITE_PATH_ADAPTER"
pull_one PathMinter "$VITE_PATH_MINTER"
pull_one PathNFT "$VITE_PATH_NFT"
echo "ABIs saved under $ABI_DIR/"
