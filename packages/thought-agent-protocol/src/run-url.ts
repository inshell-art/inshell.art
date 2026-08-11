export function removeTrailingSlashes(value: string): string {
  let end = value.length;

  while (end > 0 && value.charCodeAt(end - 1) === 0x2f) {
    end -= 1;
  }

  return end === value.length ? value : value.slice(0, end);
}
