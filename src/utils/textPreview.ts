import type { RootContent } from "mdast";
import { visit } from "unist-util-visit";

export function nodesToRawText(nodes: RootContent[]): string {
  const parts: string[] = [];

  for (const node of nodes) {
    const nodeParts: string[] = [];
    visit(node, (visited) => {
      if (visited.type === "text" && "value" in visited) {
        nodeParts.push(String(visited.value));
      }
    });
    if (nodeParts.length > 0) {
      parts.push(nodeParts.join(""));
    }
  }

  return parts.join("\n");
}

export function nodesToPreview(nodes: RootContent[]): string {
  return nodesToRawText(nodes).replace(/\s+/g, " ").trim();
}
