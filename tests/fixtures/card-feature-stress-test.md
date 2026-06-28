---
AnkiSync: on
cardDeclarationHeadingLevel: 4
includeParentHeadersAsTags: true
---

<!--
STRESS-TEST CHECKLIST (14 cards, dry-run via bun run sync -- --dry-run)

Card 1  Rich Formatting Baseline     -> multi <p>, <br>, preview <h2>, table, <hr>, <mark>, code
Card 2  Inline Math On Front          -> mjx-container on front only
Card 3  Display Math On Back          -> mjx-container on back only
Card 4  Footnotes Set A               -> front <sup>1</sup><sup>2</sup>, back <hr> + defs
Card 5  Footnotes Set B               -> separate card
<!--anki-id: 9e58efe4-cc6c-4004-8aab-eb0b06e1fe70-->
, own footnote footer again
Card 6  Callouts Only                 -> callout-note, callout-warning
Card 7  Transclusion On Front         -> graft visible; NOT "should not be visible"
Card 8  Transclusion On Back          -> graft on back field
Card 9  Embed Plus Math               -> graft + math + footnote footer combined
Card 10 Kitchen Sink                  -> all compile features in one card
Card 11 Delimiter Safety              -> ? in prose OK; ::: only in code block
Card 12 Heading Is The Front          -> H4 title becomes front text
Card 13 Legacy Delimiter In Prose     -> CS101::Week 2::Entropy does not split card
Card 14 Math Delimiter In Display     -> ::: inside $$...$$ does not split card
-->

# Feature Stress Test

### Subsection A

#### Rich Formatting Baseline

What is entropy in thermodynamics?

It measures how dispersed energy is in a closed system.

Line one\
Line two in the same paragraph.

:::

: ## Preview section title

This answer has **bold**, *italic*, and ***both***.

| Column A | Column B |
| -------- | -------- |
| alpha    | beta     |

---

==highlighted== text follows.

```python
# delimiter inside code must not split the card
print(":::")
```
<!--anki-id: f688442d-4f74-4c06-8bc2-0baecf98df40-->


#### Inline Math On Front

What is Newton's second law? Use $F=ma$ on the front.

:::

Force equals mass times acceleration.
<!--anki-id: 1452c363-d980-49b3-b721-e5030493a7c5-->


#### Display Math On Back

What is the integral of x squared from 0 to 1?

:::

$$
\int_0^1 x^2\,dx
$$
<!--anki-id: c91a2b43-a41b-4cb8-89bc-865074f9b51b-->


#### Footnotes Set A

Question with first ref[^note-a] and second[^note-b].

:::

Answer cites[^note-a] and mentions[^note-b] again.

[^note-a]: First footnote definition for set A.
[^note-b]: Second footnote definition for set A.
<!--anki-id: 0a4e234d-c71b-4815-a366-2d6c492fbe4b-->


#### Footnotes Set B

Another card with ref[^note-a] only on the front.

:::

Back cites[^note-a] with a different definition block.

[^note-a]: Footnote definition for set B (card-scoped, not shared with card 4).
<!--anki-id: 648a0320-034f-47c3-bcd0-86a3e14b022e-->


#### Callouts Only

What is an Obsidian callout?

:::

> [!note]
> Note callout body on the second line.

> [!warning] Custom warning title
> Warning body continues here.
<!--anki-id: db95d553-17f1-4136-946f-13f44596ed99-->


#### Transclusion On Front

![[embed_me#This section is for embedding]]

What content from the embed should appear on this card front?

:::

Only this short back answer should appear without the embed block.
<!--anki-id: 5679d9f6-caed-495a-855e-41bb5945e714-->


### Subsection B

#### Transclusion On Back

What note is transcluded on the back of this card?

:::

![[embed_me#This section is for embedding]]

#### Embed Plus Math

![[embed_me#This section is for embedding]]

Front also has inline math $E=mc^2$ and footnote ref[^embed-card].

:::

Display math on back:

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$

[^embed-card]: Footnote on embed-plus-math card back.
<!--anki-id: 9f4a4c65-1641-43b1-8ca8-a306d8e630b0-->


#### Kitchen Sink

Kitchen sink front paragraph one.

Kitchen sink front paragraph two.

Soft front\
break line.

Inline $F=ma$ and footnote[^sink] on front.

:::

: ## Kitchen sink answer

**Bold**, *italic*, ***both***, ==highlight==.

| Sink | OK |
| ---- | -- |
| row  | 1  |

---

> [!tip] Sink callout
> Callout inside kitchen sink back.

```js
// ::: in code is safe
const d = ":::";
```

$$
\int_0^1 x^2\,dx
$$

[^sink]: Kitchen sink footnote definition at bottom.
<!--anki-id: 5826b1f4-f891-4749-8484-a783f75fb7ec-->


#### Delimiter Safety

Is this a question with a question mark?

:::

```text
::: delimiter inside fenced code only
```
<!--anki-id: df6654b3-270c-40ec-8e62-9309d3be8d4d-->


#### Heading Is The Front

:::

Back paragraph one for heading-as-front card.

Back paragraph two continues the answer.
<!--anki-id: afdb05cd-8825-4a30-8100-ab0a8ac53252-->


#### Legacy Delimiter In Prose

The prose token CS101::Week 2::Entropy must not split this card.

:::

Normal back content for legacy delimiter card.
<!--anki-id: e374afac-b24f-47f9-a06c-522c25b43671-->


#### Math Delimiter In Display

Can display math contain a delimiter-like token?

:::

$$
x ::: y
$$

The math block above must not have split this card.
<!--anki-id: 450d9c7e-b452-4529-a31c-7489a783baa5-->

