// Pulse curve smoke with fixtures. Run a dev server (e.g. BASE_URL=http://localhost:5173 pnpm dev) before executing.
describe("Pulse curve fixture smoke", () => {
  it("renders curve and tooltip with normal fixture", () => {
    cy.fixture("pulse_normal.json").then((fx) => {
      // Inject fixture into window so the app can optionally read it (requires harness support).
      cy.visit("/", {
        onBeforeLoad(win) {
          (win as any).__PULSE_FIXTURE__ = fx;
          win.localStorage?.setItem("__PULSE_FIXTURE__", JSON.stringify(fx));
        },
      });
      cy.findByRole("img", { name: /pulse curve/i }).should("be.visible");
      cy.get(".dotfield__curve").trigger("mousemove", { clientX: 10, clientY: 10 });
      cy.findByText(/amount/i).should("exist");
    });
  });
});
