import { SURFACE_TERMINOLOGY } from "@inshell/shared";

/**
 * The canonical $PATH frame before an approved contract deployment exists.
 * It deliberately contains no wallet or contract-backed controls.
 */
export default function PathBeforeDeployCanvas() {
  return (
    <div className="panel dotfield" data-auction-status="before_deploy">
      <div className="dotfield__nav">
        <div className="dotfield__title-stack">
          <h1 className="headline dotfield__title thin">
            <a className="dotfield__title-link" href="/path">
              {SURFACE_TERMINOLOGY.pathDapp}
            </a>
          </h1>
          <p className="dotfield__slogan">permission token for movement mints.</p>
        </div>
      </div>
      <div className="dotfield__mint-notice is-empty" aria-hidden="true" />
      <div className="dotfield__canvas dotfield__look">
        <div className="muted dotfield__status-copy" role="status">
          $PATH minting is not open yet.
          <br />
          The onchain release is being prepared.
          <br />
          <a className="dotfield__status-link" href="/thought">
            Create a THOUGHT while you wait.
          </a>
        </div>
      </div>
    </div>
  );
}
