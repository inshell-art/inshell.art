#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."

MODE="${MODE:-devnet}"
source scripts/util/load_vite_env.sh
load_vite_env "$MODE"

command -v curl >/dev/null || {
	echo "Missing curl"
	exit 1
}
command -v jq >/dev/null || {
	echo "Missing jq"
	exit 1
}

RPC="${VITE_RPC_URL:-http://127.0.0.1:5050/rpc}"
ABI_DIR="abi/$MODE"
mkdir -p "$ABI_DIR"

must_addr() { [[ "$2" =~ ^0x[0-9a-fA-F]+$ ]] || {
	echo "!! $1 invalid: '$2'"
	exit 1
}; }

must_addr VITE_PULSE_AUCTION "${VITE_PULSE_AUCTION:-}"
must_addr VITE_PATH_ADAPTER "${VITE_PATH_ADAPTER:-}"
must_addr VITE_PATH_MINTER "${VITE_PATH_MINTER:-}"
must_addr VITE_PATH_NFT "${VITE_PATH_NFT:-}"

rpc() {
	local method="$1" params="$2"
	curl -s -H 'content-type: application/json' \
		--data "$(jq -n --arg m "$method" --argjson p "$params" \
			'{jsonrpc:"2.0",method:$m,params:$p,id:1}')" \
		"$RPC"
}

get_class_at() {
	local addr="$1"
	rpc starknet_getClassAt "$(jq -n --arg a "$addr" '{block_id:{tag:"latest"}, contract_address:$a}')"
}

pull_one() {
	local nice="$1" addr="$2"
	echo -n "• $nice @ $addr … "
	local res abi
	res="$(get_class_at "$addr")"
	abi="$(jq -r '.result.abi // empty' <<<"$res")"
	if [ -z "$abi" ]; then
		echo "no class found or empty abi"
		return 1
	fi
	jq '.' <<<"$abi" >"$ABI_DIR/$nice.json"
	echo "saved → $ABI_DIR/$nice.json"
}

echo "RPC: $RPC (mode=$MODE)"
pull_one PulseAuction "$VITE_PULSE_AUCTION"
pull_one PathMinterAdapter "$VITE_PATH_ADAPTER"
pull_one PathMinter "$VITE_PATH_MINTER"
pull_one PathNFT "$VITE_PATH_NFT"
echo "ABIs saved under $ABI_DIR/"
