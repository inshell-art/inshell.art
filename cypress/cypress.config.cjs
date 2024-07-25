"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cypress_1 = require("cypress");
exports.default = (0, cypress_1.defineConfig)({
    e2e: {
        specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
        baseUrl: "http://localhost:5002",
    },
});
