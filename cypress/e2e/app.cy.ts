describe("App Initialization", () => {
  it("should load the main elements of the app", () => {
    cy.visit("/");

    cy.get("[class*=project]").should("have.length", 3).and("be.visible");
    cy.get("[class*=year]").should("have.length", 3).and("be.visible");

    // Test cases for footer links
    cy.get('footer a[href="https://prime.inshell.art"]')
      .should("have.text", "prime")
      .and("be.visible");
    cy.get('footer a[href="https://twitter.com/inshell_art"]')
      .should("have.text", "twitter")
      .and("be.visible");
    cy.get('footer a[href="https://github.com/inshell-art"]')
      .should("have.text", "github")
      .and("be.visible");
  });
});
