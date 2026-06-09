export type DownloadImageKind = "path" | "thought";

export function imageDownloadUrl(kind: DownloadImageKind, id: number | string, format = "svg"): string {
  const route = kind === "thought" ? "thought-image" : "path-image";
  const params = new URLSearchParams({
    id: String(id),
    format,
  });
  return `/api/${route}?${params.toString()}`;
}

export async function downloadPngFromImageSource(args: {
  source: string;
  filename: string;
  size?: number;
}): Promise<void> {
  if (!args.source) {
    throw new Error("image source unavailable");
  }

  const size = args.size ?? 2048;
  const image = await loadImage(args.source);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("canvas unavailable");
  }

  context.fillStyle = "#050505";
  context.fillRect(0, 0, size, size);

  const intrinsicWidth = image.naturalWidth || image.width || size;
  const intrinsicHeight = image.naturalHeight || image.height || size;
  const scale = Math.min(size / intrinsicWidth, size / intrinsicHeight);
  const width = intrinsicWidth * scale;
  const height = intrinsicHeight * scale;
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("PNG export failed"));
    }, "image/png");
  });

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = args.filename;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image load failed"));
    if (!source.startsWith("data:")) {
      image.crossOrigin = "anonymous";
    }
    image.src = source;
  });
}
