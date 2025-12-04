// Pulse curve smoke with fixtures. Run a dev server (e.g. BASE_URL=http://localhost:5173 pnpm dev) before executing.

function loadFixture(name: string) {
  cy.readFile(`tests/fixtures/${name}.json`).then((fx) => {
    cy.visit("/", {
      onBeforeLoad(win) {
        (win as any).__PULSE_FIXTURE__ = fx;
        win.localStorage?.setItem("__PULSE_FIXTURE__", JSON.stringify(fx));
      },
    });
  });
}

function expectCurve() {
  cy.get('[role="img"][aria-label="Pulse curve"]').should("be.visible");
  cy.get(".dotfield__curve")
    .should("exist")
    .trigger("mousemove", { clientX: 10, clientY: 10, force: true });
  cy.contains(/amount/i).should("exist");
}

describe("Pulse curve fixture smoke", () => {
  it("renders curve and tooltip with normal fixture", () => {
    loadFixture("pulse_normal");
    expectCurve();
  });

  ["pulse_tiny_pump", "pulse_huge_pump", "pulse_stale"].forEach((name) => {
    it(`renders curve for ${name}`, () => {
      loadFixture(name);
      expectCurve();
    });
  });

  it("renders epoch2 fixture without crash", () => {
    loadFixture("pulse_epoch2");
    expectCurve();
  });

  it("shows bids tab content with fixture bids", () => {
    loadFixture("pulse_normal");
    cy.contains("bids").click();
    cy.get(".dotfield__dot").its("length").should("be.gte", 1);
    cy.get(".dotfield__dot")
      .first()
      .trigger("mousemove", { clientX: 5, clientY: 5, force: true });
    cy.contains(/amount/i).should("exist");
  });
});
