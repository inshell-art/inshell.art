import type { SurfaceSideEffectGate } from "surface-shell/packages/surface-shell-core/src/index.ts";

export const sideEffectNone: SurfaceSideEffectGate = {
  kind: "none",
  requiresExplicitCommand: false,
};

export const sideEffectRead = (label: string): SurfaceSideEffectGate => ({
  kind: "read",
  label,
  requiresExplicitCommand: true,
});

export const sideEffectNetwork = (label: string): SurfaceSideEffectGate => ({
  kind: "network",
  label,
  requiresExplicitCommand: true,
});

export const sideEffectExternalModel = (label: string): SurfaceSideEffectGate => ({
  kind: "external-model",
  label,
  requiresExplicitCommand: true,
});

export const sideEffectWallet = (label: string): SurfaceSideEffectGate => ({
  kind: "wallet",
  label,
  requiresExplicitCommand: true,
  requiresConfirmation: true,
});

export const sideEffectContractRead = (label: string): SurfaceSideEffectGate => ({
  kind: "contract-read",
  label,
  requiresExplicitCommand: true,
});

export const sideEffectContractWrite = (label: string): SurfaceSideEffectGate => ({
  kind: "contract-write",
  label,
  requiresExplicitCommand: true,
  requiresConfirmation: true,
});

export const sideEffectLocalWrite = (label: string): SurfaceSideEffectGate => ({
  kind: "write",
  label,
  requiresExplicitCommand: true,
});
