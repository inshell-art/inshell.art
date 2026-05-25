import {
  PREVIEW_WATERMARK_LABEL,
  shouldShowPreviewWatermark,
} from "@inshell/shared";

export default function PreviewWatermark() {
  const env = (globalThis as any).__VITE_ENV__;
  if (!shouldShowPreviewWatermark({ env })) return null;

  return (
    <div className="inshell-preview-watermark" aria-hidden="true">
      {PREVIEW_WATERMARK_LABEL}
    </div>
  );
}
