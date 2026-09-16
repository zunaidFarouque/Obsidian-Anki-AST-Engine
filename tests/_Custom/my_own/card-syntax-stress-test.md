---
AnkiSync: true
cardDeclarationHeadingLevel: 4
anki_cardDefault: basic
anki_customCardDefault: Vocab
includeParentHeadersAsTags: true
file_anki_tags: FOR_TEST
---

<!--
CARD SYNTAX STRESS-TEST CHECKLIST
Spec: Docs/DECIDING/Card-Syntax-Spec.md
Engine: not wired yet — expect comments document intended outcomes only.

Section A Basic baseline
  A1 Basic OK with user tag -> sync
  A2 Basic SKIP no delimiter -> skip (BAS-01, CX-08)
  A3 Basic WARN bare {{}} -> sync + warn (BAS-03, CX-07)
  A4 cN in Text on basic default -> sync + warn literal (BAS-04, CX-27)
  A5 cN only in Back stays basic -> sync (BAS-05, CX-24)

Section B Cloze inheritance (### #anki/cardType/cloze)
  B1 Inherited shorthand cloze -> sync (CLZ-04, CX-04)
  B2 Auto-number case + groups -> sync (CLZ-05, CLZ-06)
  B3 Manual c1/c2 same text -> sync (CLZ-08)
  B4 Cloze + Back Extra -> sync (CLZ-02, CX-25)
  B5 Cloze SKIP no {{}} -> skip (CLZ-01, CX-05)
  B6 Cloze SKIP {{}} only after ::: -> skip (CLZ-11, CX-12)
  B7 Basic override in cloze section -> sync (RES-01, CX-03)

Section C Outline isolation
  C1 Sibling section not cloze -> sync basic (RES-02, CX-23)

Section D Custom models
  D1 #anki/model/Vocab explicit -> sync (CUS-01)
  D2 Legacy #anki_card_Vocab -> sync
  D3 YAML custom default only -> sync (RES-04, FM-03)
  D4 Custom SKIP model no fields -> skip (CUS-01)
  D5 Section inherited model -> sync (RES-08)

Section E Reversible + typed
  E1 :::r only -> sync (DEL-02, CX-14)
  E2 #anki/cardType/reversible + ::: -> sync redundant (CX-16)
  E3 :::t HTML stripped -> sync Back=Paris (TYP-03)
  E4 #anki/cardType/typed + ::: -> sync (TYP-01)
  E5 :::t multi-line back first line only -> sync Back=Paris (TYP-04)

Section F Conflicts
  F1 :::r with file default basic -> sync reversible (DEL-02, RES-05)
  F2 cloze tag + :::t -> error (CX-11)
  F3 basic tag + :::r -> error (CX-17)
  F4 custom + :::r -> error (CX-21)
  F5 file default basic vs cloze body -> skip (CX-06)
  F6 custom via file default -> sync (RES-04)
  F7 TAG conflicts (comment block) -> error (CX-01, CX-02)

Section G Edge cases
  G1 Delimiter in code fence -> sync (DEL-07)
  G2a ::: r custom field vs G2b :::r -> sync (DEL-06)
  G3 Empty {{}} -> skip (CLZ-09)
  G4 Section user/engine tags -> sync (STR-04, CX-29)
  G5 #anki/noteType/cloze rejected -> not cloze (TAG-04)

Section H Additional matrix
  H1 Manual/auto merge -> sync (CLZ-07)
  H2 Reversible SKIP no split -> skip (REV-03)
  H3 Typed SKIP no split -> skip (TYP-02)
  H4 Custom unknown field -> error (CUS-02)
  H5 Literal {{}} in custom field -> sync (CLZ-12)
  H6 File default basic plain card -> sync (FM-02)
  H7 Section overrides file default -> sync (FM-04)
  H8 Cloze under override section -> sync (STR-02)
  H9 Sibling cloze section not inherited -> sync basic (RES-02, CX-23)
  H10 Nearest ancestor RES-03 -> sync cloze (RES-03)

Section I Coverage gaps (audit)
  I1 basic + ::: Field -> error (BAS-06, CX-10)
  I2 inherited cloze + :::r -> error (CLZ-10, REV-05, CX-30)
  I3 custom + plain ::: only -> skip (CUS-04, CX-20)
  I4 STR-03 H5 tag ignored, cloze sync -> sync (STR-03, STR-02)
  I5 STR-03 descendant not H5 basic -> sync cloze (STR-03, RES-03)
  I6a dual cardType on ### section -> error (TAG-01, CX-01, CX-26)
  I7a cardType + model on ### section -> error (TAG-02, CX-02)
  I8 second ::: stays in Back -> sync (DEL-08)

Orphan mini-fixture (no anki_* defaults): tests/fixtures/new format/card-syntax-orphan-custom.md
  O1 orphan ::: Field only -> skip (CUS-03, CX-22)
  O2 RES-06 positive cloze inference -> sync (RES-06)
-->

# Card Syntax Stress Test

Organizational file for the v1 card-type grammar. See [Card-Syntax-Spec.md](../../Docs/DECIDING/Card-Syntax-Spec.md).

---

## A — Basic Baseline

### Subsection A0

#### A1 Basic OK #exam-prep

What is the speed of light in vacuum?

:::

Approximately $3 \times 10^8$ m/s.

<!-- expect: sync; rules: BAS-01,BAS-02,FM-02; resolved: basic (anki_cardDefault); anki-tags: exam-prep + heading path -->

#### A2 Basic SKIP No Delimiter

This card has a front but no structural split token.

<!-- expect: skip; rules: BAS-01,CX-08; message: basic card missing ::: delimiter -->

#### A3 Basic WARN Bare Mustache

The config uses {{username}} for the active account.

:::

See the deployment guide.

<!-- expect: sync + warn; rules: BAS-03,CX-07; resolved: basic; {{username}} literal in Front -->

#### A4 cN on Basic Default Literal

The {{c1::mitochondria}} is mentioned in the question.

:::

It is an organelle.

<!-- expect: sync + warn; rules: BAS-04,CX-27; resolved: basic from anki_cardDefault; {{c1::mitochondria}} literal in Front unless inferClozeFromManualSyntaxOnBasic -->

#### A5 cN Only in Back

What organelle produces ATP?

:::

The answer involves {{c1::mitochondria}} but back is not scanned for cloze type.

<!-- expect: sync; rules: BAS-05,CX-24; resolved: basic -->

---

## B — Cloze Section

### Thermodynamics #biology #anki/cardType/cloze

#### B1 Inherited Shorthand Cloze

The {{mitochondria}} is the powerhouse of the cell.

<!-- expect: sync; rules: STR-02,CLZ-04,CX-04; resolved: cloze from ### Thermodynamics -->

#### B2 Auto-number Case and Hint

{{Java}} runs on a JVM. {{java}} is same group. {{Python}} is a new group.

<!-- expect: sync; rules: CLZ-05,CLZ-06; c1=Java/java, c2=Python -->

#### B3 Manual Duplicate Text Separate Groups

First {{c1::ATP}} and second {{c2::ATP}} are separate cloze cards.

<!-- expect: sync; rules: CLZ-08 -->

#### B4 Cloze with Back Extra

{{entropy}} increases in an isolated system.

:::

Optional reference: second law of thermodynamics.

<!-- expect: sync; rules: CLZ-02,CX-25 -->

#### B5 Cloze SKIP No Deletions

This inherited cloze card forgot to mark any deletions.

<!-- expect: skip; rules: CLZ-01,CX-05 -->

#### B6 Cloze SKIP Deletions Only in back

Plain text in the Text region.

:::

{{c1::too late}}

<!-- expect: skip; rules: CLZ-11,CX-12 -->

#### B7 Basic Override #anki/cardType/basic

What is $\Delta G$?

:::

Gibbs free energy.

<!-- expect: sync; rules: RES-01,CX-03; resolved: basic overrides ### cloze -->

---

## C — Outline Isolation

## Unit B Sibling Section

#### C1 Not Inheriting Cloze from Unit A

What is H₂O?

:::

Water.

<!-- expect: sync; rules: RES-02,CX-23; resolved: basic; parent ## Unit B not ### Thermodynamics -->

---

## D — Custom Models

### Vocabulary #anki/model/Vocab

#### D1 Custom Explicit Model Tag

::: Word

entropy

::: Definition

A measure of energy dispersal in a thermodynamic system.

<!-- expect: sync; rules: CUS-01,CUS-06,DEL-04 -->

#### D2 Custom Legacy Tag #anki_card_Vocab

::: Word

enthalpy

::: Definition

Heat content at constant pressure.

<!-- expect: sync; rules: TAG-03 legacy -->

#### D3 Custom from YAML Default Only

::: Word

mitochondria

::: Definition

Organelle that produces ATP.

<!-- expect: sync; rules: RES-04,FM-03; anki_customCardDefault: Vocab -->

#### D4 Custom SKIP Model Section No Fields

This card is under ### Vocabulary but has no ::: Field blocks.

<!-- expect: skip; rules: CUS-01; resolved custom but invalid layout -->

#### D5 Term from Inherited Section

::: Word

adiabatic

::: Definition

A process with no heat transfer.

<!-- expect: sync; rules: RES-08; model from ### Vocabulary -->

---

## E — Reversible and Typed

### Assessment Items

#### E1 Reversible Delimiter Only

What is the chemical symbol for sodium?

:::r

Na

<!-- expect: sync; rules: DEL-02,RES-05,CX-14; resolved: reversible -->

#### E2 Reversible Redundant Tag #anki/cardType/reversible

Capital of Japan?

:::

Tokyo

<!-- expect: sync; rules: REV-02,CX-16 -->

#### E3 Typed HTML Stripped

Name the capital of France.

:::t

**Paris**

<!-- expect: sync; rules: TYP-03; Back plain: Paris -->

#### E4 Typed Tag with Plain Split #anki/cardType/typed

2 + 2 = ?

:::

4

<!-- expect: sync; rules: TYP-01,TYP-02 -->

#### E5 Typed Multi-line back First Line Wins

Name a capital of France.

:::t

Paris

Lyon

Marseille

<!-- expect: sync; rules: TYP-04; Back plain: Paris (first non-empty line only) -->

---

## F — Conflicts and File-default Stress

### Conflict Gallery

#### F1 Basic Resolved plus Reversible Delimiter

A basic card that incorrectly uses the reversible token.

:::r

Wrong split for basic.

<!-- expect: sync; rules: DEL-02,RES-05,CX-14; resolved: reversible -->

#### F2 Cloze Type plus Typed Delimiter #anki/cardType/cloze

{{hidden}} in Text.

:::t

hidden

<!-- expect: error; rules: CLZ-10,CX-11 -->

#### F3 Basic Tag plus Reversible Delimiter #anki/cardType/basic

Front question.

:::r

Back answer.

<!-- expect: error; rules: CX-17 -->

#### F4 Custom Fields plus Reversible Delimiter #anki/model/Vocab

::: Word

test

:::r

invalid

<!-- expect: error; rules: CUS-05,CX-21 -->

#### F5 File Default Basic Vs Cloze-style Body

{{mitochondria}} without explicit cloze declaration on card or ancestors.

<!-- expect: skip; rules: CX-06,FM-02,BAS-01; no ::: and basic default conflict -->

#### F6 Custom Fields Resolved by File Default

::: Word

isolated

::: Definition

no per-card model hashtag

<!-- expect: sync; rules: RES-04,FM-03; anki_customCardDefault supplies model for field blocks -->

##### F7 TAG Conflict Examples (Heading-level dOcumentation — nOt a cArd)

<!--
ERROR AT HEADING PARSE (not valid #### cards):

### Bad Dual cardType #anki/cardType/cloze #anki/cardType/basic

-> error TAG-01, CX-01

### Bad cardType + Model #anki/cardType/cloze #anki/model/Vocab

-> error TAG-02, CX-02
-->

---

## G — Edge Cases

### Edge Gallery #anki/cardType/cloze

#### G1 Delimiter inside Code Only

The {{runtime}} is not a delimiter below.

```python
print(":::")
```

:::

Back extra after the real split.

<!-- expect: sync; rules: DEL-07,CLZ-02 -->

#### G2a Custom Field Named R #anki/model/Edge

::: r

Content for field literally named "r".

<!-- expect: sync; rules: DEL-06; NOT reversible -->

#### G2b Reversible Reserved Token #anki/cardType/reversible

Symbol for gold?

:::r

Au

<!-- expect: sync; rules: DEL-02,DEL-06; resolved: reversible -->

#### G3 Empty Cloze Deletion

Something {{}} empty here.

<!-- expect: skip; rules: CLZ-09,CX-28 -->

#### G4 Section Tags Split Correctly

{{ATP}} in cells.

<!-- expect: sync; rules: STR-04,CX-29; #biology on ### Thermodynamics syncs; #anki/cardType/cloze stripped -->

### Invalid noteType Tag #anki/noteType/cloze

#### G5 noteType Tag Does Not Declare Cloze

What is H₂O? (2)

:::

Water.

<!-- expect: sync; rules: TAG-04; resolved: basic (anki_cardDefault); #anki/noteType/cloze does NOT declare cloze -->

---

## H — Additional Matrix Coverage

### Override Section #anki/cardType/cloze

#### H1 Cloze Manual Merge with Auto

{{c1::foo}} and later {{foo}} merge to c1.

<!-- expect: sync; rules: CLZ-07 -->

#### H7 Section Overrides File Default Basic

{{inherited cloze}} when file frontmatter says basic.

<!-- expect: sync; rules: FM-04,STR-02; ### beats anki_cardDefault -->

#### H8 Under Cloze Override Section

{{another inherited cloze}}.

<!-- expect: sync; resolved: cloze from ### Override section -->

## Distant Chapter #anki/cardType/basic

### Nested under Basic Chapter

#### H9 Sibling Section Not Inherited

What is NaCl?

:::

Sodium chloride.

<!-- expect: sync; rules: RES-02,RES-03,CX-23; resolved: basic from ## Distant chapter; NOT cloze from sibling ### Override section -->

#### H6 File Default Basic Plain Card

Plain question under distant basic chapter?

:::

Plain answer.

<!-- expect: sync; rules: FM-02; resolved: basic from ## Distant chapter #anki/cardType/basic -->

### Subsection Cloze Override #anki/cardType/cloze

#### H10 Nearest Ancestor RES-03

{{hidden}} under ### cloze, not ## basic parent.

<!-- expect: sync; rules: RES-03; resolved: cloze from ### Subsection; stops before ## Distant chapter basic -->

### Assessment Edge Cases

#### H2 Reversible SKIP No Split #anki/cardType/reversible

Question only, no delimiter.

<!-- expect: skip; rules: REV-03 -->

#### H3 Typed SKIP No Split #anki/cardType/typed

What is 1+1?

<!-- expect: skip; rules: TYP-02 -->

#### H4 Custom Unknown Field #anki/model/Vocab

::: Definiton

typo

<!-- expect: error; rules: CUS-02 -->

#### H5 Custom Literal Braces #anki/model/Vocab

::: Word

{{not a cloze}}

::: Definition

Literal braces in custom field.

<!-- expect: sync; rules: CLZ-12 -->

#### I8 Second Delimiter Stays in back

Front text before first split.

:::

Line before inner delimiter.

:::

This line should remain Back content with the inner ::: marker.

<!-- expect: sync; rules: DEL-08,BAS-01; resolved: basic; back_contains: inner ::: marker -->

---

## I — Coverage Gap Scenarios

### Cloze Gallery #anki/cardType/cloze

#### I1 Basic Resolved plus Custom Field #anki/cardType/basic

Plain front text.

::: Word

invalid field on basic card

<!-- expect: error; rules: BAS-06,CX-10 -->

#### I2 Inherited Cloze plus Reversible Delimiter

Inherited cloze {{token}} in Text.

:::r

Should conflict with cloze resolution.

<!-- expect: error; rules: CLZ-10,REV-05,CX-30 -->

### Vocabulary Inherited #anki/model/Vocab

#### I3 Custom Plain Split Only

Front question under custom model section.

:::

Back answer without ::: Field blocks.

<!-- expect: skip; rules: CUS-04,CX-20 -->

### STR-03 H5 Ignored #anki/cardType/cloze

#### I4 Inherits Cloze Not H5 Basic

{{mitochondria}} is the powerhouse.

<!-- expect: sync; rules: STR-02; resolved: cloze -->

##### H5 Basic Tag Ignored #anki/cardType/basic

#### I5 Still Inherits Section Cloze after H5

{{ATP}} carries chemical energy.

<!-- expect: sync; rules: RES-03; resolved: cloze; NOT basic from ignored ##### -->

### I6 Dual cardType Section #anki/cardType/cloze #anki/cardType/basic

#### I6a Card under Dual cardType Section

Question under conflicting section?

:::

Answer.

<!-- expect: error; rules: TAG-01,CX-01,CX-26 -->

### I7 cardType plus Model Section #anki/cardType/cloze #anki/model/Vocab

#### I7a Card under cardType Model Conflict

::: Word

entropy

::: Definition

Energy dispersal.

<!-- expect: error; rules: TAG-02,CX-02 -->
