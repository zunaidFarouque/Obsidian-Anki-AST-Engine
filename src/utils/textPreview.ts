import type { Content } from "mdast";
import { visit } from "unist-util-visit";

export function nodesToPreview(nodes: Content[]): string {
  const parts: string[] = [];

  for (const node of nodes) {
    visit(node, (visited) => {
      if (visited.type === "text" && "value" in visited) {
        parts.push(String(visited.value));
      }
    });
  }

  return parts.join("").replace(/\s+/g, " ").trim();
}
