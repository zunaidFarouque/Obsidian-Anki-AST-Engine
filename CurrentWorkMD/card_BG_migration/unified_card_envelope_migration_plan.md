# Comprehensive Migration Plan: Unified Card Envelope Background Layer (Option A)

**Document Version**: 1.0  
**Status**: Pending Review & User Approval  
**Target Repository**: `Obsidian-Anki-AST-Engine` (`plugin/`)  
**Target File**: `plugin/src/cardPreviewLayer.ts` & `plugin/styles.css`  

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem
In Obsidian Live Preview, flashcards frequently contain rich multi-line content such as **MathJax display formulas** (`$$\sum_{i=1}^n ...$$`), **Callout boxes** (`> [!note] ...`), **Markdown tables**, **code blocks**, and **thematic breaks** (`---`).

Currently, card backgrounds are rendered by attaching line decorations (`.anki-card-preview-cardblock`) to every line inside a card, and using CSS `::before` pseudo-elements on each individual line and widget:
- A 15-line card is painted as **15 separate rectangular slices** attempting to touch each other.
- When an embedded block widget (like MathJax or a Table) occurs, its bounding box, padding, and margin differ from `.cm-line`.
- CSS attempts to compensate with per-widget sibling selectors (`+ .cm-embed-block.cm-table-widget`, `+ .cm-embed-block.math-block`), but each widget type has different internal metrics. For example, tables required an inward inset (`+8px`) to avoid scrollbar overflow, which when applied to MathJax created a 16px indented cutout/gap.
- Callouts have core theme styles (`background: ... !important;`) that collide with and obscure per-line pseudo-element underlays.

### 1.2 The Solution (Option A)
Instead of styling individual text lines and widgets with independent pseudo-elements, CodeMirror 6 provides a first-class, high-performance mechanism: **`layer({ above: false })`**.

A **Unified Background Layer** renders **ONE single, continuous `<div>` envelope** per card that sits physically on a background plane (`z-index: -1`, `pointer-events: none`) behind the entire editor content (`.cm-content`).

- **MathJax formulas**: Sit naturally on top of the continuous background envelope; transparent MathJax containers show the card tint with zero misalignment.
- **Callouts**: Render their standard theme styling on top of the card envelope, with the card's accent border and background flowing seamlessly around them.
- **Tables**: Sit on top of the background envelope; table scrollbars never trigger layout or underlay clipping.
- **Seams & Borders**: The card has a single, perfectly straight left border from heading to tail, with true corner rounding (`border-radius`) and zero subpixel rendering gaps between lines.

---

## 2. Risk Analysis: Preventing Past Problems

The user expressed a completely reasonable concern:
> *"We spent A LOT OF TIME going through the rules, styles etc. We need to do a comprehensive transition... How will you ensure that this will FIX the problem instead of bringing old problems?"*

Here is our explicit breakdown of past problems, why they happened, and how this architecture guarantees they will not return:

| Past Problem / Risk | Root Cause in Early Versions | How Option A Prevents This Problem | Verification Check |
|---|---|---|---|
| **1. Layout Shifts & Cursor Jumping** | Early versions added `padding-left` or `border-left` directly to `.cm-line`, changing text box metrics on render. | The layer is rendered outside the text stream in a dedicated `<div class="cm-layer">` with `position: absolute; pointer-events: none; z-index: -1`. It has **0 padding, 0 margin, and 0 layout effect** on text or cursor coordinates. | Automated tests verify `.cm-line` has no padding/margin; typing benchmarks verify cursor position stability. |
| **2. Typing Latency & Input Lag** | Re-parsing AST on every single keystroke blocked the main UI thread. | The existing CM6 transaction mapping architecture (`decorations.map(update.changes)` with 200ms debounced AST rebuild) remains **100% active**. During active typing, the envelope simply shifts with line count changes in $<0.05$ ms. | Keystroke benchmark tests in `cardPreviewEditorDecorations.test.ts` verify $<0.05$ ms transaction time. |
| **3. Breaking Delimiter Guides (`:::`)** | Garnish symbols (`↑↓`, `⌨`) and horizontal rules were tied to delimiter text lines. | **Unchanged**. Delimiter guides, field-line markers (`::: Field`), and garnish icons remain line decorations on `.cm-line`. The layer only handles the background fill and outer left border. | Unit tests in `cardPreviewUtils.test.ts` continue asserting delimiter decorations. |
| **4. Breaking Cloze Badges & 5-Color Palette** | Cloze tokens (`c1`–`c5`) and shorthand badges (`{{Java}}`) require precise text-range inline styling. | **Unchanged**. Inline cloze tokens (`anki-card-preview-cloze-token`) remain inline `Decoration.mark` widgets. They render on top of the background envelope. | 9 regression tests in `issuesRegression.test.ts` run continuously. |
| **5. Breaking Heading Badges & Tooltips** | Badges (`sync`, `warn`, `skip`, `error`) and hover tooltips require interactive DOM elements. | **Unchanged**. Badges remain CodeMirror widgets attached to heading lines at `heading.to`. The layer does not touch badges. | Badge tests in `cardPreviewEditorDecorations.test.ts` run continuously. |
| **6. Off-Screen DOM Bloat / Virtual Scrolling** | If an envelope layer creates DOM nodes for 500 cards in a 20,000-word document, memory and scroll performance degrade. | CM6's native `layer()` API **automatically virtualizes**: it queries `view.visibleRanges` and only instantiates markers for cards that intersect the current viewport. | Scroll stress test confirms low DOM node count. |
| **7. Trailing Authoring Comment Inclusion** | Early versions tinted trailing `<!--anki-id:...-->` and `<!-- expect:...-->` comments. | The envelope marker uses `ResolvedCard.range`, which ends at the last learner-facing AST node via `contentEndOffsetFromNodes`. Authoring comments stay outside the envelope. | `issuesRegression.test.ts` asserts `card.range.end` excludes trailing comments. |

---

## 3. Target Technical Architecture

### 3.1 DOM Structure

```html
<div class="cm-editor">
  <div class="cm-scroller">
    <!-- CodeMirror 6 Background Layer (New) -->
    <div class="cm-layer cm-layer-anki-envelope" style="position: absolute; z-index: -1; pointer-events: none;">
      <!-- Exactly ONE element per visible card -->
      <div class="anki-card-envelope anki-card-envelope--sync"
           style="top: 182px; height: 340px; left: 16px; right: 16px;">
      </div>
    </div>

    <!-- Normal Editor Content (Text, MathJax, Callouts, Tables) -->
    <div class="cm-content">
      <!-- Heading Line with Badge -->
      <div class="cm-line anki-card-preview-heading">
        #### [STRESS-Rich-03] MathJax expressions
        <span class="anki-card-preview-badge-slot">...</span>
      </div>
      <div class="cm-line">Calculate energy from mass: $E = mc^2$</div>
      <div class="cm-line anki-card-preview-delimiter-guide">:::</div>
      <div class="cm-line">The relativistic energy equation is:</div>
      
      <!-- Embedded Math Widget (Untouched, sits naturally on top of envelope) -->
      <div class="cm-embed-block math-block">
        <mjx-container class="MathJax">...</mjx-container>
      </div>

      <!-- Authoring comment (Outside envelope, no background) -->
      <div class="cm-line">&lt;!--anki-id: ...--&gt;</div>
    </div>
  </div>
</div>
```

### 3.2 The Envelope Marker: `CardEnvelopeMarker`

Implementing the CM6 `LayerMarker` interface:

```typescript
import { LayerMarker } from '@codemirror/view';

export class CardEnvelopeMarker implements LayerMarker {
  constructor(
    public readonly cardId: string,
    public readonly outcome: SyncOutcome,
    public readonly top: number,
    public readonly height: number,
    public readonly left: number,
    public readonly width: number,
  ) {}

  eq(other: CardEnvelopeMarker): boolean {
    return (
      this.cardId === other.cardId &&
      this.outcome === other.outcome &&
      Math.abs(this.top - other.top) < 0.5 &&
      Math.abs(this.height - other.height) < 0.5 &&
      Math.abs(this.left - other.left) < 0.5 &&
      Math.abs(this.width - other.width) < 0.5
    );
  }

  draw(): HTMLElement {
    const elt = document.createElement('div');
    elt.className = `anki-card-envelope anki-card-envelope--${this.outcome}`;
    this.adjust(elt);
    return elt;
  }

  update(dom: HTMLElement, prev: CardEnvelopeMarker): boolean {
    if (this.outcome !== prev.outcome) {
      dom.className = `anki-card-envelope anki-card-envelope--${this.outcome}`;
    }
    this.adjust(dom);
    return true;
  }

  private adjust(dom: HTMLElement): void {
    dom.style.top = `${this.top}px`;
    dom.style.height = `${this.height}px`;
    dom.style.left = `${this.left}px`;
    dom.style.width = `${this.width}px`;
  }
}
```

### 3.3 Coordinate Calculation Logic
For each card in the visible viewport:
1. **Start Position (`top`)**:
   - Query `view.lineBlockAt(card.range.start)`.
   - If card follows a section heading (`cardFollowsSectionHeading`), extend `top` upward by `cardPreviewSectionTopExtend` line-height.
2. **End Position (`bottom`)**:
   - Query `view.lineBlockAt(card.range.end - 1)`.
   - If another card follows and tail gap is enabled (`shouldPaintInterCardTail`), reduce `bottom` by `cardPreviewInterCardGapEm`.
3. **Horizontal Bounds (`left` & `width`)**:
   - Read editor content rect from `view.contentDOM.getBoundingClientRect()`.
   - Apply horizontal bleed (`--anki-card-preview-block-bleed-x: 8px`).

---

## 4. CSS Simplification & Cleanup

Because the layer handles background and left border as a single unified shape:
1. **Remove complex sibling rules**:
   - Remove `.cm-line.anki-card-preview-cardblock + .cm-embed-block.cm-table-widget`
   - Remove `.cm-line.anki-card-preview-cardblock + .cm-embed-block.math-block`
   - Remove chained `+ .cm-embed-block + .cm-embed-block` rules
   - Remove `anki-card-preview-before-mid-hr + .hr.cm-line` three-layer box-shadow hacks
2. **Clean Envelope Styles**:
   ```css
   .anki-card-envelope {
     position: absolute;
     pointer-events: none;
     border-radius: 4px;
     background: var(--anki-cardblock-paint);
     border-left: 2px solid var(--anki-cardblock-border-color);
     box-sizing: border-box;
     transition: background 120ms ease, border-color 120ms ease;
   }
   
   .anki-card-envelope--sync {
     --anki-cardblock-tint: var(--background-modifier-hover);
     --anki-cardblock-body-opacity: 38%;
     --anki-cardblock-border-color: var(--background-modifier-border);
   }
   
   .anki-card-envelope--warn {
     --anki-cardblock-tint: var(--color-yellow, #d29922);
     --anki-cardblock-body-opacity: 14%;
     --anki-cardblock-border-color: color-mix(in srgb, var(--color-yellow, #d29922) 55%, var(--background-modifier-border));
   }
   
   .anki-card-envelope--skip {
     --anki-cardblock-tint: var(--background-modifier-hover);
     --anki-cardblock-body-opacity: 19%;
     --anki-cardblock-border-color: var(--background-modifier-border);
   }
   
   .anki-card-envelope--error {
     --anki-cardblock-tint: var(--color-red, #f85149);
     --anki-cardblock-body-opacity: 14%;
     --anki-cardblock-border-color: var(--color-red, #f85149);
   }
   ```

---

## 5. Phased Implementation Steps

To ensure zero downtime, zero regressions, and maximum safety, the transition will occur in **5 controlled phases**:

### Phase 1: Build the Layer Extension (`plugin/src/cardPreviewLayer.ts`)
- Implement `CardEnvelopeMarker` and `createCardPreviewLayer()`.
- Calculate envelope coordinates using CM6 `lineBlockAt` and viewport geometry.
- Add comprehensive unit tests in `tests/plugin/cardPreviewLayer.test.ts`.

### Phase 2: Dual-Verification in Test Vault
- Enable the layer in parallel or under a feature setting (`useUnifiedEnvelopeLayer: true`).
- Verify visual alignment on all stress test fixtures:
  - `[STRESS-Rich-03]` (MathJax display math)
  - `[STRESS-Rich-01]` (Tables)
  - `[STRESS-Rich-02]` (Callouts on front and back)
  - `[STRESS-Rich-04]` (Mid-card thematic break)
  - `[STRESS-Live-01]` (Real-time keystroke scratchpad)

### Phase 3: CSS Modernization & Deprecation of Per-Line Underlays
- Switch primary background painting to `.anki-card-envelope`.
- Remove obsolete `.cm-line.anki-card-preview-cardblock::before` slice rules.
- Retain line decoration classes solely for structural delimiter guides.

### Phase 4: Automated Test Suite Expansion
- Run the full 635 test suite with `bun test`.
- Add test cases verifying:
  - Layer markers correctly calculate top, bottom, and height for multi-block cards.
  - Section-start extend and tail gap variables are respected.
  - No layout shifts occur on document lines.

### Phase 5: Production Bundle & Test Vault Deployment
- Run `bun run build:plugin`.
- Deploy to `D:\work_temp\Obsidian_Vaults\Main\.obsidian\plugins\obsidian-anki-ast-sync`.
- Perform hands-on inspection in Obsidian to verify that MathJax, Callouts, Tables, and text lines render within a single seamless envelope.

---

## 6. Verification Checklist Before Final Approval

- [ ] All 635 existing automated tests pass without regressions.
- [ ] Display math formula in `[STRESS-Rich-03]` renders with seamless background flush with card text.
- [ ] Callouts in `[STRESS-Rich-02]` render cleanly on top of the card envelope.
- [ ] Tables in `[STRESS-Rich-01]` have unbroken background and zero scrollbar overflow.
- [ ] Keystroke latency remains $<0.05$ ms.
- [ ] Delimiter guides (`:::`, `:::r`, `:::t`) and Cloze tokens (`c1`–`c5`) retain exact visual presentation.
- [ ] All 10 issues from `issues.md` remain verified.
