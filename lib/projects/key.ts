export function suggestProjectKey(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 10);

  if (!normalized) {
    return "";
  }

  const withLetter = /^[A-Z]/.test(normalized)
    ? normalized
    : `P${normalized}`.slice(0, 10);

  if (withLetter.length === 1) {
    return `${withLetter}X`;
  }

  return withLetter;
}
