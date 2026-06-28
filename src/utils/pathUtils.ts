export function normalizePath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  const stack: string[] = [];

  for (const part of parts) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }

  return stack.join("/");
}

export function joinPath(...segments: string[]): string {
  return normalizePath(segments.filter(Boolean).join("/"));
}

export function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  return slash === -1 ? normalized : normalized.slice(slash + 1);
}

export function relativePath(from: string, to: string): string {
  const fromParts = normalizePath(from).split("/").filter(Boolean);
  const toParts = normalizePath(to).split("/").filter(Boolean);

  let index = 0;
  while (
    index < fromParts.length &&
    index < toParts.length &&
    fromParts[index] === toParts[index]
  ) {
    index += 1;
  }

  const up = fromParts.slice(index).map(() => "..");
  return normalizePath([...up, ...toParts.slice(index)].join("/"));
}

export function resolvePath(base: string, target: string): string {
  if (target.replace(/\\/g, "/").startsWith("/") || /^[A-Za-z]:\//.test(target)) {
    return normalizePath(target);
  }

  return joinPath(base, target);
}
