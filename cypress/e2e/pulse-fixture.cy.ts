// Pulse curve smoke with fixtures. Run a dev server (e.g. BASE_URL=http://localhost:5173 pnpm dev) before executing.
describe("Pulse curve fixture smoke", () => {
  it("renders curve and tooltip with normal fixture", () => {
    cy.readFile("tests/fixtures/pulse_normal.json").then((fx) => {
      // Inject fixture into window so the app can read it on load.
      cy.visit("/", {
        onBeforeLoad(win) {
          (win as any).__PULSE_FIXTURE__ = fx;
          win.localStorage?.setItem("__PULSE_FIXTURE__", JSON.stringify(fx));
        },
      });
      cy.get('[role="img"][aria-label="Pulse curve"]').should("be.visible");
      cy.get(".dotfield__curve")
        .should("exist")
        .trigger("mousemove", { clientX: 10, clientY: 10, force: true });
      cy.contains(/amount/i).should("exist");
    });
  });
});
