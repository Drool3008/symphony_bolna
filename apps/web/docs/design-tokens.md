# Design tokens

The reference simulator's look, adopted by the owner on 2026-10-30
(`decisions.md`): a brand gradient header, white cards on a soft surface,
violet for anything the agent says or does, amber for a person deciding, red
for urgent, green for enough. Values are read off
`../super-duper-engine-reference/tailwind.config.js` and `src/index.css`;
the type is the reference's, raised so body text is at least 16px (brief,
Section 5).

The web and iOS clients use these names and values, so the two read as one
product. Web: `apps/web/src/styles/tokens.css` (`--color-<name>`,
`--type-<name>`, `--<name>`). iOS: `apps/ios/Vantari/Design/Tokens.swift`. A
test in each client checks that every name in the tables below is defined
there.

## Colour

| Token         | Light     | Dark      | Role                                            |
| ------------- | --------- | --------- | ----------------------------------------------- |
| `ink`         | `#0F172A` | `#F1F5F9` | Text                                            |
| `muted`       | `#536072` | `#A3AEC0` | Secondary text, meta, inactive tabs             |
| `line`        | `#E6E8EF` | `#2A3142` | Borders, dividers                               |
| `surface`     | `#F7F7FB` | `#0B1020` | Screen background                               |
| `card`        | `#FFFFFF` | `#151B2E` | Cards, bars, the agent's bubbles                |
| `secondary`   | `#F1F2F7` | `#222A3D` | Progress track, neutral chips                   |
| `stage`       | `#4338CA` | `#818CF8` | App chrome: active tab pill, links, send button |
| `stage-bg`    | `#EEF2FF` | `#1E1B4B` | Tinted action rows                              |
| `ai`          | `#6D28D9` | `#C4B5FD` | Anything the agent says or does                 |
| `ai-bg`       | `#F4EFFF` | `#2E1065` | Agent record cards                              |
| `ai-soft`     | `#E9E1FF` | `#3B1F7A` | The AI tag                                      |
| `ai-deep`     | `#4C1D95` | `#DDD6FE` | Text on the AI tag                              |
| `human`       | `#B45309` | `#FBBF24` | A person deciding: open cards, waiting strips   |
| `human-bg`    | `#FFF6E5` | `#3A2508` | Open card body, waiting banner                  |
| `human-soft`  | `#FDE7C3` | `#5A3A0C` | Open card band, Human tag                       |
| `decision`    | `#C81E1E` | `#F87171` | Urgent, low stock, overdue, badges              |
| `decision-bg` | `#FEF2F2` | `#3B1212` | Low-stock chip, must-not-miss chip              |
| `ok`          | `#15803D` | `#4ADE80` | Enough stock, approved                          |
| `ok-bg`       | `#F0FDF4` | `#0F2E1A` | Days-left chip, approved card                   |
| `chat-wall`   | `#EFEAE2` | `#12161F` | Chat background (with a faint dot grid)         |
| `chat-mine`   | `#D9FDD3` | `#1F3B2A` | The member's own bubbles                        |
| `on-strong`   | `#FFFFFF` | `#0F172A` | Text on filled `stage`, `human`, `decision`     |
| `brand-1`     | `#6D28D9` | `#6D28D9` | Brand gradient start (135°)                     |
| `brand-2`     | `#4F46E5` | `#4F46E5` | Brand gradient middle (48%)                     |
| `brand-3`     | `#0EA5A4` | `#0EA5A4` | Brand gradient end                              |
| `on-brand`    | `#FFFFFF` | `#FFFFFF` | Text and icons on the brand gradient            |

A few values the spec gives inline sit outside the shared table, in
`tokens.css` only: the answered-yes card band (`ok-band`, `#DCFCE7` /
`#14532D`), the tests section chip (`test` `#0F766E` on `test-bg`
`#E6FFFB`, from the reference's home; the dark pair is a proposal), the
text on the Human tag (`human-deep`, `#7C3A06`, from the reference's
`brand.tsx`, because `human` on `human-soft` is 4.2:1), and the chat wall's
dot grid (`chat-dots`).

Person avatars are a flat colour with white initials, picked by summing the
name's character codes mod 6 (reference `src/components/brand.tsx`):
`#0F766E #B45309 #BE185D #1D4ED8 #7C2D12 #15803D`.

Contrast, computed with the WCAG 2.1 formula:

| Pair                          | Light         | Dark   |
| ----------------------------- | ------------- | ------ |
| ink on card                   | 17.9:1        | 15.6:1 |
| muted on card                 | 6.4:1         | 7.6:1  |
| muted on surface              | 6.0:1         | 8.5:1  |
| muted on chat-wall            | 5.3:1         | 8.1:1  |
| on-strong on stage            | 7.9:1         | 6.0:1  |
| stage on stage-bg             | 7.1:1         | 5.4:1  |
| ai-deep on ai-soft            | 8.7:1         | 9.1:1  |
| human on human-bg             | 4.7:1         | 8.7:1  |
| on-strong on human            | 5.0:1         | 10.7:1 |
| decision on decision-bg       | 5.2:1         | 5.9:1  |
| ok on ok-bg                   | 4.8:1         | 8.5:1  |
| ink on chat-mine              | 16.1:1        | 11.2:1 |
| on-brand on brand-1 / brand-2 | 7.1:1 / 6.3:1 | same   |
| on-brand on brand-3           | 3.0:1         | same   |

**Known gap:** white on the gradient's teal end (`brand-3`) is below AA for
small text. The header keeps its text on the violet and indigo part and on
the translucent white chips, as the reference did (`decisions.md`).

## Type

The reference sizes, raised so body text is at least 16 (brief, Section 5).

| Token   | Web          | iOS (Dynamic Type) | Used for                               |
| ------- | ------------ | ------------------ | -------------------------------------- |
| `app`   | 26px/32, 700 | Title, bold        | Big figures (card amounts)             |
| `pane`  | 20px/26, 600 | Title 3, semibold  | Sheet / screen titles                  |
| `brand` | 19px, 800    | Title 3, heavy     | Product name in the header             |
| `card`  | 18px/24, 600 | Headline           | Medicine and test names, card titles   |
| `body`  | 16px/23, 400 | Body               | Messages, latest word                  |
| `meta`  | 14px/19, 500 | Subheadline        | Dates, strength, chips, tab labels     |
| `badge` | 12px/16, 700 | Caption, bold      | AI / Human tags, the "name · AI" label |

`leading-telugu` 1.7 for Telugu (`:lang(te)` on web; extra line spacing on
iOS). Web fonts from Google Fonts: Inter (text), Plus Jakarta Sans (display:
the product name, headings), Noto Sans Telugu (Telugu). iOS uses the system
font.

## Shape and space

| Token            | Value | Used for                                       |
| ---------------- | ----- | ---------------------------------------------- |
| `radius-card`    | 16    | Cards, decision cards, banners                 |
| `radius-control` | 12    | Inner panels, buttons inside cards, input rows |
| `radius-pill`    | 999   | Chips, tab pill, composer field, avatars       |
| `radius-tail`    | 6     | The bubble corner nearest the speaker          |
| `space-1`        | 4     |                                                |
| `space-2`        | 8     |                                                |
| `space-3`        | 12    |                                                |
| `space-4`        | 16    | Screen gutter                                  |
| `space-5`        | 20    | Between home sections                          |
| `touch`          | 44    | Minimum tappable size                          |

Shadows: card `0 1px 2px rgba(15,23,42,.06), 0 4px 14px rgba(15,23,42,.06)`;
bubble `0 1px 1.5px rgba(15,23,42,.13)`. None in dark mode, where cards and
bubbles keep a `line` border instead.

Web values are CSS pixels; iOS values are points.
