Here are the issues that is happening:

1.  this didnt sync. Although an ID is assigned.
```
#### [STRESS-Basic-03] Empty back Allowed

Front text with delimiter but no Back content (STRESS-Basic-03).

:::

<!--anki-id: f106e19d-e1db-400a-a362-a752130b962e-->

<!-- expect:
  preview: sync — basic; empty Back region is valid
  anki: YES model="Basic" fields=Front,Back
  rules: BAS-02
  check: Basic note exists; Back field empty or minimal
-->
```

2. It didnt auto number, it shows as `{{entropy}}` in anki.
```
#### [STRESS-Cloze-02] Shorthand Deletion

The {{entropy}} increases in an isolated system (STRESS-Cloze-02).

<!--anki-id: 7215f2fd-4d37-4f0e-be43-6237c1314f92-->

<!-- expect:
  preview: sync — cloze inherited from ### section
  anki: YES model="Cloze" fields=Text,"Back Extra"
  rules: CLZ-04, CX-04, STR-02
  check: Auto-numbered cloze in Text; Back Extra empty OK
-->
```

3. live preview in obsidian not showing with `c1` or `c2`. it shows as `{{Java}}`, `{{java}}`, `{{Python}}` instead of `{{c1::Java}}`, `{{c1::Java}}`, `{{c2::Python}}`. coloring of background works.

```
#### [STRESS-Cloze-03] Auto-number and Hints

{{Java}} runs on a JVM. {{java}} is same group. {{Python}} is a new group (STRESS-Cloze-03).

<!--anki-id: 36a03fcb-8b5e-44f2-bcb6-0c41bc12e0d1-->

<!-- expect:
  preview: sync — cloze; c1=Java/java, c2=Python
  anki: YES model="Cloze" fields=Text,"Back Extra"
  rules: CLZ-05, CLZ-06
  check: Text has {{c1::Java}} and {{c2::Python}} (or equivalent numbering)
-->
```

4. seems like c1 and c5 has same color... we need to fix this.
```
#### [STRESS-Cloze-09] Multi-cloze Palette Visual Test

{{c1::First group}} and {{c2::Second group}} plus {{c3::Third group}} with {{c4::Fourth group}} and {{c5::Fifth group}}.

<!--anki-id: 7a0b06e8-2b6a-4525-9340-591def90cab5-->

<!-- expect:
  preview: sync — cloze
  anki: YES model="Cloze" fields=Text,"Back Extra"
  check: Live Preview renders 5 distinct palette colors (anki-card-preview-cloze-group-1 through 5)
-->
```

5. it shows warning in the live preview. the sync works properly and synced back part properly trims the empty lines and spaces to make the entry `Paris|Lyon|Marseille`. But why does it show warning?
it shows this in warning description card:
```
TYP-03, CX-18 applies
plain text is recommended
```

```
#### [STRESS-Typed-03] TYP-05 Multi-answer Pipes

Name a capital of France (STRESS-Typed-03).

:::t

Paris | Lyon | Marseille

<!--anki-id: aaf8f0a1-af57-4373-8213-c6f6aa404ba6-->

<!-- expect:
  preview: sync — typed multi-answer
  anki: YES model="Basic (type in the answer)" fields=Front,Back
  rules: TYP-05
  check: Back field exactly `Paris|Lyon|Marseille`; all three accepted in review
-->
```

I understand that plain text is recommended. issue is: even if I write `Paris|Lyon|Marseille`, it shows the same warning.

6. The extra line didnt trigger warning. after sync, the back part removed the extra line. it became `Berlin`, which is good. but it should show the warning in live preview.

```

#### [STRESS-Typed-05] Multiline Typed Answer Warn

What is the capital of Germany (STRESS-Typed-05)?

:::t

Berlin

Extra explanatory line that should trigger a warning.

<!--anki-id: bdc99a50-05fe-49f2-be4c-518d3dda1d38-->

<!-- expect:
  preview: warn — typed answer should be a single line (TYP-04)
  anki: YES model="Basic (type in the answer)" fields=Front,Back
  rules: TYP-04
  check: Warning badge in preview; only first line used or warning surfaced
-->
```

7. All Vocab type shows Note definition vocab sync not implemented...

8. It didnt include the exam prep hashtag. it did strip out `#anki/cardType/cloze`.

```
### Unit C — Tag Separation #exam-prep #anki/cardType/cloze

#### [STRESS-Sect-04] User Tag Separated from Engine Tag

The {{c1::Krebs cycle}} takes place in mitochondria (STRESS-Sect-04).

<!--anki-id: 7a20dabd-22e1-43c0-8217-2874986ab8bb-->

<!-- expect:
  preview: sync — cloze
  anki: YES model="Cloze" fields=Text,"Back Extra"
  rules: STR-04, CX-29
  check: Anki tags include exam-prep; `#anki/cardType/cloze` is stripped
-->
```

9. it syncs properly. but the obsidian live preview background got removed after the heading line. should it continue over the whole note and be highlighted in yellow? I dont remember the rules.

```
#### [STRESS-Rich-06] Empty-heading Resilience

####

What is the powerhouse of the cell (STRESS-Rich-06 empty heading)?

:::

Mitochondria.

<!--anki-id: be06e945-8aeb-4807-8297-fd9c7ebf0921-->

<!-- expect:
  preview: sync — basic
  anki: YES model="Basic" fields=Front,Back
  check: Heading with empty text maintains exact card ordinal and compiles correctly
-->
```

10. when live preview is on, and I start writing or typing anything, like `{{test}}` after `... after a 200 ms pause, the AST re-parses smoothly.` line to make it a cloze, I see that the preivew chip shows both `basic` and `basic ⚠️` and gets laid over on top... something is wrong. it should detect and show only the correct one which is `basic ⚠️`.  even though literal cloze infer is turned on. I tried in another basic card and same happened. what was the rules again? I forgot. maybe I have to manually add the `t` after `:::` to make it a truly typed card? or something like that, if thats the case, it should show a warning instead of showing both. 

```
## 10. Live Preview Real-time Keystroke Responsiveness

#### [STRESS-Live-01] Instant Typing Scratchpad

Type freely in this paragraph to verify that keystrokes have zero input latency (<0.05 ms). Notice that decorations shift immediately, and after a 200 ms pause, the AST re-parses smoothly.

:::

Back content for typing scratchpad.

<!--anki-id: 6b44966d-a966-4410-a1f2-ee5080b3d447-->

<!-- expect:
  preview: sync — basic
  check: Rapid typing has zero lag; badge remains anchored at heading end
-->
```

11. The rest is working as it should.