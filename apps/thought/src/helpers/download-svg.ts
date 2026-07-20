function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function DownloadSVG(svgCode: string, filename = "thought.svg") {
    downloadBlob(new Blob([svgCode], { type: "image/svg+xml;charset=utf-8" }), filename);
}
