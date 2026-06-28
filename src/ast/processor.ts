import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import wikiLinkPlugin from "remark-wiki-link";
import type { Root } from "mdast";
import { remarkObsidianLinks } from "./obsidianLinks";

export function parseMarkdown(rawText: string, _vaultPath: string): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(wikiLinkPlugin, {
      pageResolver: (name: string) => [name.replace(/ /g, "_").toLowerCase()],
      hrefTemplate: (permalink: string) => `#/page/${permalink}`,
    })
    .use(remarkObsidianLinks);

  const tree = processor.parse(rawText);
  return processor.runSync(tree) as Root;
}
