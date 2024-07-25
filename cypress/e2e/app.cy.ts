describe("App Initialization", () => {
  it("should load the main elements of the app", () => {
    cy.visit("/");

    cy.get("[class*=project]").should("have.length", 3).and("be.visible");
    cy.get("[class*=year]").should("have.length", 3).and("be.visible");
    cy.get('footer a[href="https://github.com/inshell-art"]').should(
      "be.visible"
    );
    cy.get('footer a[href="https://x.com/inshell_art"]').should("be.visible");
  });
});
