# ADR: Default `:::` Delimiter

**Status:** Adopted (project default)

## Decision

The engine uses **`:::`** as the default front/back delimiter in `config.json`, with optional per-file override via frontmatter `delimiter`. The legacy `?` delimiter remains supported for explicit opt-in (config or frontmatter).

## Why `:::` works well here

**1. Rare in natural prose**  
Unlike `?`, you almost never hit `:::` accidentally in normal writing, lists, or URLs.

**2. Safer on its own line than `---` or `===`**  
The matcher only sees **text nodes**. That matters:

| Pattern | What remark often does |
|---------|-------------------------|
| `---` on its own line | `thematicBreak` — **not** a delimiter |
| `===` under text | setext heading — **not** a delimiter |
| `:::` on its own line | paragraph text `:::` — **can** match |

So this layout is viable with `:::`:

```markdown
#### Card title
What is entropy?
:::
Measure of disorder
```

That is awkward with `---` / `===` and is a real plus for `:::`.

**3. Code protection still applies**  
`delimiterCheck` ignores `code`, `inlineCode`, and `math`. Rust/C++ `::` and JS `===` in snippets stay safe; you need literal `:::` in code to get a false split.

**4. Implemented behavior**  
- Config default: `"delimiter": ":::"` in [`config.json.example`](../config.json.example)
- Per-file override: `delimiter: "?"` in YAML frontmatter
- Regression fixtures:
  - [`tests/fixtures/edge-case-delimiters-triple-colon.md`](../tests/fixtures/edge-case-delimiters-triple-colon.md) — `:::` default
  - [`tests/fixtures/edge-case-delimiters-in-code.md`](../tests/fixtures/edge-case-delimiters-in-code.md) — `?` override

---

## Where conflicts can still happen

Not zero, but niche:

1. **Admonition / directive Markdown** (`::: tip`, `::: warning`) — used in Docusaurus, VuePress, some MDX stacks. The pipeline uses `remark-parse` + `remark-gfm` + wiki-link plugins, **not** `remark-directive`, so `:::` is usually plain text. Risk rises if directive plugins are added.

2. **Obsidian callouts** — native syntax is `> [!note]`, not `:::`, so **no conflict** there.

3. **Inline prose mentioning `:::`** — e.g. “use the `::: directive` syntax” outside a code span could split. Very uncommon.

4. **First match wins** — the first structural `:::` in a card block splits front/back. Multiple `:::` in one card would be ambiguous (same for any delimiter).

---

## Verdict

For an Obsidian → Anki flashcard vault, **`:::` is the right default**:

- More distinctive than `?`
- Fewer Markdown structural traps than `---` / `===`
- Works inline (`Front ::: Back`) and on its own line
- Low collision rate in real notes

Ranking for this project: **`:::` > `===` > `?` > `---`**

See [Engine-Architecture.md](Engine-Architecture.md) for the full delimiter and layout contract.
