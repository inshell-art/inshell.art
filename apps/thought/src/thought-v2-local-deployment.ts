export const THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY =
  "local THOUGHT V2 deployment unavailable.";

export const THOUGHT_V2_LOCAL_DEPLOYMENT_MISMATCH_COPY =
  "local THOUGHT V2 deployment mismatch.";

export const isThoughtV2LocalDeploymentError = (message: string) =>
  message === THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY ||
  message === THOUGHT_V2_LOCAL_DEPLOYMENT_MISMATCH_COPY;

type VerifyThoughtV2LocalDeploymentOptions<Anchors> = {
  contractAddresses: readonly string[];
  readCode: (address: string) => Promise<string>;
  readAnchors: () => Promise<Anchors>;
  anchorsMatch: (anchors: Anchors) => boolean;
};

const hasContractCode = (code: string) => /^0x[0-9a-f]+$/i.test(code) && !/^0x0*$/i.test(code);

export const verifyThoughtV2LocalDeployment = async <Anchors>({
  contractAddresses,
  readCode,
  readAnchors,
  anchorsMatch,
}: VerifyThoughtV2LocalDeploymentOptions<Anchors>) => {
  if (contractAddresses.length === 0) {
    throw new Error(THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY);
  }

  let codes: string[];
  try {
    codes = await Promise.all(contractAddresses.map((address) => readCode(address)));
  } catch {
    throw new Error(THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY);
  }

  if (!codes.every(hasContractCode)) {
    throw new Error(THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY);
  }

  let anchors: Anchors;
  try {
    anchors = await readAnchors();
  } catch {
    throw new Error(THOUGHT_V2_LOCAL_DEPLOYMENT_UNAVAILABLE_COPY);
  }

  let matches = false;
  try {
    matches = anchorsMatch(anchors);
  } catch {
    matches = false;
  }
  if (!matches) {
    throw new Error(THOUGHT_V2_LOCAL_DEPLOYMENT_MISMATCH_COPY);
  }
};
