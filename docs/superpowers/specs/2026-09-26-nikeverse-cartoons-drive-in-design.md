# Nikeverse Cartoons Drive-In: design

Status: approved in chat, 2026-09-26. Build plan to follow (writing-plans).

## Goal

nikepig.com gets a dedicated **Nikeverse Cartoons** page. It is an illustrated **night-time drive-in cinema**: every episode is an interactive prop in the scene (a car, poster board, snack-bar item or projector-booth window). Hovering over a prop, or tapping it on a touch screen, shows that episode on the drive-in's big screen. A click or a second tap plays the YouTube video embedded right there. Adding a new episode takes one prop image plus one data entry, with no layout work.

## User decisions

- Scene: drive-in cinema at night.
- Playback: on the big drive-in screen, not in a pop-up.
- Launch catalogue: every episode. Episodes not yet public show "Coming soon" until their premiere time.
- Props: a mix of cars, poster boards, snack-bar items and projector-booth items.
- Layout: automatic row-by-row lot (approach A).
- Screen: shape-shifting. It is 9:16 for Shorts and widens to 16:9 for the two landscape episodes (Pilot and C2).
- Art: generated with the user's **Tripo3D Chrome extension (GPT Image 2.5, 4K)** at build time. Nothing is generated before the build.
- Testing is text-only (the user is on mobile).

## Architecture

Everything is static: no framework, build step or dependencies, matching the main site. GitHub Pages serves it from the repo root.

```
cartoons/
  index.html        page markup, inline CSS + JS (house style: single self-contained file)
  episodes.json     the episode catalogue (the only file edited per upload; one prop image is added alongside)
  art/              bg-4k source, bg-desktop.webp, lot-extension.webp, screen-frame.webp
  props/            one WebP cutout (alpha) per episode
```

Main site (`index.html`) changes:
- A **"Cartoons"** link in `#navbar`, pointing to `cartoons/`.
- A **Nikeverse Cartoons** card in the `#nft` Nikeverse grid, copied from an existing static card block (the grid is static markup, around line 636), with a sticker title logo (`assets/art/title-cartoons.webp`) that follows the existing `.verse-title-img` rules. The nav wrap must be checked on mobile.
- Nothing else on the main page changes.

## Units

1. **Catalogue (`episodes.json`)**: an array of episodes in display order. Fields:
   `id` (e.g. `"c14"`), `title`, `youtube` (11-char ID), `format` (`"portrait"` | `"landscape"`), `premiere` (ISO datetime with offset), `prop` (`"car"` | `"poster"` | `"snack"` | `"booth"`), `image` (path under `props/`), `alt` (short description).
2. **Layout engine**: a pure function from the catalogue plus viewport size to a position and scale for each prop.
   - **Special spots:** poster board ×2, snack counter ×1 and booth window ×1 are fixed anchor points in the art, each with its own coordinates. They are filled in catalogue order. If a special prop has no free spot, it falls back to a car row.
   - **Car rows:** three perspective rows. The back row is smallest and highest; the front row is largest and lowest. Rows fill left to right, starting with the front row.
   - **Overflow:** when the rows are full, one repeating `lot-extension.webp` segment is added to the right and filling continues there. The scene then scrolls horizontally. There is no episode cap.
   - **Coordinates:** positions are percentages of the **base-scene width and height**. Each `lot-extension` segment is exactly one base-scene width, so segment *n* adds *n* × 100% to x.
   - **Row capacities per base scene:** back row 5, middle row 4, front row 3 (12 cars). Extension segments hold 12 cars each in the same rows.
   - **Anchor measurement:** the special-spot coordinates, row baselines and scales are **measured from the generated background** and stored in one layout constant. *(As built: it lives as `DEFAULT_LAYOUT` in `cartoons/drivein-core.js`, next to the pure `layoutProps` engine, so unit tests can check it; the current values are placeholder geometry that keeps the special spots outside the landscape screen footprint.)*
3. **Screen**:
   - It is an overlaid element (frame art plus a content box), not part of the background painting. The painting leaves a blank screen-support area.
   - It animates between 9:16 and 16:9 according to the selected episode's `format`.
   - **Idle:** a "Now showing: Nikeverse" title card.
   - **Preview:** the thumbnail (`https://i.ytimg.com/vi/<id>/hqdefault.jpg`, `object-fit: cover`, which crops the 4:3 image to the vertical content in the 9:16 box), the title and a play button.
   - **Playing:** an iframe from `https://www.youtube-nocookie.com/embed/<id>?autoplay=1&playsinline=1&rel=0`, with `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"` and `allowfullscreen`. iOS may still require a tap on YouTube's own play button; that's acceptable. A small "Watch on YouTube" link is shown for any selected, already-premiered episode. *(As built: on desktop it is a pill beside the screen's top-right corner so it never covers props or the player; in the stacked mobile layout it sits just below the screen.)*
   - **Coming soon:** a "Premieres <date>" card over the episode's **prop art** (no thumbnail request), with no player.
4. **Props**:
   - Each prop is a `<button>` holding the prop image, with `aria-label` "Play <title>" or "<title>, premieres <date>".
   - Hover or focus lifts and glows the prop and shows a small title tag.
   - Props before their premiere are dimmed and carry a "Premieres" tag. *(As built: the badge shows the date only, e.g. "27 Sept", so it fits small props; the `aria-label` keeps the full "<title>, premieres <date>" wording.)*
   - The public/coming-soon state is computed on each page load from `premiere` against the current time, so no edit is needed at premiere.

## Interaction

- **Desktop:** hover or focus previews on the screen, and a click plays. **While a video is playing, hover and focus only show the title tag and never change the screen.** Switching needs a click on another prop, which stops the current video and plays the new one, or Esc, which stops playback and returns to preview. Leaving all props keeps the last preview.
- **Touch:** the first tap previews and the second tap on the same prop plays. The mechanism is pointer-type detection (`pointerType` on `pointerdown`, plus `matchMedia('(hover: hover)')`) and a `previewedId` state: a touch activation plays only if that prop is already the one previewed; otherwise it previews. Emulated mouse events from touch are ignored. *(As built: touch is detected from `pointerType === 'touch'` on `pointerdown`/`pointerenter`, and a click or focus within a short window (800 ms) after a touch pointerdown is treated as touch; `matchMedia('(hover: hover)')` only gates the hover styles.)*
- **Keyboard:** Tab moves through the props in catalogue order, Enter or Space plays, and Esc stops the video.
- Only one iframe exists at a time. Switching removes the old iframe, which stops its audio.

**Clarifications (spec review 2):**
- **Coming soon:** a coming-soon prop's click, tap or Enter only shows its "Premieres" card. It never creates an iframe, and the "Watch on YouTube" link is hidden until the premiere.
- **Screen on wide lots:** when extension segments make the scene scroll sideways on desktop, the screen stays pinned (`position: sticky`) at the left of the viewport, so it never scrolls away.
- **Tap targets:** each prop `<button>` has a minimum hit area of 44×44 px. It's padded around the image on small back-row props; the art itself is never enlarged.
- **C9:** uses the corrected upload `3mm3QSeXjo8`. Editing an existing entry is a one-line `episodes.json` change.
- **Stale doc:** fix the stale `CLAUDE.md` line that says the `#nft` grid is JS-rendered (it's static markup) during the docs step.

## Mobile (portrait, under 768 px)

*(As built: the stacked layout applies to portrait viewports under 768 px and to any portrait viewport with aspect ratio at most 4:5, e.g. portrait tablets; landscape phones use the desktop layout.)*

- The screen is sticky at the top of the viewport and takes about 45% of its height.
- Below it, the **whole scene** (background plus props, with the same percentage coordinates) is scaled to fill the remaining height and scrolls **horizontally** with scroll snap on props. There is no separate mobile crop.
- Props have a tap target of at least 44 px.
- On load, the scroller starts centred on the snack bar and screen area.

## Art pipeline (at build time)

- **Background:** one 4K generation in Tripo3D (GPT Image 2.5). It shows a night drive-in in the Nikeverse Meme Machine 2D cartoon style (bold outlines, painted, vivid, no text): a starry sky over ranch hills, an **empty** lot with three row lines, the snack bar (left), the projector booth (right), two empty poster boards, and a blank area where the screen frame sits.
- **Derived art:** the desktop WebP and a seamlessly tiling `lot-extension.webp` strip, cut from or generated to match the background.
- **Main-site sticker:** `assets/art/title-cartoons.webp`, a die-cut sticker logo reading "Nikeverse Cartoons" in the house `.verse-title-img` style.
- **Screen frame:** a separate cutout: the tall screen frame and its support.
- **Props:** one cutout per episode, in the same style with a transparent background, hinting at the story. Examples:
  - C14: a pickup with a daisy on the antenna.
  - C11: a car with a coat rack on its roof.
  - C13: a snack-counter "4 chips" sign.
  - Pilot: a poster board with the apple-chip ledger.
- **Characters** in props must match the canonical sheets (Nike: stump legs, innocent expression).
- **Encoding:** WebP. The desktop background should be ≤ 600 KB and each prop ≤ 120 KB where possible.

## Launch catalogue

The site links the **corrected re-uploads** where they exist (user, 2026-09-26: "upload all the caption inconsistent size and logo messed up ones onto YouTube only … then linking them to my site"; the older uploads stay on YouTube as duplicates). C3–C9 are corrected and Public. C10–C12 are corrected and **Unlisted**, so they embed without spoiling their scheduled premieres, and the site still gates them by `premiere`. For episodes that are already public, `premiere` is a fixed past date: `"2026-09-01T00:00:00+08:00"`.

| # | id | Title | YouTube (site) | Format | Premiere (+08:00) | prop | Prop concept |
|---|---|---|---|---|---|---|---|
| 1 | pilot | The Apple Chip Ledger | KCV8nHowlpo | landscape | past | poster | Poster board: Charles holding the apple-chip ledger |
| 2 | c2 | Do Your Cutest Thing | NR6ogdyPKVI | landscape | past | poster | Poster board: Poppy doing her cutest face |
| 3 | c3 | 45-Minute Diner Wait | rt7cQLtGyEE | portrait | past | car | 1950s diner-style car with a "45 min" wait sign on the roof |
| 4 | c4 | Apple Chip Intervention | irGVaTJJyb4 | portrait | past | car | Station wagon stuffed with apple-chip bags in the back window |
| 5 | c5 | Time for chores! | wCXxBkEbMgI | portrait | past | car | Car draped in a bedsheet, one pig trotter sticking out |
| 6 | c6 | Moral Support | s4WUUF-3D_Y | portrait | past | car | Small hatchback with a mattress strapped to the roof |
| 7 | c7 | Father-in-Law Chat | P4_XraZPen0 | portrait | past | car | Family sedan, Nike asleep on the back seat |
| 8 | c8 | The 6 AM Negotiation | aTbG9rtgaa8 | portrait | past | car | Pickup with a giant alarm clock on the dashboard showing 6:00 |
| 9 | c9 | The Void | 3mm3QSeXjo8 | portrait | past | booth | Projector-booth window with an empty chip bag hanging from it |
| 10 | c10 | Order in the Yard | sbbO2273RNc | portrait | 2026-09-27T01:00 | car | Car with a judge's gavel and a single apple chip on the hood |
| 11 | c11 | The Coat Rack | 0tqDl-UKomE | portrait | 2026-09-28T01:00 | car | Car with a coat rack and a grocery bag on the roof |
| 12 | c12 | Low-Maintenance | fTT7cx6ap8s | portrait | 2026-09-29T01:00 | car | Ranch pickup with a hay bale and a butterfly in the bed |
| 13 | c13 | Worth It | vIue1jLRDuw | portrait | 2026-09-30T01:00 | snack | Snack-bar counter sign: "HUGS — 4 CHIPS" |
| 14 | c14 | Forever Hungry | 4COtDWxmMLQ | portrait | 2026-10-01T01:00 | car | Pickup with a white daisy on the antenna |

Poster ×2, snack ×1 and booth ×1 exactly fill the four special spots at launch. There are 10 cars.

## Build order

1. **Code first, on placeholder art.** Use simple flat SVG/WebP placeholders (night gradient, grey car silhouettes, coloured boxes for the special spots) so the page, the layout engine and the tests can be built and verified with no generation available.
2. **Art.** Generate the background, screen frame, props and sticker in Tripo3D (the user's Chrome extension, GPT Image 2.5, 4K). The user may need to be at the computer. Generation is never attempted through a blocked upload host.
3. **Measure and swap.** Measure the special-spot coordinates and row baselines from the final background into `LAYOUT`, swap in the real art, then re-run the tests.

## Local testing

`fetch('episodes.json')` fails under `file://`, so local testing uses `python -m http.server` from the repo root. The page also carries an inline `<script type="application/json" id="episodes-fallback">` copy of the catalogue, used when the fetch fails. It's regenerated from `episodes.json` whenever the catalogue changes, and a test asserts the two match.

## Error handling

- **Catalogue fails to load:** the lot shows "Episodes are warming up, try again" and the screen stays on the idle card.
- **Thumbnail fails:** fall back to the prop image on the screen.
- **Missing prop image:** show a generic car silhouette labelled with the title. *(As built: the image falls back to the per-type placeholder silhouette, `props/placeholder-<prop>.svg`; the title is on the button's tag and `aria-label`.)*
- **Embed blocked** (for example by a privacy extension): this can't be detected reliably, so the always-visible "Watch on YouTube" link covers it (`https://youtube.com/shorts/<id>`, or `watch?v=` for landscape episodes).
- `prefers-reduced-motion` turns off the prop lift and screen-resize animations; the screen snaps instead.

## Testing

- Headless browser (Playwright) at 375, 768, 1440 and 2560 px, and at `deviceScaleFactor` 2.
- The page must produce zero `pageerror` events.
- The layout engine must place props without overlap using the launch catalogue and synthetic catalogues of 5 and 30 entries.
- The screen must switch between 9:16 and 16:9 correctly.
- Freeze the clock before and after a premiere, e.g. 2026-09-26T16:59Z vs 17:01Z for C10, to check that the coming-soon state flips.
- Check one embed's iframe `src`.
- On the main page, the nav link and grid card must resolve, with no regressions in the site's existing Playwright checks (bg, reveal, sticker sizing).

## Process and shipping

- Follow the repo `CLAUDE.md` pipeline: plan, then build (one builder per file), then a reviewer wave, then orchestrator QC, then docs (`docs/branch-log.md`).
- Commit on `claude/paddle-payments-setup-0h567q`. Merging to `main` publishes the site, and happens only when the user says so.

## Adding an episode later

1. Generate one prop cutout and save it as `cartoons/props/<id>.webp`.
2. Append one entry to `cartoons/episodes.json`.
3. Commit, and merge when the user approves.

## Out of scope

- A CMS or upload UI.
- View counts or likes.
- Any non-YouTube platforms.
- Sound design for the page.
