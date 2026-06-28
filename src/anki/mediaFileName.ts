export function toAnkiMediaFileName(vaultBaseName: string): string {
  return vaultBaseName.replace(/\s+/g, "_");
}
