cd "$(dirname "$0")"

tsc -p tsconfig.cypress-config.json

mv cypress.config.js cypress.config.cjs