/* global expect, getComputedStyle, CustomEvent, Window */

type MockProvider = {
  isMetaMask?: boolean;
  isRabby?: boolean;
  request: ReturnType<typeof cy.stub>;
};

const MOBILE_WIDTH = 320;
const MOBILE_HEIGHT = 844;
const TOUCH_TARGET_MIN = 44;

function installMobileWallets(win: Window) {
  const account = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
  const request = (name: string) =>
    cy.stub().callsFake(({ method }: { method: string }) => {
      if (method === "eth_accounts" || method === "eth_requestAccounts") {
        return Promise.resolve([account]);
      }
      if (method === "eth_chainId") return Promise.resolve("0xaa36a7");
      throw new Error(`${name}: unexpected wallet request ${method}`);
    });
  const metaMask: MockProvider = { isMetaMask: true, request: request("MetaMask") };
  const rabby: MockProvider = {
    isMetaMask: true,
    isRabby: true,
    request: request("Rabby"),
  };
  Object.defineProperty(win, "ethereum", {
    configurable: true,
    value: { providers: [metaMask, rabby] },
  });
  (win as Window & { __mobileWallets?: Record<string, MockProvider> }).__mobileWallets = {
    metaMask,
    rabby,
  };

  win.addEventListener("eip6963:requestProvider", () => {
    for (const [uuid, name, rdns, provider] of [
      ["metamask-mobile-smoke", "MetaMask", "io.metamask", metaMask],
      ["rabby-mobile-smoke", "Rabby Wallet", "io.rabby", rabby],
    ] as const) {
      win.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: {
              uuid,
              name,
              icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
              rdns,
            },
            provider,
          },
        }),
      );
    }
  });
}

function expectNoHorizontalOverflow() {
  cy.document().then((doc) => {
    expect(doc.documentElement.scrollWidth).to.be.at.most(
      doc.documentElement.clientWidth,
    );
  });
}

describe("production build surface", () => {
  it("serves every canonical product route from one origin", () => {
    for (const [route, surface] of [
      ["/", ".inshell-topbar"],
      ["/path", ".dotfield"],
      ["/path/1", ".path-detail-page"],
      ["/thought/", ".frontpage-stage"],
      ["/thought/1", ".thought-detail"],
      ["/gallery", ".shell--home"],
      ["/will", ".will-page"],
    ] as const) {
      cy.visit(route, { failOnStatusCode: true });
      cy.location("origin").should("equal", Cypress.config("baseUrl"));
      cy.get(surface).should("be.visible");
      cy.get(".inshell-preview-watermark").should("not.exist");
      expectNoHorizontalOverflow();
    }
  });

  it("keeps Agent creation desktop-only on a phone", () => {
    cy.viewport(MOBILE_WIDTH, MOBILE_HEIGHT);
    cy.visit("/thought/?surface=agent", { failOnStatusCode: true });

    cy.contains("continue on desktop").should("be.visible");
    cy.contains(
      "Codex and Claude Code creation are available from the desktop THOUGHT App.",
    ).should("be.visible");
    cy.get("body").then(($body) => {
      const visibleAgentLaunchers = [...$body.find("button")].filter((button) => {
        const label = button.textContent?.trim();
        return (
          (label === "Codex" || label === "Claude Code") &&
          Cypress.$(button).is(":visible")
        );
      });
      expect(visibleAgentLaunchers).to.have.length(0);
    });
    cy.get("#thought-dock-prompt").should("be.visible").then(($input) => {
      expect(Number.parseFloat(getComputedStyle($input[0]).fontSize)).to.be.at.least(16);
    });
    expectNoHorizontalOverflow();
  });

  it("discovers mobile wallets and keeps their picker inside the viewport", () => {
    cy.viewport(MOBILE_WIDTH, MOBILE_HEIGHT);
    cy.visit("/", {
      failOnStatusCode: true,
      onBeforeLoad: installMobileWallets,
    });

    cy.get('button[aria-label="connect wallet"]').click();
    cy.get('[role="menu"][aria-label="Wallet options"]').should("be.visible");
    for (const name of ["MetaMask", "Rabby Wallet", "WalletConnect"]) {
      cy.contains('[role="menuitem"]', name).should("be.visible");
    }

    cy.get('[role="menu"][aria-label="Wallet options"]').then(($picker) => {
      const rect = $picker[0].getBoundingClientRect();
      expect(rect.left).to.be.at.least(0);
      expect(rect.right).to.be.at.most(MOBILE_WIDTH);
      expect(rect.top).to.be.at.least(0);
      expect(rect.bottom).to.be.at.most(MOBILE_HEIGHT);
    });
    cy.get(".inshell-wallet-picker__item")
      .filter(":visible")
      .first()
      .then(($item) => {
        expect($item[0].getBoundingClientRect().height).to.be.at.least(
          TOUCH_TARGET_MIN,
        );
      });

    cy.contains('[role="menuitem"]', "Rabby Wallet").click();
    cy.window().its("__mobileWallets.rabby.request").should("have.been.calledWithMatch", {
      method: "eth_requestAccounts",
    });
    cy.contains(/0x7099/i).should("be.visible");
    expectNoHorizontalOverflow();
  });
});
