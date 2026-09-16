---
AnkiSync: true
cardDeclarationHeadingLevel: 4
anki_cardDefault: basic
anki_customCardDefault: Vocab
includeParentHeadersAsTags: true
target_anki_deck: STRESS-Permutations
---

<!--
═══════════════════════════════════════════════════════════════════════
 FULL PERMUTATION STRESS TEST SUITE: LIVE PREVIEW & SYNC (v1 Engine)
 Spec:     Docs/DECIDING/Card-Syntax-Spec.md
 Contract: Docs/DECIDING/DECIDED-Preview-Sync-Contract-2026-07.md
 Automated sibling: tests/fixtures/new format/card-syntax-stress-test.md
═══════════════════════════════════════════════════════════════════════

 HOW TO USE
 1. Open this file in Obsidian Desktop with the Anki AST Sync plugin enabled.
 2. Turn Live Preview mode ON.
 3. Verify every card's Live Preview decorations:
    • Heading badges: Chip outcome (sync, warn, skip, error) and resolved type.
    • Delimiter lines: Garnish icons (↑↓, ⌨, ℹ) and horizontal field guide lines (::: FieldName).
    • Cloze highlights: Distinct palette colors for c1, c2, c3, c4, c5.
    • Extra delimiter warnings: Line attribute data-delimiter-extra overlay.
    • Underlays: Mid-card HR peek accent, table underlays, and card block tinting.
 4. Click any badge to open the Card Preview Modal:
    • Check that Situation, Problem, Warning, and Note Type details match expectations.
    • Test clicking "Insert structure template" to see editor-aware insertion.
 5. Run Note / Vault Sync to Anki (Anki Desktop + AnkiConnect running):
    • Stock models (Basic, Cloze, Reversible, Typed) sync to Anki.
    • Custom note types (Vocab) identify accurately with field guide lines.
    • In Anki Browser: search `deck:"STRESS-Permutations" "STRESS-"`.
-->

# Full Permutation Stress Test Suite

Comprehensive human smoke and permutation test suite for **Built-in Stock Models**, **Custom Note Types**, **Live Preview Decorations**, and **Rich Formatting Underlays**.

---

## 1. Basic Cards

### Subsection 1.0 — Baseline

#### [STRESS-Basic-01] OK with delimiter #stress-smoke

What is the speed of light in vacuum (STRESS-Basic-01)?

:::

Approximately \(3 \times 10^8\) m/s.

<!-- expect:
  preview: sync — basic
  anki: YES model="Basic" fields=Front,Back
  rules: BAS-01, BAS-02, FM-02
  check: Browser search "STRESS-Basic-01"; model Basic; Back contains 10^8
-->

#### [STRESS-Basic-02] Heading as front

:::

Back-only body for heading-as-front card (STRESS-Basic-02).

<!-- expect:
  preview: sync — basic; empty Text region → heading title is Front
  anki: YES model="Basic" fields=Front,Back
  rules: BAS-02
  check: Front HTML contains "STRESS-Basic-02"; Back is the paragraph after :::
-->

#### [STRESS-Basic-03] Empty back allowed

Front text with delimiter but no Back content (STRESS-Basic-03).

:::

<!-- expect:
  preview: sync — basic; empty Back region is valid
  anki: YES model="Basic" fields=Front,Back
  rules: BAS-02
  check: Basic note exists; Back field empty or minimal
-->

#### [STRESS-Basic-04] Missing delimiter skip

STRESS-Basic-04 front-only prose with no structural split token.

<!-- expect:
  preview: skip — basic missing :::
  anki: NO (hard-block)
  rules: BAS-01, CX-08
  check: Skip chip; sync results hard-block; no Anki note for this front
-->

#### [STRESS-Basic-05] Bare mustache warn

The STRESS-Basic-05 config uses {{username}} for the active account.

:::

See the deployment guide (literal braces stay on Front).

<!-- expect:
  preview: warn — literal {{username}} on basic
  anki: YES model="Basic" fields=Front,Back
  rules: BAS-03, CX-07
  check: Warn in preview + sync results; Front still contains {{username}}
-->

#### [STRESS-Basic-06] cN literal when inferCloze OFF

The STRESS-Basic-06 {{c1::mitochondria}} appears on a basic-resolved card.

:::

Organelle detail (stay Basic while inferClozeFromManualSyntaxOnBasic is false).

<!-- expect:
  preview: warn — literal cloze markup on basic (OFF) | sync cloze (ON → see Infer-01)
  anki: YES model="Basic" fields=Front,Back (OFF) | YES model="Cloze" fields=Text,"Back Extra" (ON)
  rules: BAS-04, CX-27
  check: With inferCloze OFF: Basic model + warn; toggle ON and re-sync → Cloze model
-->

#### [STRESS-Basic-07] cN only in Back stays basic

What organelle produces ATP (STRESS-Basic-07)?

:::

The answer mentions {{c1::mitochondria}} but Back is not scanned for cloze typing.

<!-- expect:
  preview: sync — basic
  anki: YES model="Basic" fields=Front,Back
  rules: BAS-05, CX-24
  check: Basic model; cloze markup only on Back field
-->

#### [STRESS-Basic-08] Extra delimiter ignored

Front question before first split (STRESS-Basic-08).

:::

Back content part one.

:::

Back content part two (extra delimiter ignored; still Back region).

<!-- expect:
  preview: sync — basic
  anki: YES model="Basic" fields=Front,Back
  rules: DEL-08
  check: Live Preview displays "Extra delimiter ignored" overlay on 2nd :::; Back contains both parts
-->

---

## 2. Cloze Cards

### Subsection 2.0 — Cloze Gallery #anki/cardType/cloze

#### [STRESS-Cloze-01] Manual c1 in Text

The {{c1::mitochondria}} produces ATP (STRESS-Cloze-01).

<!-- expect:
  preview: sync — cloze
  anki: YES model="Cloze" fields=Text,"Back Extra"
  rules: CLZ-08, STR-02
  check: Browser search "STRESS-Cloze-01"; Text contains {{c1::mitochondria}}
-->

#### [STRESS-Cloze-02] Shorthand deletion

The {{entropy}} increases in an isolated system (STRESS-Cloze-02).

<!-- expect:
  preview: sync — cloze inherited from ### section
  anki: YES model="Cloze" fields=Text,"Back Extra"
  rules: CLZ-04, CX-04, STR-02
  check: Auto-numbered cloze in Text; Back Extra empty OK
-->

#### [STRESS-Cloze-03] Auto-number and hints

{{Java}} runs on a JVM. {{java}} is same group. {{Python}} is a new group (STRESS-Cloze-03).

<!-- expect:
  preview: sync — cloze; c1=Java/java, c2=Python
  anki: YES model="Cloze" fields=Text,"Back Extra"
  rules: CLZ-05, CLZ-06
  check: Text has {{c1::Java}} and {{c2::Python}} (or equivalent numbering)
-->

#### [STRESS-Cloze-04] Back Extra after split

{{c1::Gibbs free energy}} symbol is ΔG (STRESS-Cloze-04).

:::

Optional reference: ΔG = ΔH − TΔS.

<!-- expect:
  preview: sync — cloze + optional Back Extra
  anki: YES model="Cloze" fields=Text,"Back Extra"
  rules: CLZ-02, CX-25
  check: Text has cloze; Back Extra contains "Optional reference"
-->

#### [STRESS-Cloze-05] Skip no deletions in Text

STRESS-Cloze-05 card under cloze section with no deletions at all.

:::

Back Extra content here.

<!-- expect:
  preview: skip — cloze missing deletions
  anki: NO (hard-block)
  rules: CLZ-01, CX-05
  check: Skip chip; no Anki note
-->

#### [STRESS-Cloze-06] Empty deletion skip

STRESS-Cloze-06 has an empty {{}} deletion.

<!-- expect:
  preview: skip — empty deletion
  anki: NO (hard-block)
  rules: CLZ-09, CX-28
  check: Skip chip; no Anki note
-->

#### [STRESS-Cloze-07] Cloze error back-only

Front prose without deletions (STRESS-Cloze-07).

:::

Back has {{c1::cloze deletion}} which is invalid on cloze-resolved cards.

<!-- expect:
  preview: error — cloze markup only in Back
  anki: NO (hard-block)
  rules: CLZ-11, CX-12
  check: Error chip; sync hard-blocks
-->

#### [STRESS-Cloze-08] Cloze plus reversible conflict

The {{c1::enzyme}} lowers activation energy (STRESS-Cloze-08).

:::r

Reaction rate increases.

<!-- expect:
  preview: error — cloze vs reversible delimiter conflict
  anki: NO (hard-block)
  rules: CLZ-10, REV-05, CX-30
  check: Error chip; sync hard-blocks
-->

#### [STRESS-Cloze-09] Multi-cloze palette visual test

{{c1::First group}} and {{c2::Second group}} plus {{c3::Third group}} with {{c4::Fourth group}} and {{c5::Fifth group}}.

<!-- expect:
  preview: sync — cloze
  anki: YES model="Cloze" fields=Text,"Back Extra"
  check: Live Preview renders 5 distinct palette colors (anki-card-preview-cloze-group-1 through 5)
-->

---

## 3. Reversible Cards

### Subsection 3.0 — Reversible Smoke

#### [STRESS-Rev-01] Reversible delimiter only

Chemical symbol for Gold (STRESS-Rev-01)?

:::r

Au

<!-- expect:
  preview: sync — reversible (↑↓ garnish on delimiter line)
  anki: YES model="Basic (and reversed card)" fields=Front,Back
  rules: DEL-02, CX-14
  check: Live Preview displays "↑↓" on :::r line; Anki generates forward and reverse cards
-->

#### [STRESS-Rev-02] Reversible tag with plain delimiter #anki/cardType/reversible

Chemical symbol for Silver (STRESS-Rev-02)?

:::

Ag

<!-- expect:
  preview: sync — reversible (↑↓ garnish on :::)
  anki: YES model="Basic (and reversed card)" fields=Front,Back
  rules: CX-16
  check: Live Preview displays "↑↓" on plain ::: delimiter
-->

#### [STRESS-Rev-03] Reversible skip no split #anki/cardType/reversible

STRESS-Rev-03 reversible card missing delimiter split.

<!-- expect:
  preview: skip — reversible missing split
  anki: NO (hard-block)
  rules: REV-03
  check: Skip chip; no Anki note
-->

#### [STRESS-Rev-04] Reversible plus typed conflict #anki/cardType/reversible

Capital of France (STRESS-Rev-04)?

:::t

Paris

<!-- expect:
  preview: error — reversible vs typed conflict
  anki: NO (hard-block)
  rules: REV-06, CX-31
  check: Error chip; no Anki write
-->

---

## 4. Typed Cards

### Subsection 4.0 — Typed Smoke

#### [STRESS-Typed-01] HTML stripped TYP-03b warn

Name the capital of France (STRESS-Typed-01).

:::t

**Paris** with <sub>accent</sub>

<!-- expect:
  preview: warn — formatting stripped for type-in answer (⌨ garnish)
  anki: YES model="Basic (type in the answer)" fields=Front,Back
  rules: TYP-01, TYP-03, TYP-03b
  check: Back plain text `Paris with accent`; no HTML/markdown in Back
-->

#### [STRESS-Typed-02] Tag with plain split #anki/cardType/typed

2 + 2 = ? (STRESS-Typed-02)

:::

4

<!-- expect:
  preview: sync — typed (⌨ garnish on plain :::)
  anki: YES model="Basic (type in the answer)" fields=Front,Back
  rules: TYP-01, TYP-02, CX-18
  check: Typed model; Back exactly `4`
-->

#### [STRESS-Typed-03] TYP-05 multi-answer pipes

Name a capital of France (STRESS-Typed-03).

:::t

Paris | Lyon | Marseille

<!-- expect:
  preview: sync — typed multi-answer
  anki: YES model="Basic (type in the answer)" fields=Front,Back
  rules: TYP-05
  check: Back field exactly `Paris|Lyon|Marseille`; all three accepted in review
-->

#### [STRESS-Typed-04] Skip no split #anki/cardType/typed

STRESS-Typed-04 typed card missing any split token.

<!-- expect:
  preview: skip — typed missing split
  anki: NO (hard-block)
  rules: TYP-02
  check: Skip chip; no Anki note
-->

#### [STRESS-Typed-05] Multiline typed answer warn

What is the capital of Germany (STRESS-Typed-05)?

:::t

Berlin
Extra explanatory line that should trigger a warning.

<!-- expect:
  preview: warn — typed answer should be a single line (TYP-04)
  anki: YES model="Basic (type in the answer)" fields=Front,Back
  rules: TYP-04
  check: Warning badge in preview; only first line used or warning surfaced
-->

---

## 5. Custom Note Types

### Subsection 5.0 — Vocab Note Type #anki/noteType/Vocab

#### [STRESS-Custom-01] Multi-field explicit Vocab #anki/noteType/Vocab

::: Word

ephemeral (STRESS-Custom-01)

::: Definition

Lasting for a very short time; transitory.

::: Example

Fashions are ephemeral, but style endures.

<!-- expect:
  preview: sync — custom Vocab
  anki: Custom note type identified; field guide lines display on each ::: Field
  rules: CUS-01
  check: Live Preview displays horizontal field guide lines for Word, Definition, and Example
-->

#### [STRESS-Custom-02] Resolved via frontmatter anki_customCardDefault

::: Word

serendipity (STRESS-Custom-02)

::: Definition

The occurrence of events by chance in a happy or beneficial way.

::: Example

We found each other by pure serendipity.

<!-- expect:
  preview: sync — custom Vocab (via frontmatter anki_customCardDefault)
  rules: RES-04, FM-03
  check: Resolves to Vocab even without hashtag on card or section
-->

#### [STRESS-Custom-03] Inherited from section heading

::: Word

quintessential (STRESS-Custom-03)

::: Definition

Representing the most perfect or typical example of a quality or class.

::: Example

He was the quintessential English gentleman.

<!-- expect:
  preview: sync — custom Vocab from ### Subsection 5.0
  rules: RES-08
  check: Resolves to Vocab via ancestor outline tree
-->

#### [STRESS-Custom-04] Custom field typo unknown field error

::: Word

ubiquitous (STRESS-Custom-04)

::: Definiton

Present, appearing, or found everywhere (typo in field name!).

::: Example

Smartphones have become ubiquitous in daily life.

<!-- expect:
  preview: error/warn — unknown field "Definiton" for noteType Vocab
  rules: CUS-02
  check: Badge shows error/warning for invalid field block name
-->

#### [STRESS-Custom-05] Custom note type missing field blocks

STRESS-Custom-05 prose under Vocab section with no ::: Field blocks.

:::

Plain back text without field delimiters.

<!-- expect:
  preview: skip — invalid custom layout
  rules: CUS-04, CX-20
  check: Skip chip; cannot use plain split for custom note type
-->

#### [STRESS-Custom-06] Custom note type plus reversible conflict

::: Word

paradox (STRESS-Custom-06)

:::r

A seemingly absurd statement that may be true.

<!-- expect:
  preview: error — custom noteType vs :::r conflict
  rules: CX-21
  check: Error badge; cannot use :::r inside custom note type
-->

#### [STRESS-Custom-07] Literal braces in custom field

::: Word

syntax (STRESS-Custom-07)

::: Definition

The arrangement of words and phrases; braces like {{template}} are literal here.

::: Example

In programming, {{variable}} syntax must be valid.

<!-- expect:
  preview: sync — custom Vocab
  rules: CLZ-12
  check: Braces stay literal without triggering cloze reclassification
-->

#### [STRESS-Custom-08] Legacy syntax compatibility #anki_card_Vocab

::: Word

pragmatic (STRESS-Custom-08)

::: Definition

Dealing with things sensibly and realistically.

::: Example

A pragmatic approach to problem-solving.

<!-- expect:
  preview: sync — custom Vocab
  rules: CUS-01
  check: Legacy #anki_card_Vocab tag correctly resolves as Vocab
-->

#### [STRESS-Custom-09] Modal Structure Template verification #anki/noteType/Vocab

::: Word

benchmark (STRESS-Custom-09)

::: Definition

A standard or point of reference against which things may be compared.

::: Example

Click the card badge above to open the preview modal and click "Insert structure template".

<!-- expect:
  preview: sync — custom Vocab
  check: Clicking badge opens modal; "Insert structure template" inserts fields cleanly via active editor
-->

---

## 6. Section Inheritance & Outline Isolation

### Unit A — Cloze Section #anki/cardType/cloze

#### [STRESS-Sect-01] Inherited cloze section

{{ATP}} carries chemical energy in cells (STRESS-Sect-01).

<!-- expect:
  preview: sync — cloze from ### Unit A
  anki: YES model="Cloze" fields=Text,"Back Extra"
  rules: STR-02, CLZ-04, RES-03
  check: Cloze model without per-card type tag
-->

#### [STRESS-Sect-02] Basic override in cloze section #anki/cardType/basic

What is ΔG in thermodynamics (STRESS-Sect-02)?

:::

Gibbs free energy.

<!-- expect:
  preview: sync — basic overrides ancestor cloze
  anki: YES model="Basic" fields=Front,Back
  rules: RES-01, CX-03
  check: Basic model despite ### cloze parent
-->

### Unit B — Sibling Isolation (Basic)

#### [STRESS-Sect-03] Sibling does not inherit cloze

What is H₂O (STRESS-Sect-03)?

:::

Water.

<!-- expect:
  preview: sync — basic
  anki: YES model="Basic" fields=Front,Back
  rules: RES-02, CX-23
  check: Sibling section does not inherit Unit A cloze; Basic not Cloze
-->

### Unit C — Tag Separation #exam-prep #anki/cardType/cloze

#### [STRESS-Sect-04] User tag separated from engine tag

The {{c1::Krebs cycle}} takes place in mitochondria (STRESS-Sect-04).

<!-- expect:
  preview: sync — cloze
  anki: YES model="Cloze" fields=Text,"Back Extra"
  rules: STR-04, CX-29
  check: Anki tags include exam-prep; `#anki/cardType/cloze` is stripped
-->

---

## 7. inferCloze Setting Parity

#### [STRESS-Infer-01] Reclassifies to Cloze when inferCloze ON

The {{c1::chloroplast}} is the site of photosynthesis (STRESS-Infer-01).

:::

Green organelle in plant cells.

<!-- expect:
  preview: sync — cloze when inferCloze ON | warn basic when OFF (mirror Basic-06)
  anki: YES model="Cloze" fields=Text,"Back Extra" (ON) | YES model="Basic" (OFF)
  rules: BAS-04, CX-27
  check: Preview type chip and Anki model flip in lockstep when setting is toggled
-->

---

## 8. Cross-Cutting Conflicts (CX-01 to CX-30)

#### [STRESS-Conf-01] Basic tag plus reversible delimiter #anki/cardType/basic

STRESS-Conf-01 should not become reversible when basic is explicit.

:::r

Wrong split for explicit basic.

<!-- expect:
  preview: error — BAS-06 layout conflict
  anki: NO (hard-block)
  rules: BAS-06, REV-04, CX-17
  check: Error chip; no Anki note
-->

#### [STRESS-Conf-02] Basic tag plus custom field block #anki/cardType/basic

Plain front text for basic card (STRESS-Conf-02).

::: Word

Cannot use field blocks on explicit basic card.

<!-- expect:
  preview: error — BAS-06, CX-10
  rules: BAS-06, CX-10
  check: Error badge; invalid field block on basic card
-->

#### [STRESS-Conf-03] Dual cardType conflict #anki/cardType/cloze #anki/cardType/basic

Question under heading with dual contradictory card types (STRESS-Conf-03)?

:::

Answer.

<!-- expect:
  preview: error — TAG-01, CX-01
  rules: TAG-01, CX-01
  check: Error badge for conflicting cardType hashtags
-->

#### [STRESS-Conf-04] CardType plus noteType conflict #anki/cardType/cloze #anki/noteType/Vocab

::: Word

entropy (STRESS-Conf-04)

::: Definition

Energy dispersal.

<!-- expect:
  preview: error — TAG-02, CX-02
  rules: TAG-02, CX-02
  check: Error badge for cardType + noteType combination
-->

---

## 9. Rich Formatting, Math & Underlays

### Subsection 9.0 — Rich Content

#### [STRESS-Rich-01] Table underlay test

What are the state transitions (STRESS-Rich-01)?

| From | To | Process |
| ---- | -- | ------- |
| Solid | Liquid | Melting |
| Liquid | Gas | Boiling |

:::

Here is the phase summary:

| Phase | Entropy |
| ----- | ------- |
| Solid | Low |
| Gas | High |

<!-- expect:
  preview: sync — basic
  anki: YES model="Basic" fields=Front,Back
  check: Live Preview table underlays render without overflow or horizontal bleed clipping
-->

#### [STRESS-Rich-02] Callout blocks on front and back

> [!note] Important Question
> What is the second law of thermodynamics (STRESS-Rich-02)?

:::

> [!warning] Key Takeaway
> The entropy of an isolated system always increases over time.

<!-- expect:
  preview: sync — basic
  anki: YES model="Basic" fields=Front,Back
  check: Callout boxes display with proper styling in Live Preview and Anki HTML
-->

#### [STRESS-Rich-03] MathJax expressions

Calculate energy from mass: $E = mc^2$ (STRESS-Rich-03).

:::

The relativistic energy equation is:

$$\sum_{i=1}^n x_i = \int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$

<!-- expect:
  preview: sync — basic
  anki: YES model="Basic" fields=Front,Back
  check: Math expressions render cleanly in Live Preview and compile into MathJax elements for Anki
-->

#### [STRESS-Rich-04] Mid-card thematic break underlay

What is the first step of cellular respiration (STRESS-Rich-04)?

---

Hint: Occurs in the cytoplasm without oxygen.

:::

Glycolysis.

<!-- expect:
  preview: sync — basic
  anki: YES model="Basic" fields=Front,Back
  check: Thematic break `---` inside card body displays peek accent underlay without altering HR layout
-->

#### [STRESS-Rich-05] Code block delimiter safety

How do you print a delimiter in Python (STRESS-Rich-05)?

```python
# Delimiter inside code fence must NOT split the card
print(":::")
print(":::r")
```

:::

Use standard print statements as shown on front.

<!-- expect:
  preview: sync — basic
  anki: YES model="Basic" fields=Front,Back
  rules: DEL-07
  check: Delimiters inside code fences remain literal and do not split regions
-->

#### [STRESS-Rich-06] Empty-heading resilience

####

What is the powerhouse of the cell (STRESS-Rich-06 empty heading)?

:::

Mitochondria.

<!-- expect:
  preview: sync — basic
  anki: YES model="Basic" fields=Front,Back
  check: Heading with empty text maintains exact card ordinal and compiles correctly
-->

---

## 10. Live Preview Real-time Keystroke Responsiveness

#### [STRESS-Live-01] Instant typing scratchpad

Type freely in this paragraph to verify that keystrokes have zero input latency (<0.05 ms). Notice that decorations shift immediately, and after a 200 ms pause, the AST re-parses smoothly.

:::

Back content for typing scratchpad.

<!-- expect:
  preview: sync — basic
  check: Rapid typing has zero lag; badge remains anchored at heading end
-->

---

## 11. Comprehensive Verification Matrix

| Card ID | Scenario | Expected Preview | Delimiter Visual | Anki Sync | Verified |
| ------- | -------- | ---------------- | ---------------- | --------- | :------: |
| **Basic-01** | Standard Basic OK | `sync` Basic | Guide line | YES `Basic` | ☐ |
| **Basic-02** | Heading as front | `sync` Basic | Guide line | YES `Basic` | ☐ |
| **Basic-03** | Empty back allowed | `sync` Basic | Guide line | YES `Basic` | ☐ |
| **Basic-04** | Missing delimiter | `skip` Basic | None | NO (Hard-block) | ☐ |
| **Basic-05** | Bare mustache | `warn` Basic | Guide line | YES `Basic` (Warning) | ☐ |
| **Basic-06** | `{{cN::}}` inferCloze OFF | `warn` Basic | Guide line | YES `Basic` (Warning) | ☐ |
| **Basic-07** | `cN` only in Back | `sync` Basic | Guide line | YES `Basic` | ☐ |
| **Basic-08** | Extra delimiter ignored | `sync` Basic | Guide line + Extra warn | YES `Basic` | ☐ |
| **Cloze-01** | Manual `{{c1::}}` | `sync` Cloze | None | YES `Cloze` | ☐ |
| **Cloze-02** | Shorthand `{{...}}` | `sync` Cloze | None | YES `Cloze` | ☐ |
| **Cloze-03** | Auto-number case group | `sync` Cloze | None | YES `Cloze` | ☐ |
| **Cloze-04** | Cloze + Back Extra | `sync` Cloze | `ℹ` Guide line | YES `Cloze` | ☐ |
| **Cloze-05** | No deletions in Text | `skip` Cloze | None | NO (Hard-block) | ☐ |
| **Cloze-06** | Empty deletion `{{}}` | `skip` Cloze | None | NO (Hard-block) | ☐ |
| **Cloze-07** | Back-only cloze error | `error` Cloze | Guide line | NO (Hard-block) | ☐ |
| **Cloze-08** | Cloze + `:::r` conflict | `error` Cloze | `↑↓` Guide line | NO (Hard-block) | ☐ |
| **Cloze-09** | 5-color palette test | `sync` Cloze | None | YES `Cloze` | ☐ |
| **Rev-01** | `:::r` only | `sync` Reversible | `↑↓` Guide line | YES `Reversible` | ☐ |
| **Rev-02** | Reversible tag + `:::` | `sync` Reversible | `↑↓` Guide line | YES `Reversible` | ☐ |
| **Rev-03** | Reversible missing split | `skip` Reversible | None | NO (Hard-block) | ☐ |
| **Rev-04** | Reversible + `:::t` conflict | `error` Reversible | `⌨` Guide line | NO (Hard-block) | ☐ |
| **Typed-01** | `:::t` HTML stripped | `warn` Typed | `⌨` Guide line | YES `Typed` | ☐ |
| **Typed-02** | Typed tag + `:::` | `sync` Typed | `⌨` Guide line | YES `Typed` | ☐ |
| **Typed-03** | Multi-answer pipes | `sync` Typed | `⌨` Guide line | YES `Typed` | ☐ |
| **Typed-04** | Typed missing split | `skip` Typed | None | NO (Hard-block) | ☐ |
| **Typed-05** | Multiline typed answer | `warn` Typed | `⌨` Guide line | YES `Typed` | ☐ |
| **Custom-01** | Multi-field Vocab explicit | `sync` Vocab | Field Guide lines | Identified | ☐ |
| **Custom-02** | Resolved via frontmatter | `sync` Vocab | Field Guide lines | Identified | ☐ |
| **Custom-03** | Inherited from section | `sync` Vocab | Field Guide lines | Identified | ☐ |
| **Custom-04** | Field typo unknown field | `warn` Vocab | Field Guide lines | Identified (Warn) | ☐ |
| **Custom-05** | Custom missing fields | `skip` Vocab | None | NO (Hard-block) | ☐ |
| **Custom-06** | Custom + `:::r` conflict | `error` Vocab | `↑↓` Guide line | NO (Hard-block) | ☐ |
| **Custom-07** | Literal braces in field | `sync` Vocab | Field Guide lines | Identified | ☐ |
| **Custom-08** | Legacy `#anki_card_` | `sync` Vocab | Field Guide lines | Identified | ☐ |
| **Custom-09** | Modal Template insert | `sync` Vocab | Field Guide lines | Template inserted | ☐ |
| **Sect-01** | Inherited cloze section | `sync` Cloze | None | YES `Cloze` | ☐ |
| **Sect-02** | Basic override in cloze | `sync` Basic | Guide line | YES `Basic` | ☐ |
| **Sect-03** | Sibling section isolation | `sync` Basic | Guide line | YES `Basic` | ☐ |
| **Sect-04** | User tag vs engine tag | `sync` Cloze | None | YES `Cloze` | ☐ |
| **Infer-01** | inferCloze setting parity | `sync` / `warn` | Guide line | Flipped on toggle | ☐ |
| **Conf-01** | Basic tag + `:::r` error | `error` Basic | `↑↓` Guide line | NO (Hard-block) | ☐ |
| **Conf-02** | Basic tag + `::: Field` | `error` Basic | Field Guide line | NO (Hard-block) | ☐ |
| **Conf-03** | Dual cardType tags | `error` Conflict | Guide line | NO (Hard-block) | ☐ |
| **Conf-04** | CardType + NoteType tags | `error` Conflict | Field Guide line | NO (Hard-block) | ☐ |
| **Rich-01** | Table underlay | `sync` Basic | Guide line | YES `Basic` | ☐ |
| **Rich-02** | Callout blocks | `sync` Basic | Guide line | YES `Basic` | ☐ |
| **Rich-03** | MathJax $ and $$ | `sync` Basic | Guide line | YES `Basic` | ☐ |
| **Rich-04** | Mid-card HR underlay | `sync` Basic | Guide line | YES `Basic` | ☐ |
| **Rich-05** | Delimiter in code fence | `sync` Basic | Guide line | YES `Basic` | ☐ |
| **Rich-06** | Empty heading | `sync` Basic | Guide line | YES `Basic` | ☐ |
| **Live-01** | Typing scratchpad | `sync` Basic | Guide line | YES `Basic` | ☐ |
