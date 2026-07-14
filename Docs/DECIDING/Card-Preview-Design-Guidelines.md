# Card Preview — Design Guidelines (v1)

Living UX spec for in-editor card-syntax overlays in Obsidian Live Preview. Grammar and resolver behavior are defined in [Card-Syntax-Spec.md](Card-Syntax-Spec.md); this document covers how outcomes look while authoring.

Status: design locked for v1 subtle mode; implementation tracks `plugin/src/cardPreviewEditor.ts`.

---

## 1. Goals

| Goal | Rationale |
|------|-----------|
| Unobtrusive by default | Card-heavy notes are the norm; most cards sync fine, so chrome should not fatigue the eye |
| Problems stand out | Skip, warn, and error states must be findable without scanning every line |
| Never hide syntax | Authors edit real Markdown (`:::`, `{{cN::...}}`, field blocks); overlays guide only |
| Editing mode first | Primary surface is Live Preview while editing (CodeMirror 6) |
| Same brain as sync | All outcomes come from `parseCardDocument`; preview is not a second parser |

---

## 2. Non-goals (v1)

- Source mode decorations
- Replacing Obsidian's native hashtag pills
- Per-card YAML editors
- Auto-hiding authored syntax

---

## 3. Terminology

Use **noteType** language in UI/docs (matches Anki’s editor wording):

- Built-ins: `basic`, `cloze`, `reversible`, `typed`
- Custom: `#anki/noteType/<Name>` in preview help text and chip guidance

Settings/cache naming should prefer `anki_noteTypeMap` in user-facing copy.

`#anki_card_*` and `#anki/CustomCards/...` are also supported as legacy note type tag forms.

---

## 4. Surfaces

### 4.1 Primary: Live Preview (editing)

`registerMarkdownPostProcessor` does not run in Live Preview. Overlays must use a CodeMirror 6 extension gated on `editorLivePreviewField`.

### 4.2 Secondary: Reading mode

May mirror the same visual language via post-processor; parity is desirable but not blocking for v1 subtle rollout.

### 4.3 Source mode

No overlays in v1.

---

## 5. Heading chip design

Each card declaration heading (`####` by default, configurable) gets a right-aligned chip anchored on the same source line as the heading.

### 5.1 Chip text

| Resolved type | Chip label |
|---------------|------------|
| basic | `basic` |
| cloze | `cloze` |
| reversible | `reversible` |
| typed | `typed` |
| custom noteType | noteType name (e.g. `Vocab`, `Edge`) |

### 5.2 Outcome styling (subtle mode, default)

| Outcome | Background | Border | Label suffix |
|---------|------------|--------|--------------|
| sync | none | none | none (or optional marker, §5.3) |
| skip | very faint neutral tint | none | `⛔` |
| warn | faint yellow tint | none | `⚠️` |
| error | faint red tint | red border accent | `❌` |

Format examples:
- `basic`
- `basic ⛔`
- `basic ⚠️`
- `basic ❌`

Warn overrides sync visually (`sync with warning` is shown as warn).

### 5.2.1 Card block background continuity (explicit rule)

Subtle outcome tint applies to the **entire card block**, not just the declaration heading line.

- Card block span: declaration heading line through the last body line before the next card declaration heading.
- The card block tint must render as a visually continuous block (no alternating stripes/gaps between body lines).
- Heading line keeps a stronger left accent/chip context, but body lines inherit the same card outcome tint family.
- If outcome is `sync`, keep tint very faint; `skip`/`warn`/`error` remain progressively more visible per §5.2.

### 5.2.2 Card block envelope (overlay-only)

Layout spacing is **overlay-only**: pseudo-elements on decorated `cm-line` nodes, never `padding-top` / `margin` on lines and never separate gap-line decorations on blank lines between cards.

| Concern | Decoration | CSS |
|---------|------------|-----|
| Section-start extend | When the card follows a shallower section heading (e.g. `###` then `####`), heading gets `anki-card-preview-heading--section-start` | `::before` on that heading line extends tint upward by `cardPreviewSectionTopExtend` × one line height (`0`–`1`; `0` disables). Var: `--anki-card-preview-section-top-extend` (`calc(ratio * 1lh)` or `0px`). |
| Inter-card gap | When another card follows, the last covered line of the block gets `anki-card-preview-cardblock--tail` | `::after` on that line masks the trailing tint with untinted background over `cardPreviewInterCardGapEm` (`0`–`0.8` em; `0` disables). Var: `--anki-card-preview-inter-card-gap`. |

Settings sync to `:root` via `plugin/src/cardPreviewLayout.ts` (`applyCardPreviewLayoutCssVariables`). Snippets may override the CSS variables directly.

**Sync content boundary:** Preview tint follows `ResolvedCard.range`, which ends at learner-facing content only. Outside the envelope: trailing authoring lines (`%% … %%`, non-binding `<!-- … -->`, binding `<!--anki-id-->`), trailing blank lines, and trailing section separators (`---` / thematic breaks) — including mixed tails of separators + comments only. Mid-card `---` between real paragraphs stays inside. See [Card-Rendering.md](../Card-Rendering.md#html-authoring-comments--).

**Live Preview sibling widgets:** Tables render as `.cm-embed-block.cm-table-widget` siblings (adjacent-sibling `::before` underlay). Mid-card thematic breaks render as `.hr.cm-line` siblings without cardblock decorations (Obsidian resets `::before` on `.hr`). Tint: element paint + right `box-shadow` bleed + narrow left `::after` strip (bleed fill + `border-left` accent). Mid-card `---` underlay is gated by a following cardblock line so trailing separators stay outside the envelope.

### 5.3 Sync marker options

Default is none. Optional marker in subtle mode:

- none
- card emoji
- custom Anki SVG icon

No `🔄` marker for sync.

### 5.4 Chip interaction model

Use layered interaction:

1. Lightweight tooltip for fast hover/focus
2. "More" action on chip opens modal with richer content loaded on demand

If a card has warnings/errors, that section appears first in tooltip and modal.

### 5.5 Tooltip and modal structure

**Lightweight tooltip (hover/focus):**

1. `Type: <resolved type>` (always)
2. `Situation: <state>` when the card has a primary message (`skipped` / `warning` / `error` / `info`)
3. Severity-labeled detail for that one primary message (`Problem:` / `Warning:` / `Info:`)

Presentation strips trailing canonical engine suffixes (` — skipped` / ` — warning` / ` — error`) so Situation and badge state are not repeated. Canonical engine message strings themselves are unchanged.

Healthy sync with no messages is Type only. Hover stays short; `resolvedFrom` and the full message list live in the modal.

**“More” modal (lazy-loaded):** full content in this order:

1. **Problems** — all error/warn/skip messages for this card (top priority)
2. **Current noteType structure** — what this card requires right now (see §5.7)
3. **Create other noteTypes** — concise cheatsheet from cached noteType map/settings:
   - `:::r` → reversible
   - `:::t` → typed
   - `#anki/noteType/<Name>` → custom noteType
   - `#anki/cardType/<builtin>` → built-in inheritance on headings
4. **Resolution reasoning** — `resolvedFrom` (e.g. inherited from `### Section`, delimiter, file default)
5. **Actions** — “Insert structure template” (§10), link to refresh noteType cache if fields missing

Modal content is generated on open, not kept in DOM for every chip.

### 5.6 Heading vs delimiter indicators

| Layer | Role |
|-------|------|
| **Heading chip** | Global card state: resolved noteType + worst outcome (skip/warn/error) |
| **Delimiter line** | Localized indicator when the problem is that specific line (unknown field, layout conflict, extra delimiter) |

Avoid duplicate ❌ on heading and delimiter unless messages differ (heading = summary, line = location).

### 5.7 Per-noteType structure text (modal section 2)

Content is dynamic per resolved type:

| noteType | Structure reminder |
|----------|-------------------|
| **basic** | Front prose → line-start `:::` → Back prose |
| **cloze** | Text region with `{{cN::…}}` or shorthand `{{…}}` when type is cloze; optional `:::` + Back Extra |
| **reversible** | Question prose → `:::` or `:::r` → Answer prose |
| **typed** | Question prose → `:::` or `:::t` → **one line** plain-text answer |
| **custom** | One or more `::: FieldName` blocks matching cached noteType fields |

Custom section lists **field names from cache** for the resolved noteType (e.g. Word, Definition, Example).

### 5.8 Explicit mode

`cardPreviewStyle = explicit`:
- uppercase outcome pill (`SYNC`, `SKIP`, `WARN`, `ERROR`)
- stronger borders
- intended for QA/stress testing, not daily default

---

## 6. Delimiter and field-line guides

**Placement rule:** horizontal guide and garnish sit on the **delimiter source line** (same line as `:::…` text). Emoji/indicators for field errors sit at the **right end of that same line**.

### 6.1 First structural split (DEL-01 / DEL-08)

For the **first** line-start structural delimiter in a card (`:::`, `:::r`, or `:::t`):

- keep original text visible and editable
- add horizontal guide on that line

**Subsequent** structural `:::` in the same card (DEL-08): **no** full horizontal guide — only §9 discouragement marker.

Do not decorate mid-line delimiters in prose.

Do not decorate inside `code`, `inlineCode`, or `math`.

### 6.2 Reversible / typed garnish

Garnish depends on **resolved noteType** and **delimiter token** (spec tokens are `:::r` / `:::t` without space; UI mock may show spaced labels for readability):

| Resolved type | Delimiter line | Guide garnish |
|---------------|----------------|---------------|
| **reversible** | `:::r` | `↑↓` |
| **reversible** | plain `:::` | horizontal guide only (card already knows reversible) |
| **typed** | `:::t` | keyboard symbol (e.g. ⌨ / 🖮) |
| **typed** | plain `:::` | horizontal guide only |
| **basic** | `:::` | horizontal guide only |
| **cloze** | `:::` (Back Extra) | ℹ marker (§6.3) |

`::: r` / `::: t` **with space** are custom **field names**, not reversible/typed — use field-line rules (§6.4), not ↑↓/keyboard garnish.

### 6.3 Cloze with Back Extra (`:::`)

When cloze card has optional Back Extra via `:::`, guide includes subtle info marker:

- `::: [------ ℹ ------]`

### 6.4 Custom field lines (`::: FieldName`)

Validate field names against cached noteType fields map:

| Field check | Line treatment |
|-------------|----------------|
| valid field | guide only |
| invalid field | guide + right-end indicator (`❌` or `⚠️`) |
| no field cache available | no hard validation; keep guidance/info only |

Unknown field should match resolver severity (`CUS-02` -> error unless configured otherwise).

---

## 7. Cloze visualization

### 7.1 Token highlight

In cloze-resolved cards, highlight hidden tokens with a subtle checked/hatched background behind the token text.

### 7.2 Group coloring

Tokens sharing same cloze group (`cN`) must share the same color/pattern family.
Different groups use different colors.

Palette strategy:
- fixed accessible palette with wraparound
- pattern remains consistent; only color index changes

### 7.3 Back-only cloze and `{{}}` in Back

If `{{…}}` appears only after the first `:::` on a cloze-resolved card (CLZ-11): **warn** (or skip per resolver); show reason in heading chip problems section. Do not apply cloze deletion highlight in Back for active cloze semantics.

On **basic**-resolved cards, `{{cN::…}}` only in Back (BAS-05): no type change; optional info in tooltip only.

### 7.4 Basic-resolved manual cloze (BAS-04 / CX-27a)

| `inferClozeFromManualSyntaxOnBasic` | Preview behavior |
|-------------------------------------|------------------|
| `false` (default) | Chip stays `basic ⚠️`; `{{cN::…}}` in Text has **no** cloze highlight (literal) |
| `true` | Reclassify to `cloze`; apply §7.1–7.2 cloze highlight in Text |

### 7.5 Shorthand `{{word}}` on non-cloze (BAS-03 / CLZ-04)

- **basic** + bare `{{word}}` → warn; no cloze highlight
- **non-cloze** + shorthand without `cN` → warn per resolver; no cloze highlight

### 7.6 Empty deletion (CLZ-09)

Empty `{{}}` / `{{c1::}}` → skip or warn per resolver; optional subtle underline on token in Text.

### 7.7 Hint mismatch (CLZ-06)

Secondary warn when grouped hints disagree — show in problems section; no separate loud in-body chrome unless already warn-level.

### 7.8 Custom noteType with cloze-like text (CLZ-12)

Do not apply cloze highlight for custom noteType cards. Absence of highlight is intentional.

---

## 8. Built-in layout conflicts (preview mapping)

| Spec | Preview |
|------|---------|
| BAS-01 basic, no `:::` | heading `basic ⛔` |
| BAS-06 basic + `:::r`/`:::t`/field | heading `basic ❌`; localized indicator on conflict line |
| CLZ-10 cloze + `:::r`/`:::t` | heading `cloze ❌`; indicator on delimiter line |
| REV-03 / TYP-02 missing split | heading skip styling |
| CUS-03 orphan `::: Field` | heading skip; field lines may still show guides |
| CUS-04 custom + plain `:::` only | heading skip |
| CUS-05 custom + `:::r`/`:::t` | heading error; indicator on reserved delimiter line |

---

## 9. Typed card warnings

For typed cards, show warning when:

- typed answer spans multiple lines
- typed answer contains formatting/decorators (bold, italic, etc.) instead of plain text

Both are warn severity (not error).

---

## 10. DEL-08 extra delimiter behavior

If additional structural delimiters appear after first split in same card, show subtle discouragement marker (faded helper text/icon), not hard error.

Approved copy:

`Extra delimiter ignored (still Back region)`

Intent: discourage confusing layouts without breaking valid parsing.

---

## 11. Template insertion action

Chip modal includes "Insert structure template" action for all card types.

Insertion behavior:

- insert template lines immediately after card declaration heading
- do not modify existing lines
- existing content shifts downward
- no auto-overwrite/merge

Applies to built-in and custom noteType templates.

---

## 12. File- and section-level states

| State | Preview behavior |
|-------|------------------|
| `AnkiSync` off (FM-01) | No card decorations; optional single muted status in modal/settings only (no per-heading chips) |
| Hashtag conflict on section heading (TAG-01 / TAG-02) | File/section error messages from resolver; affected descendant cards inherit error context in problems when relevant |

Delimiter setting (`settings.delimiter` ≠ `:::`) is **deferred** — v1 assumes `:::`.

---

## 13. Settings

| Setting | Default | Purpose |
|---------|---------|---------|
| `enableCardPreview` | `false` | master toggle |
| `cardPreviewStyle` | `subtle` | `subtle` or `explicit` |
| `cardPreviewSyncMarker` | `none` | `none`, `card-emoji`, `anki-icon` |
| `cardPreviewSectionTopExtend` | `0.5` | fraction of line height (`0`–`1`, step `0.05`) to extend tint above section-start cards; `0` disables. CSS: `--anki-card-preview-section-top-extend` |
| `cardPreviewInterCardGapEm` | `0.28` | untinted em gap before a card that follows another (`0`–`0.8`, step `0.05`); tail mask only (§5.2.2). CSS: `--anki-card-preview-inter-card-gap` |
| `defaultCardDeclarationHeadingLevel` | `4` | card heading level |
| `inferClozeFromManualSyntaxOnBasic` | `false` | BAS-04 / CX-27 behavior |
| `refreshNoteTypeMap` action | n/a | manual recache of noteType names + field lists from AnkiConnect |

Preview validation uses **resolver + cached noteType fields** (CUS-02). Recache when noteTypes change in Anki.

---

## 14. Performance constraints

- zero work when preview disabled
- parse once per debounced edit window
- cache parse results by file path + content hash
- lazy-load extended modal content
- avoid full DOM replacement; use line/chip decorations
- avoid animations/filters in subtle mode

---

## 15. Accessibility and visual tokens

- Do not rely on color alone — combine tint, emoji (non-sync outcomes), and tooltip text
- Cloze groups: fixed palette with wraparound; hatched/check pattern shared across groups
- CSS prefix: `anki-card-preview-*`; prefer Obsidian vars (`--text-muted`, `--color-red`, `--color-yellow`, `--background-modifier-border`)
- Layout envelope vars (§5.2.2): `--anki-card-preview-section-top-extend`, `--anki-card-preview-inter-card-gap`

---

## 16. What we do not decorate

- card body paragraphs (except cloze token backgrounds)
- mid-line delimiters in prose
- delimiters inside code/inlineCode/math
- Obsidian-native hashtag rendering

---

## 17. Implementation checklist

- [ ] Heading chip stays on heading line (no drift into body line)
- [ ] Subtle outcome styling per §5.2; warn overrides sync
- [ ] Lightweight tooltip + lazy "More" modal (§5.5)
- [ ] Per-noteType structure text + other-types cheatsheet (§5.7)
- [ ] Template insertion after heading for all types (§11)
- [ ] First-delimiter guides; DEL-08 discouragement on extras (§6.1, §10)
- [ ] Reversible ↑↓ and typed keyboard garnish (§6.2)
- [ ] Cloze Back Extra ℹ marker (§6.3)
- [ ] CUS-02 line-end validation with cached noteType map + recache action
- [ ] Cloze highlight + BAS-04 reclassify behavior (§7)
- [ ] Back-only `{{}}` warn (§7.3)
- [ ] Typed multiline/formatting warns (§9)
- [ ] Layout conflict mapping (§8)
- [ ] File-level `AnkiSync` off behavior (§12)
- [ ] Unit tests for mapping, placement, line detection, template insertion

---

## 18. Related documents

- [Card-Syntax-Spec.md](Card-Syntax-Spec.md) — grammar, rule IDs, outcomes
- [Engine-Architecture.md](../Engine-Architecture.md) — sync pipeline context
- [Card-Rendering.md](../Card-Rendering.md) — Anki HTML compile (separate concern)
- Stress fixture: `tests/fixtures/new format/card-syntax-stress-test.md`

---

## 19. Revision history

| Date | Change |
|------|--------|
| 2026-06-30 | Initial subtle-mode guidelines |
| 2026-06-30 | Locked chip interaction, noteType wording, cloze visuals, typed warnings, delimiter markers, template insertion rules |
| 2026-06-30 | Verification pass: per-type structure text, conflict matrix, BAS-04/CLZ back rules, heading vs line indicators, DEL-08 vs first-delimiter guides, file-level states, accessibility |
| 2026-06-30 | §5.2.2 overlay-only envelope: section-top extend + inter-card tail mask; settings `cardPreviewSectionTopExtend`, `cardPreviewInterCardGapEm` |
| 2026-06-30 | Sync content boundary: authoring `%%` / `<!-- -->` lines excluded from envelope tint |
| 2026-07-15 | Sync content boundary: trailing `---` / thematic breaks (alone or with comment tails) excluded from envelope tint |
