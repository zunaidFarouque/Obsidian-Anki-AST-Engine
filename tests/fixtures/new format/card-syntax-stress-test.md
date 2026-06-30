---
AnkiSync: on
cardDeclarationHeadingLevel: 4
anki_cardDefault: basic
anki_customCardDefault: Vocab
includeParentHeadersAsTags: true
---

<!--
CARD SYNTAX STRESS-TEST CHECKLIST
Spec: Docs/DECIDING/Card-Syntax-Spec.md
Engine: not wired yet — expect comments document intended outcomes only.

Section A  Basic baseline
  A1  Basic OK with user tag              -> sync
  A2  Basic SKIP no delimiter             -> skip (BAS-01, CX-08)
  A3  Basic WARN bare {{}}                -> sync + warn (BAS-03, CX-07)
  A4  cN in Text on basic default           -> sync + warn literal (BAS-04, CX-27)
  A5  cN only in Back stays basic          -> sync (BAS-05, CX-24)

Section B  Cloze inheritance (### #anki/cardType/cloze)
  B1  Inherited shorthand cloze            -> sync (CLZ-04, CX-04)
  B2  Auto-number case + groups            -> sync (CLZ-05, CLZ-06)
  B3  Manual c1/c2 same text              -> sync (CLZ-08)
  B4  Cloze + Back Extra                   -> sync (CLZ-02, CX-25)
  B5  Cloze SKIP no {{}}                   -> skip (CLZ-01, CX-05)
  B6  Cloze SKIP {{}} only after :::       -> skip (CLZ-11, CX-12)
  B7  Basic override in cloze section      -> sync (RES-01, CX-03)

Section C  Outline isolation
  C1  Sibling section not cloze            -> sync basic (RES-02, CX-23)

Section D  Custom models
  D1  #anki/model/Vocab explicit           -> sync (CUS-01)
  D2  Legacy #anki_card_Vocab              -> sync
  D3  YAML custom default only             -> sync (RES-04, FM-03)
  D4  Custom SKIP model no fields          -> skip (CUS-01)
  D5  Section inherited model              -> sync (RES-08)

Section E  Reversible + typed
  E1  :::r only                            -> sync (DEL-02, CX-14)
  E2  #anki/cardType/reversible + :::      -> sync redundant (CX-16)
  E3  :::t HTML stripped                   -> sync Back=Paris (TYP-03)
  E4  #anki/cardType/typed + :::           -> sync (TYP-01)
  E5  :::t multi-line back first line only  -> sync Back=Paris (TYP-04)

Section F  Conflicts
  F1  :::r with file default basic          -> sync reversible (DEL-02, RES-05)
  F2  cloze tag + :::t                     -> error (CX-11)
  F3  basic tag + :::r                     -> error (CX-17)
  F4  custom + :::r                        -> error (CX-21)
  F5  file default basic vs cloze body     -> skip (CX-06)
  F6  custom via file default              -> sync (RES-04)
  F7  TAG conflicts (comment block)        -> error (CX-01, CX-02)

Section G  Edge cases
  G1  Delimiter in code fence              -> sync (DEL-07)
  G2a ::: r custom field vs G2b :::r       -> sync (DEL-06)
  G3  Empty {{}}                            -> skip (CLZ-09)
  G4  Section user/engine tags             -> sync (STR-04, CX-29)
  G5  #anki/noteType/cloze rejected        -> not cloze (TAG-04)

Section H  Additional matrix
  H1  Manual/auto merge                    -> sync (CLZ-07)
  H2  Reversible SKIP no split             -> skip (REV-03)
  H3  Typed SKIP no split                  -> skip (TYP-02)
  H4  Custom unknown field                 -> error (CUS-02)
  H5  Literal {{}} in custom field         -> sync (CLZ-12)
  H6  File default basic plain card        -> sync (FM-02)
  H7  Section overrides file default       -> sync (FM-04)
  H8  Cloze under override section         -> sync (STR-02)
  H9  Sibling cloze section not inherited   -> sync basic (RES-02, CX-23)
  H10 Nearest ancestor RES-03              -> sync cloze (RES-03)

Section I  Coverage gaps (audit)
  I1  basic + ::: Field                    -> error (BAS-06, CX-10)
  I2  inherited cloze + :::r               -> error (CLZ-10, REV-05, CX-30)
  I3  custom + plain ::: only               -> skip (CUS-04, CX-20)
  I4  STR-03 H5 tag ignored, cloze sync     -> sync (STR-03, STR-02)
  I5  STR-03 descendant not H5 basic        -> sync cloze (STR-03, RES-03)
  I6a dual cardType on ### section          -> error (TAG-01, CX-01, CX-26)
  I7a cardType + model on ### section       -> error (TAG-02, CX-02)
  I8  second ::: stays in Back              -> sync (DEL-08)

Orphan mini-fixture (no anki_* defaults): tests/fixtures/new format/card-syntax-orphan-custom.md
  O1  orphan ::: Field only                 -> skip (CUS-03, CX-22)
  O2  RES-06 positive cloze inference       -> sync (RES-06)
-->

# Card Syntax Stress Test

Organizational file for the v1 card-type grammar. See [Card-Syntax-Spec.md](../../Docs/DECIDING/Card-Syntax-Spec.md).

---

## A — Basic baseline

### Subsection A0

#### A1 Basic OK #exam-prep

What is the speed of light in vacuum?

:::

Approximately $3 \times 10^8$ m/s.

<!-- expect: sync; rules: BAS-01,BAS-02,FM-02; resolved: basic (anki_cardDefault); anki-tags: exam-prep + heading path -->

#### A2 Basic SKIP no delimiter

This card has a front but no structural split token.

<!-- expect: skip; rules: BAS-01,CX-08; message: basic card missing ::: delimiter -->

#### A3 Basic WARN bare mustache

The config uses {{username}} for the active account.

:::

See the deployment guide.

<!-- expect: sync + warn; rules: BAS-03,CX-07; resolved: basic; {{username}} literal in Front -->

#### A4 cN on basic default literal

The {{c1::mitochondria}} is mentioned in the question.

:::

It is an organelle.

<!-- expect: sync + warn; rules: BAS-04,CX-27; resolved: basic from anki_cardDefault; {{c1::mitochondria}} literal in Front unless inferClozeFromManualSyntaxOnBasic -->

#### A5 cN only in Back

What organelle produces ATP?

:::

The answer involves {{c1::mitochondria}} but back is not scanned for cloze type.

<!-- expect: sync; rules: BAS-05,CX-24; resolved: basic -->

---

## B — Cloze section

### Thermodynamics #biology #anki/cardType/cloze

#### B1 Inherited shorthand cloze

The {{mitochondria}} is the powerhouse of the cell.

<!-- expect: sync; rules: STR-02,CLZ-04,CX-04; resolved: cloze from ### Thermodynamics -->

#### B2 Auto-number case and hint

{{Java}} runs on a JVM. {{java}} is same group. {{Python}} is a new group.

<!-- expect: sync; rules: CLZ-05,CLZ-06; c1=Java/java, c2=Python -->

#### B3 Manual duplicate text separate groups

First {{c1::ATP}} and second {{c2::ATP}} are separate cloze cards.

<!-- expect: sync; rules: CLZ-08 -->

#### B4 Cloze with Back Extra

{{entropy}} increases in an isolated system.

:::

Optional reference: second law of thermodynamics.

<!-- expect: sync; rules: CLZ-02,CX-25 -->

#### B5 Cloze SKIP no deletions

This inherited cloze card forgot to mark any deletions.

<!-- expect: skip; rules: CLZ-01,CX-05 -->

#### B6 Cloze SKIP deletions only in back

Plain text in the Text region.

:::

{{c1::too late}}

<!-- expect: skip; rules: CLZ-11,CX-12 -->

#### B7 Basic override #anki/cardType/basic

What is $\Delta G$?

:::

Gibbs free energy.

<!-- expect: sync; rules: RES-01,CX-03; resolved: basic overrides ### cloze -->

---

## C — Outline isolation

## Unit B sibling section

#### C1 Not inheriting cloze from Unit A

What is H₂O?

:::

Water.

<!-- expect: sync; rules: RES-02,CX-23; resolved: basic; parent ## Unit B not ### Thermodynamics -->

---

## D — Custom models

### Vocabulary #anki/model/Vocab

#### D1 Custom explicit model tag

::: Word
entropy

::: Definition
A measure of energy dispersal in a thermodynamic system.

<!-- expect: sync; rules: CUS-01,CUS-06,DEL-04 -->

#### D2 Custom legacy tag #anki_card_Vocab

::: Word
enthalpy

::: Definition
Heat content at constant pressure.

<!-- expect: sync; rules: TAG-03 legacy -->

#### D3 Custom from YAML default only

::: Word
mitochondria

::: Definition
Organelle that produces ATP.

<!-- expect: sync; rules: RES-04,FM-03; anki_customCardDefault: Vocab -->

#### D4 Custom SKIP model section no fields

This card is under ### Vocabulary but has no ::: Field blocks.

<!-- expect: skip; rules: CUS-01; resolved custom but invalid layout -->

#### D5 Term from inherited section

::: Word
adiabatic

::: Definition
A process with no heat transfer.

<!-- expect: sync; rules: RES-08; model from ### Vocabulary -->

---

## E — Reversible and typed

### Assessment items

#### E1 Reversible delimiter only

What is the chemical symbol for sodium?

:::r
Na

<!-- expect: sync; rules: DEL-02,RES-05,CX-14; resolved: reversible -->

#### E2 Reversible redundant tag #anki/cardType/reversible

Capital of Japan?

:::
Tokyo

<!-- expect: sync; rules: REV-02,CX-16 -->

#### E3 Typed HTML stripped

Name the capital of France.

:::t
**Paris**

<!-- expect: sync; rules: TYP-03; Back plain: Paris -->

#### E4 Typed tag with plain split #anki/cardType/typed

2 + 2 = ?

:::
4

<!-- expect: sync; rules: TYP-01,TYP-02 -->

#### E5 Typed multi-line back first line wins

Name a capital of France.

:::t
Paris
Lyon
Marseille

<!-- expect: sync; rules: TYP-04; Back plain: Paris (first non-empty line only) -->

---

## F — Conflicts and file-default stress

### Conflict gallery

#### F1 Basic resolved plus reversible delimiter

A basic card that incorrectly uses the reversible token.

:::r
Wrong split for basic.

<!-- expect: sync; rules: DEL-02,RES-05,CX-14; resolved: reversible -->

#### F2 Cloze type plus typed delimiter #anki/cardType/cloze

{{hidden}} in Text.

:::t
hidden

<!-- expect: error; rules: CLZ-10,CX-11 -->

#### F3 Basic tag plus reversible delimiter #anki/cardType/basic

Front question.

:::r
Back answer.

<!-- expect: error; rules: CX-17 -->

#### F4 Custom fields plus reversible delimiter #anki/model/Vocab

::: Word
test

:::r
invalid

<!-- expect: error; rules: CUS-05,CX-21 -->

#### F5 File default basic vs cloze-style body

{{mitochondria}} without explicit cloze declaration on card or ancestors.

<!-- expect: skip; rules: CX-06,FM-02,BAS-01; no ::: and basic default conflict -->

#### F6 Custom fields resolved by file default

::: Word
isolated

::: Definition
no per-card model hashtag

<!-- expect: sync; rules: RES-04,FM-03; anki_customCardDefault supplies model for field blocks -->

##### F7 TAG conflict examples (heading-level documentation — not a card)

<!--
ERROR AT HEADING PARSE (not valid #### cards):

### Bad dual cardType #anki/cardType/cloze #anki/cardType/basic
-> error TAG-01, CX-01

### Bad cardType + model #anki/cardType/cloze #anki/model/Vocab
-> error TAG-02, CX-02
-->

---

## G — Edge cases

### Edge gallery #anki/cardType/cloze

#### G1 Delimiter inside code only

The {{runtime}} is not a delimiter below.

```python
print(":::")
```

:::

Back extra after the real split.

<!-- expect: sync; rules: DEL-07,CLZ-02 -->

#### G2a Custom field named r #anki/model/Edge

::: r
Content for field literally named "r".

<!-- expect: sync; rules: DEL-06; NOT reversible -->

#### G2b Reversible reserved token #anki/cardType/reversible

Symbol for gold?

:::r
Au

<!-- expect: sync; rules: DEL-02,DEL-06; resolved: reversible -->

#### G3 Empty cloze deletion

Something {{}} empty here.

<!-- expect: skip; rules: CLZ-09,CX-28 -->

#### G4 Section tags split correctly

{{ATP}} in cells.

<!-- expect: sync; rules: STR-04,CX-29; #biology on ### Thermodynamics syncs; #anki/cardType/cloze stripped -->

### Invalid noteType tag #anki/noteType/cloze

#### G5 noteType tag does not declare cloze

What is H₂O?

:::

Water.

<!-- expect: sync; rules: TAG-04; resolved: basic (anki_cardDefault); #anki/noteType/cloze does NOT declare cloze -->

---

## H — Additional matrix coverage

### Override section #anki/cardType/cloze

#### H1 Cloze manual merge with auto

{{c1::foo}} and later {{foo}} merge to c1.

<!-- expect: sync; rules: CLZ-07 -->

#### H7 Section overrides file default basic

{{inherited cloze}} when file frontmatter says basic.

<!-- expect: sync; rules: FM-04,STR-02; ### beats anki_cardDefault -->

#### H8 Under cloze override section

{{another inherited cloze}}.

<!-- expect: sync; resolved: cloze from ### Override section -->

## Distant chapter #anki/cardType/basic

### Nested under basic chapter

#### H9 Sibling section not inherited

What is NaCl?

:::

Sodium chloride.

<!-- expect: sync; rules: RES-02,RES-03,CX-23; resolved: basic from ## Distant chapter; NOT cloze from sibling ### Override section -->

#### H6 File default basic plain card

Plain question under distant basic chapter?

:::

Plain answer.

<!-- expect: sync; rules: FM-02; resolved: basic from ## Distant chapter #anki/cardType/basic -->

### Subsection cloze override #anki/cardType/cloze

#### H10 Nearest ancestor RES-03

{{hidden}} under ### cloze, not ## basic parent.

<!-- expect: sync; rules: RES-03; resolved: cloze from ### Subsection; stops before ## Distant chapter basic -->

### Assessment edge cases

#### H2 Reversible SKIP no split #anki/cardType/reversible

Question only, no delimiter.

<!-- expect: skip; rules: REV-03 -->

#### H3 Typed SKIP no split #anki/cardType/typed

What is 1+1?

<!-- expect: skip; rules: TYP-02 -->

#### H4 Custom unknown field #anki/model/Vocab

::: Definiton
typo

<!-- expect: error; rules: CUS-02 -->

#### H5 Custom literal braces #anki/model/Vocab

::: Word
{{not a cloze}}

::: Definition
Literal braces in custom field.

<!-- expect: sync; rules: CLZ-12 -->

#### I8 Second delimiter stays in back

Front text before first split.

:::

Line before inner delimiter.

:::

This line should remain Back content with the inner ::: marker.

<!-- expect: sync; rules: DEL-08,BAS-01; resolved: basic; back_contains: inner ::: marker -->

---

## I — Coverage gap scenarios

### Cloze gallery #anki/cardType/cloze

#### I1 Basic resolved plus custom field #anki/cardType/basic

Plain front text.

::: Word
invalid field on basic card

<!-- expect: error; rules: BAS-06,CX-10 -->

#### I2 Inherited cloze plus reversible delimiter

Inherited cloze {{token}} in Text.

:::r
Should conflict with cloze resolution.

<!-- expect: error; rules: CLZ-10,REV-05,CX-30 -->

### Vocabulary inherited #anki/model/Vocab

#### I3 Custom plain split only

Front question under custom model section.

:::

Back answer without ::: Field blocks.

<!-- expect: skip; rules: CUS-04,CX-20 -->

### STR-03 H5 ignored #anki/cardType/cloze

#### I4 Inherits cloze not H5 basic

{{mitochondria}} is the powerhouse.

<!-- expect: sync; rules: STR-02; resolved: cloze -->

##### H5 basic tag ignored #anki/cardType/basic

#### I5 Still inherits section cloze after H5

{{ATP}} carries chemical energy.

<!-- expect: sync; rules: RES-03; resolved: cloze; NOT basic from ignored ##### -->

### I6 Dual cardType section #anki/cardType/cloze #anki/cardType/basic

#### I6a Card under dual cardType section

Question under conflicting section?

:::

Answer.

<!-- expect: error; rules: TAG-01,CX-01,CX-26 -->

### I7 cardType plus model section #anki/cardType/cloze #anki/model/Vocab

#### I7a Card under cardType model conflict

::: Word
entropy

::: Definition
Energy dispersal.

<!-- expect: error; rules: TAG-02,CX-02 -->
