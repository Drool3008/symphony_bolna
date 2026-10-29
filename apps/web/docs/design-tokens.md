# Design tokens

Direction A, "Plain page", chosen at Checkpoint A: black on white, rules
instead of boxes, and one deep-orange accent used only for "needs your
answer". Two things come from direction B: whatever waits on this member's
answer is pinned at the top of the agent thread, and every decision line
carries a mark saying who made it.

The web and iOS clients use these names, values and type scale, so the two
read as one product. Web: `apps/web/src/styles/tokens.css`. iOS:
`apps/ios/Vantari/Design/Tokens.swift`. A test in each client checks that
every name below is defined there.

## Colour

| Token       | Light     | Dark      | Used for                                                                 |
| ----------- | --------- | --------- | ------------------------------------------------------------------------ |
| `ink`       | `#111111` | `#F2F2F2` | Text, rules that divide sections, the agent's bar                        |
| `ink-2`     | `#4A4A4A` | `#B5B5B5` | Secondary text: dates, labels, meta                                      |
| `rule`      | `#D6D6D6` | `#3A3A3A` | Thin rules between rows                                                  |
| `paper`     | `#FFFFFF` | `#111111` | Background                                                               |
| `wash`      | `#F2F2F2` | `#1E1E1E` | A person's own messages                                                  |
| `accent`    | `#B34700` | `#FF9E59` | Only "needs your answer": the pinned card, its band and its first button |
| `on-accent` | `#FFFFFF` | `#111111` | Text on `accent`                                                         |

Every text and background pair is at WCAG AA or better in both modes
(computed with the WCAG 2.1 formula):

| Pair                                 | Light  | Dark     |
| ------------------------------------ | ------ | -------- |
| `ink` on `paper`                     | 18.9:1 | 16.9:1   |
| `ink-2` on `paper`                   | 8.9:1  | 9.2:1    |
| `ink` on `wash`                      | 16.9:1 | 14.9:1   |
| `ink-2` on `wash`                    | 7.9:1  | not used |
| `on-accent` on `accent`              | 5.5:1  | 9.3:1    |
| `accent` on `paper` (borders, marks) | 5.5:1  | 9.3:1    |

## Type scale

| Token     | Web       | iOS (Dynamic Type)    | Used for                                          |
| --------- | --------- | --------------------- | ------------------------------------------------- |
| `display` | 30px, 700 | Large Title, bold     | The member's name                                 |
| `figure`  | 44px, 700 | 44pt scaled with Body | Days of cover                                     |
| `title`   | 20px, 600 | Title 3, semibold     | Medicine and test names, card titles              |
| `body`    | 18px, 400 | Body                  | Messages, the agent's latest word                 |
| `meta`    | 16px, 400 | Callout               | Dates, purpose, secondary lines                   |
| `label`   | 14px, 600 | Footnote, semibold    | Section labels, who-said-it lines, decision marks |

Telugu sets with more line height than Latin: `leading` 1.45 for Latin,
`leading-telugu` 1.7. Web loads Noto Sans and Noto Sans Telugu; iOS uses the
system font, which covers Telugu.

## Space and size

| Token        | Value | Used for                                      |
| ------------ | ----- | --------------------------------------------- |
| `space-1`    | 4     | Between a label and its value                 |
| `space-2`    | 8     | Inside a row                                  |
| `space-3`    | 12    | Card padding, between buttons                 |
| `space-4`    | 16    | Screen gutter, between messages               |
| `space-5`    | 24    | Between sections                              |
| `touch`      | 48    | Minimum height and width of anything tappable |
| `rule-thin`  | 1     | Rules between rows                            |
| `rule-thick` | 2     | The header rule, card borders, buttons        |
| `bar`        | 4     | The bar that marks the agent's messages       |

Web values are CSS pixels; iOS values are points.
