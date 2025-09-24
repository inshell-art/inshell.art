#!/usr/bin/env bash
# Source Vite envs in the same precedence as Vite:
# .env -> .env.local -> .env.$MODE -> .env.$MODE.local
load_vite_env() {
	local mode="${1:-devnet}"
	[ -f .env ] && set -a && . ./.env && set +a
	[ -f .env.local ] && set -a && . ./.env.local && set +a
	[ -f ".env.$mode" ] && set -a && . "./.env.$mode" && set +a
	[ -f ".env.$mode.local" ] && set -a && . "./.env.$mode.local" && set +a
}
