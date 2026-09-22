import {
  resolvePathLaunchPhase,
  type PathLaunchPhase,
} from "@/services/pathDeployment";

describe("PATH launch phases", () => {
  const nowSec = 1_800_000_000;

  test("an undeployed contract is the first phase, whatever the clock says", () => {
    const phase: PathLaunchPhase = resolvePathLaunchPhase({
      deploymentActive: false,
      openTimeSec: nowSec - 10_000,
      nowSec,
    });
    expect(phase).toBe("not-deployed");
  });

  test("a deployed contract with no readable open time stays shut", () => {
    expect(
      resolvePathLaunchPhase({ deploymentActive: true, openTimeSec: null, nowSec }),
    ).toBe("countdown");
    expect(
      resolvePathLaunchPhase({ deploymentActive: true, openTimeSec: Number.NaN, nowSec }),
    ).toBe("countdown");
  });

  test("a deployed contract before its open time is the countdown phase", () => {
    expect(
      resolvePathLaunchPhase({
        deploymentActive: true,
        openTimeSec: nowSec + 1,
        nowSec,
      }),
    ).toBe("countdown");
  });

  test("a deployed contract at or after its open time is open", () => {
    expect(
      resolvePathLaunchPhase({ deploymentActive: true, openTimeSec: nowSec, nowSec }),
    ).toBe("open");
    expect(
      resolvePathLaunchPhase({
        deploymentActive: true,
        openTimeSec: nowSec - 1,
        nowSec,
      }),
    ).toBe("open");
  });
});
