# Design tokens

The reference simulator's look, adopted for both member apps by the owner on
2026-10-30 (`docs/decisions.md`). The palette, type, radii and shadows are
read off the reference's `tailwind.config.js` and `src/index.css`, the
screens off `UI Components/*.png`; the dark values are ours. The meaning of
each colour stays fixed:

- **violet (`ai`)**: anything the agent says or does;
- **amber (`human`)**: a person deciding, or something waiting on one;
- **indigo (`stage`)**: app chrome and primary actions;
- **red (`decision`)**: urgent, low, overdue;
- **green (`ok`)**: enough, approved.

The web and iOS clients use these names and values. Web:
`apps/web/src/styles/tokens.css` (on the web branch, `--color-<name>`). iOS:
`apps/ios/Vantari/Design/Tokens.swift`, where hyphenated names become camel
case (`stage-bg` is `stageBg`, `space-1` is `space1`) and the type tokens sit
under `Tokens.Fonts` (`card` is both a colour and a type token). A test in
each client checks that every name below is defined there.

## Colour

| Token         | Light     | Dark      | Role                                                 |
| ------------- | --------- | --------- | ---------------------------------------------------- |
| `ink`         | `#0F172A` | `#F1F5F9` | Text                                                 |
| `muted`       | `#536072` | `#A3AEC0` | Secondary text, meta, inactive tabs                  |
| `line`        | `#E6E8EF` | `#2A3142` | Borders, dividers                                    |
| `surface`     | `#F7F7FB` | `#0B1020` | Screen background                                    |
| `card`        | `#FFFFFF` | `#151B2E` | Cards, bars, the agent's bubbles                     |
| `secondary`   | `#F1F2F7` | `#222A3D` | Progress track, neutral chips                        |
| `stage`       | `#4338CA` | `#818CF8` | App chrome: active tab pill, links, send button      |
| `stage-bg`    | `#EEF2FF` | `#1E1B4B` | Tinted action rows                                   |
| `ai`          | `#6D28D9` | `#C4B5FD` | Anything the agent says or does                      |
| `ai-bg`       | `#F4EFFF` | `#2E1065` | Agent record cards                                   |
| `ai-soft`     | `#E9E1FF` | `#3B1F7A` | The AI tag                                           |
| `ai-deep`     | `#4C1D95` | `#DDD6FE` | Text on the AI tag                                   |
| `human`       | `#B45309` | `#FBBF24` | A person deciding: open cards, waiting strips        |
| `human-bg`    | `#FFF6E5` | `#3A2508` | Open card body, waiting banner                       |
| `human-soft`  | `#FDE7C3` | `#5A3A0C` | Open card band, Human tag                            |
| `decision`    | `#C81E1E` | `#F87171` | Urgent, low stock, overdue, badges                   |
| `decision-bg` | `#FEF2F2` | `#3B1212` | Low-stock chip, must-not-miss chip                   |
| `ok`          | `#15803D` | `#4ADE80` | Enough stock, approved                               |
| `ok-bg`       | `#F0FDF4` | `#0F2E1A` | Days-left chip, approved card                        |
| `chat-wall`   | `#EFEAE2` | `#12161F` | Chat background (with a faint dot grid)              |
| `chat-mine`   | `#D9FDD3` | `#1F3B2A` | The member's own bubbles                             |
| `on-strong`   | `#FFFFFF` | `#0F172A` | Text on filled `stage`, `human`, `decision`          |
| `brand-1`     | `#6D28D9` | `#6D28D9` | Brand gradient start (135°)                          |
| `brand-2`     | `#4F46E5` | `#4F46E5` | Brand gradient middle (48%)                          |
| `brand-3`     | `#0EA5A4` | `#0EA5A4` | Brand gradient end                                   |
| `on-brand`    | `#FFFFFF` | `#FFFFFF` | Text and icons on the brand gradient                 |

Four values the spec gives inline sit outside the shared table, under the
same names on both clients: the text on the Human tag (`human-deep`,
`#7C3A06` / `#FDE7C3`, from the reference's `brand.tsx`, because `human` on
`human-soft` is 4.2:1), the answered-yes card band (`ok-band`, `#DCFCE7` /
`#14532D`), and the tests section chip (`test` `#0F766E` / `#5EEAD4` on
`test-bg` `#E6FFFB` / `#0F2E2B`, from the reference's home; the dark pairs
are proposals). iOS defines them in `Tokens.swift` as `humanDeep`, `okBand`,
`test` and `testBg`.

Person avatars are a flat colour with white initials, the colour picked by
the sum of the name's character codes modulo 6 (the reference's
`src/components/brand.tsx`): `#0F766E`, `#B45309`, `#BE185D`, `#1D4ED8`,
`#7C2D12`, `#15803D`.

Contrast, computed with the WCAG 2.1 formula (light / dark):

| Pair                                  | Light | Dark |
| ------------------------------------- | ----- | ---- |
| `ink` on `card`                       | 17.9  | 15.6 |
| `ink` on `surface`                    | 16.7  | 17.3 |
| `muted` on `card`                     | 6.4   | 7.6  |
| `muted` on `chat-wall`                | 5.3   | 8.1  |
| `ink` on `chat-mine`                  | 16.1  | 11.2 |
| `on-strong` on `stage`                | 7.9   | 6.0  |
| `ai` on `card`                        | 7.1   | 9.3  |
| `ai-deep` on `ai-soft` (AI tag)       | 8.7   | 9.1  |
| `human` on `human-bg`                 | 4.7   | 8.7  |
| `on-strong` on `human` (first button) | 5.0   | 10.7 |
| `decision` on `decision-bg`           | 5.2   | 5.9  |
| `ok` on `ok-bg`                       | 4.8   | 8.5  |
| `on-brand` on `brand-1`               | 7.1   | 7.1  |
| `on-brand` on `brand-2`               | 6.3   | 6.3  |

Known gaps, recorded in `docs/decisions.md`: `on-brand` on `brand-3` (the
gradient's teal end) is 3.0:1, so the header keeps its words on the violet
and indigo part and on the translucent white chips, as the reference did;
and `human` on `human-soft` (the open card's band) is 4.2:1 in light mode,
where the band's words are bold.

## Type

The reference's sizes, raised so body text is at least 16 (brief, Section 5).

| Token   | Web          | iOS (Dynamic Type)  | Used for                                   |
| ------- | ------------ | ------------------- | ------------------------------------------ |
| `app`   | 26px/32, 700 | Title, bold         | Big figures (card amounts)                 |
| `pane`  | 20px/26, 600 | Title 3, semibold   | Sheet / screen titles                      |
| `brand` | 19px, 800    | Title 3, heavy      | Product name in the header                 |
| `card`  | 18px/24, 600 | Headline            | Medicine and test names, card titles       |
| `body`  | 16px/23, 400 | Body                | Messages, latest word                      |
| `meta`  | 14px/19, 500 | Subheadline, medium | Dates, strength, chips, tab labels         |
| `badge` | 12px/16, 700 | Caption, bold       | AI / Human tags, "Vantari · AI" label      |

| Token            | Web                   | iOS                    |
| ---------------- | --------------------- | ---------------------- |
| `leading-telugu` | 1.7 under `:lang(te)` | 6pt extra line spacing |

Telugu needs more vertical room than Latin. The web loads Inter, Plus Jakarta
Sans (the product name and headings) and Noto Sans Telugu; iOS uses the
system font, which covers Telugu, and adds the extra line spacing to Telugu
text, since Dynamic Type sets line height per text style.

## Shape and space

| Token            | Value | Used for                                             |
| ---------------- | ----- | ---------------------------------------------------- |
| `radius-card`    | 16    | Cards, decision cards, banners                       |
| `radius-control` | 12    | Inner panels, buttons inside cards, inputs' rows     |
| `radius-pill`    | 999   | Chips, tab pill, composer field, avatars             |
| `radius-tail`    | 6     | The bubble corner nearest the speaker                |
| `space-1`        | 4     |                                                      |
| `space-2`        | 8     |                                                      |
| `space-3`        | 12    |                                                      |
| `space-4`        | 16    | Screen gutter                                        |
| `space-5`        | 20    | Between home sections                                |
| `touch`          | 44    | Minimum tappable size                                |

Web values are CSS pixels; iOS values are points.

Shadows: a card `0 1px 2px rgba(15,23,42,.06), 0 4px 14px rgba(15,23,42,.06)`;
a bubble `0 1px 1.5px rgba(15,23,42,.13)`. None in dark mode, where a card
takes a `line` border instead.
