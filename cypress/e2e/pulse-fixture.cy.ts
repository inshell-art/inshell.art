// Pulse curve smoke with fixtures. Enable by running a dev server (e.g. BASE_URL=http://localhost:5173 pnpm dev)
// and removing `.skip`. Currently skipped to avoid failures when no server is running in CI.

describe.skip("Pulse curve fixture smoke", () => {
  it("renders curve and tooltip with normal fixture", () => {
    cy.fixture("pulse_normal.json").then((fx) => {
      // Inject fixture into window so the app can optionally read it (requires harness support).
      cy.visit("/", {
        onBeforeLoad(win) {
          (win as any).__PULSE_FIXTURE__ = fx;
        },
      });
      cy.findByRole("img", { name: /pulse curve/i }).should("be.visible");
      cy.get(".dotfield__curve").trigger("mousemove", { clientX: 10, clientY: 10 });
      cy.findByText(/amount/i).should("exist");
    });
  });
});
