---
AnkiSync: true
cardDeclarationHeadingLevel: 4
anki_cardDefault: basic
includeParentHeadersAsTags: true
# Suggested Anki deck for this note (set in plugin config if different):
# target_anki_deck: STRESS-Built-Ins
---

<!--
═══════════════════════════════════════════════════════════════════════
 BUILT-IN CARD TYPES — Manual Obsidian + Anki smoke (Phases 1–2c)
 Spec:     Docs/DECIDING/Card-Syntax-Spec.md
 Contract: Docs/DECIDING/DECIDED-Preview-Sync-Contract-2026-07.md
 Status:   CurrentWorkMD/_ImplementationStatus_COMPLETE_WAVE.md
 Automated sibling: tests/fixtures/new format/card-syntax-stress-test.md
═══════════════════════════════════════════════════════════════════════

 HOW TO USE
 1. Copy this file into an Obsidian vault folder scanned by the plugin.
 2. Anki Desktop + AnkiConnect running; Live Preview ON.
 3. Confirm YAML `AnkiSync: true` (or on/yes).
 4. Open each #### card — preview chip + resolved type must match `preview:` below.
 5. Rebuild / redeploy the plugin before this smoke (parser injects `<!--anki-id-->`
    at front end for Text-only cloze). Do not add empty `:::` just to force an id.
 6. Run vault / note sync.
 7. In sync results: skip/error = hard-block; warn = still writes; check type-mix counts.
 8. In Anki Browser: search `deck:"STRESS-Built-Ins" "STRESS-"` or Front contains `STRESS-`.
 9. Spot-check Text-only cloze (Cloze-01/02/03, Sect-01/04): note body should gain
    `<!--anki-id: …-->` at end of Text / front range — no `:::` required.

 SETTINGS TO VERIFY (plugin / config.json)
 • inferClozeFromManualSyntaxOnBasic — default false; re-check Basic-06 vs Infer-01 when toggled.
 • autoCreateStockNoteModels — default true; turn OFF to confirm clear failure if stock model missing.

 STOCK MODELS (built-ins that SHOULD sync when preview is sync|warn)
   basic      → Basic                         Front / Back
   cloze      → Cloze                         Text / Back Extra
   reversible → Basic (and reversed card)     Front / Back
   typed      → Basic (type in the answer)     Front / Back (plain; TYP-05 pipes)

 TEXT-ONLY CLOZE (no `:::`) — REGRESSION
   Cloze with deletions only in Text and no split delimiter is intentional.
   After rebuild: sync YES Cloze + inject `<!--anki-id-->` via front injectionOffset.
   Do NOT add empty `:::` to “fix” uuid / inject failures — that hides the bug.

 PHASE 3 DEFERRED — custom `#anki/noteType/…` → see tiny appendix at end only.
-->

# Built-In Card Types — Manual Stress Test

Focused human smoke for **Basic**, **Cloze**, **Reversible**, and **Typed** stock models after Phase 2c. Each card title uses a searchable `[STRESS-…]` prefix. Expect blocks document preview ↔ sync parity.

**Text-only cloze:** cards without `:::` (Cloze-01/02/03, Sect-01/04, etc.) must sync Cloze and inject `<!--anki-id-->` at the end of Text — empty `:::` is not required and must not be added as a workaround. Requires rebuild/redeploy after the front-offset inject fix.

---

## Basic

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

---

## Cloze

> Text-only cards below deliberately omit `:::`. After rebuild/redeploy they must sync + inject `<!--anki-id-->` at end of Text (front injectionOffset). Do not insert empty `:::` to work around missing ids.

### Thermodynamics STRESS #biology #anki/cardType/cloze

#### [STRESS-Cloze-01] Manual c1 in Text

The {{c1::mitochondria}} produces ATP (STRESS-Cloze-01).

<!-- expect:
  preview: sync — cloze
  anki: YES model="Cloze" fields=Text,"Back Extra"
  rules: CLZ-08, STR-02
  check: Browser search "STRESS-Cloze-01"; Text contains {{c1::mitochondria}};
        vault note gains <!--anki-id--> after Text (no ::: on this card)
-->

#### [STRESS-Cloze-02] Shorthand deletion

The {{entropy}} increases in an isolated system (STRESS-Cloze-02).

<!-- expect:
  preview: sync — cloze inherited from ### section
  anki: YES model="Cloze" fields=Text,"Back Extra"
  rules: CLZ-04, CX-04, STR-02
  check: Auto-numbered cloze in Text; Back Extra empty OK;
        <!--anki-id--> injected at end of Text (no :::)
-->

#### [STRESS-Cloze-03] Auto-number and hints

{{Java}} runs on a JVM. {{java}} is same group. {{Python}} is a new group (STRESS-Cloze-03).

<!-- expect:
  preview: sync — cloze; c1=Java/java, c2=Python
  anki: YES model="Cloze" fields=Text,"Back Extra"
  rules: CLZ-05, CLZ-06
  check: Text has {{c1::Java}} and {{c2::Python}} (or equivalent numbering);
        <!--anki-id--> injected at end of Text (no :::)
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

STRESS-Cloze-05 inherited cloze section but forgot to mark any deletions.

<!-- expect:
  preview: skip — cloze without {{}} in Text
  anki: NO (hard-block)
  rules: CLZ-01, CX-05
  check: Skip chip; no Cloze note created
-->

#### [STRESS-Cloze-06] Empty deletion skip

STRESS-Cloze-06 something {{}} empty here.

<!-- expect:
  preview: skip — empty cloze deletion
  anki: NO (hard-block)
  rules: CLZ-09, CX-28
  check: Skip (not CX-25 sync); no Anki note
-->

#### [STRESS-Cloze-07] Back-only deletions error CLZ-11

Plain Text region for STRESS-Cloze-07 — no cloze here.

:::

{{c1::too late}} belongs in Back only.

<!-- expect:
  preview: error — deletions only after :::
  anki: NO (hard-block)
  rules: CLZ-11, CX-12
  check: Error chip; sync hard-block; no Cloze note
-->

#### [STRESS-Cloze-08] Cloze plus reversible delimiter

{{c1::hidden}} in Text (STRESS-Cloze-08).

:::r
Should conflict with cloze resolution.

<!-- expect:
  preview: error — cloze vs reversible
  anki: NO (hard-block)
  rules: CLZ-10, REV-05, CX-30
  check: Error chip; no Anki write
-->

---

## Reversible

### Assessment reversible STRESS

#### [STRESS-Rev-01] Delimiter only

What is the chemical symbol for sodium (STRESS-Rev-01)?

:::r
Na

<!-- expect:
  preview: sync — reversible
  anki: YES model="Basic (and reversed card)" fields=Front,Back
  rules: DEL-02, RES-05, CX-14
  check: Reversible model; Front contains STRESS-Rev-01; two card templates in note
-->

#### [STRESS-Rev-02] Tag with plain split #anki/cardType/reversible

Capital of Japan (STRESS-Rev-02)?

:::
Tokyo

<!-- expect:
  preview: sync — reversible
  anki: YES model="Basic (and reversed card)" fields=Front,Back
  rules: REV-02, CX-16
  check: Same reversible model; :::r not required when tag present
-->

#### [STRESS-Rev-03] Skip no split #anki/cardType/reversible

STRESS-Rev-03 reversible card forgot its front/back split.

<!-- expect:
  preview: skip — reversible missing split
  anki: NO (hard-block)
  rules: REV-03, CX-15
  check: Skip chip; no Anki note
-->

#### [STRESS-Rev-04] REV-06 vs typed #anki/cardType/reversible

Capital of France for STRESS-Rev-04?

:::t
Paris

<!-- expect:
  preview: error — reversible vs typed conflict
  anki: NO (hard-block)
  rules: REV-06, CX-31
  check: Error chip; no Anki write
-->

---

## Typed

### Assessment typed STRESS

#### [STRESS-Typed-01] HTML stripped TYP-03b warn

Name the capital of France (STRESS-Typed-01).

:::t
**Paris** with <sub>accent</sub>

<!-- expect:
  preview: warn — formatting stripped for type-in answer
  anki: YES model="Basic (type in the answer)" fields=Front,Back
  rules: TYP-01, TYP-03, TYP-03b
  check: Back plain text `Paris with accent`; no HTML/markdown in Back
-->

#### [STRESS-Typed-02] Tag with plain split #anki/cardType/typed

2 + 2 = ? (STRESS-Typed-02)

:::
4

<!-- expect:
  preview: sync — typed
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

---

## Section inheritance

### Unit A cloze parent STRESS #anki/cardType/cloze

#### [STRESS-Sect-01] Inherited shorthand cloze

{{ATP}} carries chemical energy (STRESS-Sect-01).

<!-- expect:
  preview: sync — cloze from ### Unit A cloze parent
  anki: YES model="Cloze" fields=Text,"Back Extra"
  rules: STR-02, CLZ-04, RES-03
  check: Cloze model without per-card type tag;
        <!--anki-id--> at end of Text (text-only, no :::)
-->

#### [STRESS-Sect-02] Basic override in cloze section #anki/cardType/basic

What is ΔG (STRESS-Sect-02)?

:::

Gibbs free energy.

<!-- expect:
  preview: sync — basic overrides ancestor cloze
  anki: YES model="Basic" fields=Front,Back
  rules: RES-01, CX-03
  check: Basic model despite ### cloze parent
-->

### Unit B sibling STRESS

#### [STRESS-Sect-03] Sibling not inheriting cloze

What is H₂O (STRESS-Sect-03)?

:::

Water.

<!-- expect:
  preview: sync — basic
  anki: YES model="Basic" fields=Front,Back
  rules: RES-02, CX-23
  check: ## Unit B does not inherit ### Unit A cloze; Basic not Cloze
-->

### Tag split STRESS #exam-prep #anki/cardType/cloze

#### [STRESS-Sect-04] User tag vs engine cardType tag

{{c1::ATP}} powers cells (STRESS-Sect-04).

<!-- expect:
  preview: sync — cloze
  anki: YES model="Cloze" fields=Text,"Back Extra"
  rules: STR-04, CX-29
  check: Anki tags include exam-prep; `#anki/cardType/cloze` stripped from note tags;
        <!--anki-id--> at end of Text (text-only, no :::)
-->

---

## inferCloze setting

> **Toggle** `inferClozeFromManualSyntaxOnBasic` in plugin settings, then re-preview and re-sync Basic-06 and Infer-01 together — both paths must flip in lockstep (Phase 2b parity).

#### [STRESS-Infer-01] Basic default reclassifies to Cloze when ON

The {{c1::chloroplast}} is for photosynthesis (STRESS-Infer-01).

:::

Green organelle detail.

<!-- expect:
  preview: sync — cloze when inferCloze ON | warn basic when OFF (mirror Basic-06)
  anki: YES model="Cloze" fields=Text,"Back Extra" (ON) | YES model="Basic" (OFF)
  rules: BAS-04, CX-27a
  check: Preview type chip + Anki model both flip when setting toggled
-->

---

## Cross-type conflicts

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

---

## Phase 2c — model mismatch (optional)

#### [STRESS-Migrate-01] Basic first sync then edit to cloze

What produces ATP (STRESS-Migrate-01)?

:::

Mitochondria.

<!-- expect:
  preview: sync — basic on first sync
  anki: YES model="Basic" fields=Front,Back
  rules: BAS-02
  check: (1) Sync once → Basic note with obsidian-id inject.
        (2) Edit body to cloze e.g. {{c1::Mitochondria}} under #anki/cardType/cloze and re-sync.
        (3) Expect model-mismatch block and/or type-migration warning in sync summary — not silent wrong-model write.
        AnkiConnect cannot fully Change Note Type; 2c is best-effort fields + summary counts.
-->

---

## Appendix — Phase 3 deferred (custom only)

> Custom `#anki/noteType/…` cards may preview as sync|skip|error but **never write to Anki** in v1. Not the focus of this note.

### Vocabulary appendix #anki/noteType/Vocab

#### [STRESS-Custom-A1] Identify only no Anki write

::: Word
STRESS-Custom-A1 entropy

::: Definition
Custom field layout — sync not implemented (Phase 3).

<!-- expect:
  preview: sync — custom Vocab
  anki: NO — custom not implemented; never silent Basic
  rules: CUS-01, CUS-06
  check: Sync results message like Custom note type "Vocab" sync is not yet implemented; no new Anki note
-->

#### [STRESS-Custom-A2] Custom skip no field blocks

STRESS-Custom-A2 prose under Vocab section with no ::: Field blocks.

<!-- expect:
  preview: skip — invalid custom layout
  anki: NO (hard-block)
  rules: CUS-01
  check: Skip chip; no Anki note
-->

---

## Manual checklist

| ID | Scenario | Preview | Anki write? | Done |
|----|----------|---------|-------------|------|
| Basic-01 | OK with `:::` | sync | YES Basic | ☐ |
| Basic-02 | Heading as front | sync | YES Basic | ☐ |
| Basic-03 | Empty back allowed | sync | YES Basic | ☐ |
| Basic-04 | Missing `:::` | skip | NO | ☐ |
| Basic-05 | Bare `{{word}}` | warn | YES Basic | ☐ |
| Basic-06 | `{{cN::}}` inferCloze OFF | warn | YES Basic | ☐ |
| Basic-07 | cN only in Back | sync | YES Basic | ☐ |
| Cloze-01 | Manual `{{c1::}}` in Text (no `:::`) | sync | YES Cloze | ☐ |
| Cloze-02 | Shorthand `{{word}}` (no `:::`) | sync | YES Cloze | ☐ |
| Cloze-03 | Auto-number + hints (no `:::`) | sync | YES Cloze | ☐ |
| Cloze-UUID | Text-only cloze got `<!--anki-id-->` injected without `:::`‡ | — | inject at Text end | ☐ |
| Cloze-04 | Back Extra after `:::` | sync | YES Cloze | ☐ |
| Cloze-05 | No deletions in Text | skip | NO | ☐ |
| Cloze-06 | Empty `{{}}` | skip | NO | ☐ |
| Cloze-07 | CLZ-11 back-only | error | NO | ☐ |
| Cloze-08 | Cloze + `:::r` | error | NO | ☐ |
| Rev-01 | `:::r` only | sync | YES reversible | ☐ |
| Rev-02 | reversible tag + `:::` | sync | YES reversible | ☐ |
| Rev-03 | Reversible no split | skip | NO | ☐ |
| Rev-04 | REV-06 vs typed | error | NO | ☐ |
| Typed-01 | `:::t` HTML strip | warn | YES typed | ☐ |
| Typed-02 | typed tag + `:::` | sync | YES typed | ☐ |
| Typed-03 | TYP-05 `Paris \| Lyon \| Marseille` | sync | YES typed Back=`Paris\|Lyon\|Marseille` | ☐ |
| Typed-04 | Typed no split | skip | NO | ☐ |
| Sect-01 | Inherited cloze section | sync | YES Cloze | ☐ |
| Sect-02 | Basic override in cloze section | sync | YES Basic | ☐ |
| Sect-03 | Sibling not inherit cloze | sync | YES Basic | ☐ |
| Sect-04 | User tag vs engine tag | sync | YES Cloze | ☐ |
| Infer-01 | inferCloze ON → Cloze | sync* | YES Cloze* | ☐ |
| Conf-01 | basic + `:::r` BAS-06 | error | NO | ☐ |
| Migrate-01 | Basic→cloze mismatch drill† | — | block / summary | ☐ |
| Custom-A1 | Custom identify only | sync | NO (Phase 3) | ☐ |
| Custom-A2 | Custom skip | skip | NO | ☐ |

\* Re-check with `inferClozeFromManualSyntaxOnBasic` toggled; must match Basic-06.  
† Optional two-step manual drill on Migrate-01.  
‡ After rebuild/redeploy: spot-check Cloze-01/02/03 (and Sect-01/04) — vault file must gain `<!--anki-id-->` at end of Text without adding empty `:::`.

---

## Quick reference — outcome → Anki (Phase 2c)

| Preview | Built-in stock models | Custom `#anki/noteType/…` |
|---------|----------------------|----------------------------|
| **sync** | Write resolved stock model | Identify only — **NO write** |
| **warn** | Write + surface warnings | N/A (still no custom write) |
| **skip** | Hard-block | Hard-block |
| **error** | Hard-block | Hard-block |
