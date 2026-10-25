export function suggestTaskKindKey(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 32);

  if (!normalized) {
    return "";
  }

  const withLetter = /^[a-z]/.test(normalized)
    ? normalized
    : `kind_${normalized}`.slice(0, 32);

  return withLetter;
}
