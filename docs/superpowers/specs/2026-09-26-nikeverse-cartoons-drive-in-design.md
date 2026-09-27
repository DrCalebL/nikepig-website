# Nikeverse Cartoons Drive-In: design

Status: approved in chat, 2026-09-26. Build plan to follow (writing-plans). **Revised 2026-09-27 — see "Revision 3" (reels) and "Revision 2" below.**

## Revision 3 (2026-09-27 evening): reels on fairy lights — supersedes the prop-lot text

User decision in chat, 2026-09-27 evening. It wins over Revision 2 and the original text wherever they place episodes as props on the lot (rows, special spots, reel crate, seat-savers on the bales).

- **Background:** `…/nikepig-website-cartoons-art-src/barn-reels-4k.jpeg` (4096×2336, user-picked; README beside it). The same barn scene plus a scalloped fairy-light string across the top with **13 painted film reels** hanging from it. `process-art.py bg` encodes `cartoons/art/bg-{1280,1920,2560,3840}.webp` at the old filenames, so the main-site card background (`cartoons/art/bg-1280.webp`) picks it up unchanged.
- **Episodes are the reels.** Each reel gets an invisible round `<button class="reel">` hotspot, positioned from measurements. On hover, focus or while it is the current episode, it lights up with a warm ring and a soft radial glow, and shows the title tag below it, plus a "Premieres …" badge when the episode is coming soon. Coming-soon reels are dimmed slightly. The scene has no separate prop images any more.
- **Mapping:** newest first (premiere desc; on equal premieres a later catalogue entry counts as newer, because the catalogue is in release order — user decision 2026-09-27). The newest 13 episodes hang on the reels **left to right = newest to oldest** (c14 … c2), and older episodes are list-only. At launch that is 14 episodes, so the **pilot** is list-only.
- **Pilot tie-break:** pilot … c9 share the 1 Sept premiere; the later catalogue entry wins the tie, so the pilot (first in the catalogue) is the oldest and the only list-only episode at launch.
- **Direction markers (user decision 2026-09-27):** a **★ Latest** pill under the leftmost reel; a red **NEW** badge on the newest *released* reel (coming-soon reels to its left stay dimmed at `rgba(11,16,38,.5)`); an **Older ▸** button under the rightmost reel that opens the list. Min font sizes: NEW .62rem, Latest/Older .75rem. While the last reel is current, its title tag hangs where Older sits, so Older drops 2.7rem below the tag.
- **Archive:** the "All episodes" button and the skip link stay, and the list is the archive. The reel crate is gone, along with `crate.webp` and `placeholder-crate.svg`.
- **No per-episode props (user decision 2026-09-27, late).** Episodes are represented only by the painted reels and their YouTube thumbnails; `cartoons/props/` is gone (the 13 episode cut-outs, the `generic-1..12` seat-savers and `placeholder-car.svg`). `episodeImage(ep, now)` in `drivein-core.js` picks the picture: a **released** episode uses its YouTube thumbnail (`thumbUrl`, i.e. `i.ytimg.com/vi/<id>/hqdefault.jpg`, `object-fit: cover` in the list); a **coming-soon** episode uses the plain reel icon `art/reel.svg` (`REEL_IMAGE`) and makes **no request to YouTube before its premiere** (no spoilers), both in the list and on the screen's coming-soon card. Any thumbnail that fails to load (`onerror`) falls back to the reel icon. `process-art.py` keeps only the `bg` and `reels` steps.
- **Skip link:** first element of `<body>`, so it paints above the topbar and the screen when focused. On a phone the list dialog puts the date / premiere badge under the title (one `minmax(0,1fr)` column, nothing clipped at 375 px).
- **Measured layout** (`python tests/tools/process-art.py reels`, stored in `DEFAULT_LAYOUT` in `drivein-core.js`):
  - Barn board seam at y = 282 px (the dark line spans 280–284) = **12.072%**. **The screen's top edge sits exactly on it** in both formats, and its bottom on the wall bottom: **height (1442 − 282) / 2336 = 49.658%** of the scene (`--sh` / `--st` in the CSS; a unit test keeps them equal to `DEFAULT_LAYOUT.screen`).
  - Blank wall: x 878–3214 px (21.4–78.5%), bottom y = 1442 px (**61.73%**). The 9:16 screen and the 16:9 screen (**x 24.8–75.2%**) both fit inside it.
  - Reel centres (% of scene): (6.36, 8.55) (15.46, 8.76) (22.97, 8.77) (32.50, 8.76) (40.09, 8.74) (46.55, 8.75) (53.10, 8.71) (59.92, 8.69) (67.24, 8.72) (75.35, 8.38) (81.57, 8.62) (88.37, 10.28) (95.61, 8.43). The painted radius is 64 px, or 1.57% of the scene width, and the same for all 13. The hotspot is 1.1× that, about 50 px at 1440 wide. A `::before` pads the hit area to at least 44 px wherever the scene is drawn smaller (36 px on short landscape viewports, ≤ 500 px tall, where 44 px neighbours would overlap).
  - Every reel over the barn wall clears the seam. Reel 12 (x 88.4%) hangs over the sky, lower than the others: its bottom is at 13.0%, below the seam's height, but it is outside the wall and clear of the screen.
- **Stacking:** the lot and scene have no z-index (desktop and phones), so the hotspots (z 12) paint above the screen layer (z 10), and a title tag can overlap the screen's top edge. The Latest / Older markers are z 11; on the portrait layout they drop to z 9 (behind the screen) while a landscape episode is shown or a video plays.
- **Short viewports:** the scene reserves `--tb = max(0, 4.4rem − 6.1vh)` under the topbar, so the reel string never sits under the back link or the "All episodes" button. On short landscape (≤ 500 px tall, e.g. a phone on its side) the topbar is slimmer and `--tb = max(0, 2.6rem − 6.1vh)`, for a taller scene. The topbar title ignores pointer events. The back link and "All episodes" keep a compact look but a 44 px tap target (`::before`).
- **Watch on YouTube:** at least 32 px tall. Portrait episode on desktop: a pill beside the screen's top-right corner. Landscape episode (and every episode on short landscape): centred under the screen, clear of the last reel's tag and Older. Portrait layout (phones, portrait tablets): centred just under the screen, fixed with it (it does not scroll with the lot).
- **1024×768-ish screens:** the blurred fill above the scene fades to `--night`, so the spare band reads as sky.
- **Phones (portrait layout; user decision 2026-09-28, replaces the stacked sticky-screen layout):** applies to portrait viewports under 768 px and portrait viewports with aspect ≤ 4:5 (the CSS media query and `PORTRAIT` in the boot script). The **whole scene fills the viewport height** (`100svh`, under the translucent topbar as on desktop) at the art's aspect, so it is ~3.5× wider than the phone and the lot scrolls sideways (no scrollbar, no scroll snap). On short phones `--tb = max(0, 72px − 9.1svh)` trims the top so the reel hit areas clear the topbar's 44 px tap targets (0 at ≥ 792 px tall; 11 px on a 664 px iPhone 13 viewport). The **screen stays put**, centred horizontally in the viewport, with the **same vertical geometry as desktop** measured on the full-height scene: top on the seam (12.072%), bottom on the wall bottom (61.73%), 9:16 width from that height. A landscape episode is capped at `96vw` with its top still on the seam (height shrinks). The reels, title tags and markers scroll with the scene above the screen; the barn wall slides behind it. The idle screen lets swipes through to the lot (only the play button and the player take the pointer). **Initial scroll: the barn wall centred under the screen** (`scrollLeft = (scrollWidth − clientWidth) / 2`, re-applied when the viewport enters portrait); ★ Latest is a swipe to the left, Older to the right. `svh` and no vertical page scroll mean the URL bar never collapses, so nothing jumps. The screen title uses `text-wrap: balance`. There is no horizontal page scroll.
- **Tests:** unit tests pin 13 hotspots that don't overlap (at 1440 and on the smallest portrait phone scene, 320×568), all over-wall reels above the seam, none intersecting either screen footprint, hit areas ≥ 44 px at 1440, the `--st`/`--sh` CSS matching `DEFAULT_LAYOUT`, and the inline fallback matching `episodes.json`. The e2e z-order tests are replaced by a hotspot hit test at 6 widths; 667×375 checks non-overlapping 36 px hit areas. Portrait phones (375×812, 390×844, 412×915, touch): the scene fills the height, the screen top/bottom land within 1 px of the seam / wall bottom and keep their x while the lot scrolls, the reels move with it, ≥ 44 px non-overlapping hit areas never covered by the screen, touch swipes scroll the lot (not the page), the landscape screen fits the width. Premiere gating, coming soon, deep links, list search and the skip link keep their tests.
- **Catalogue fields:** required `id`, `title`, `youtube`, `format`, `premiere` (ISO datetime **with offset**, e.g. `+08:00`). **`prop` is optional** metadata (defaults to `car`; if present it must be `car`/`poster`/`snack`/`booth`) with no layout effect, so a new entry without it never breaks the page. **`image` and `alt` are no longer used:** old entries that still carry them validate fine and the fields are dropped (they described the deleted prop art).
- **Premiere gating is client-side only.** The coming-soon state compares `premiere` with the visitor's clock, so it hides the player, not the video: anyone with the YouTube id (it is in `episodes.json`) can watch early. Schedule the premiere on YouTube too (or keep the video private/unlisted until then). A timer at the next premiere rebuilds the reels (the NEW badge moves) and re-renders the screen only when the current episode's coming-soon status changed, so a playing video is never restarted.
- **Keyboard:** after the Play button, focus stays on `#screen` (not inside the cross-origin iframe), so Esc still stops playback.

## Revision 2 (2026-09-27): barn cinema and scaling — supersedes conflicting text below

Both changes were approved by the user in chat on 2026-09-27. Where this section and the original text disagree, this section wins. Internal names (`DriveIn`, `drivein-core.js`, `drivein.spec.js`, this file's name) stay unchanged.

### Scene: Bison Valley Ranch barn movie night (replaces the drive-in)

- **Why:** the user rejected the empty drive-in tarmac ("if we aren't filling it up with cars then the foreground will feel so empty") and chose a ranch movie night with the episodes still as props.
- **Screen:** the episode is projected onto the big red barn's flat front wall. The screen overlay reads as the projection, so there is **no screen-frame art**; `.screen` gets a soft projector glow instead.
- **Chosen background:** `C:/Users/loopy/Nikeverse-cartoons/outputs/nikepig-website-cartoons-art-src/barn-cinema-bg-B-0936-4k-gflegs.jpeg` (4096×2336; notes in the README beside it).
  - Made in Tripo Studio (web app) with GPT Image 2.5, 16:9, 4K. The four cast sheets from the Meme Machine were attached as Figures 1–4 (Nike, GF Princess, Charles, Poppy), in the Meme Machine's own output style.
  - The four cast members are painted into the scene, one of each: GF Princess at the snack stand (left), Poppy (centre-left), Nike (centre-right), Charles at the projector shed (right). GF Princess's legs were redrawn to her sheet.
  - The blank barn wall covers roughly x 21–79% and y 0–62% of the frame, which holds both screen footprints.
  - **Accepted by the user as-is:** Nike and GF Princess hands show 3–4 fingers; Nike wears sunglasses; the signs carry text (SNACKS, a chalkboard, CARTOON NIGHT TONIGHT!).
- **Prop keys are unchanged and reinterpreted:** `poster` = notice board, `snack` = snack stand, `booth` = projector shed, `car` = a ranch prop sitting on the hay bales. Validation, the unit tests, placeholder filenames and the `onerror` fallback keep working.
- **Prop concepts** in the catalogue table below are re-conceived as ranch objects (not cars) at art time; the user picks. Special-spot plan: pilot and C2 on the notice boards, C13 "Hugs 4 Chips" at the snack stand, C9 at the projector shed.
- **Row props must not cover the painted characters.** Task 12 measures the row slots around them.
- **Copy:** "drive-in" wording on the page and the main-site card becomes barn / ranch movie-night wording, and all 14 `alt` strings are rewritten.

### Scaling to hundreds of episodes (multi-reviewer consensus)

Clicking stays easy because props never shrink. The risks were finding an episode, a sideways lot about 25 screens wide per year, hundreds of tab stops, and one bespoke prop per episode. So:

1. **Newest first.** Row props are laid out newest-first (by `premiere`, then catalogue order), so the latest episodes are on the first screen. `episodes.json` stays in chronological order; the engine sorts. **Special spots do not churn:** they are still filled in catalogue order (oldest first), so pilot and C2 keep the notice boards.
2. **Capped lot.** At most `LOT_SIZE` = 12 row props (one base scene). **No extension segments and no `lot-extension` art.** Older episodes are archive-only. (This replaces "Overflow … There is no episode cap" in Units 2.)
3. **Archive.** When any episode is archive-only, a "reel crate" prop sits on the lot. It and an always-visible **"All episodes"** button open a native `<dialog>` holding an `<input type="search">` and a newest-first list of buttons (thumbnail = prop image or the generic reel icon, title, date, "Premieres …" badge if not yet public). Choosing one selects it on the screen (preview, then play, as with a prop). If it has a prop on the lot, the lot scrolls it into view (`scrollIntoView({inline:'center'})`) and focus moves to it; otherwise focus returns to the screen.
4. **Prop art is optional (option C, user choice 2026-09-27).** `image` may be omitted. An episode with no art borrows a **generic seat-saver** prop (picnic blanket, cooler, lantern, cowboy hat, popcorn bucket, thermos, pillow, denim jacket, picnic basket, boots, guitar, pitchfork — `props/generic-<n>.webp`, drawn in the barn style), chosen deterministically from its id so it never changes between visits. The reel icon remains the final fallback if an image fails to load. A new episode can ship with only its `episodes.json` entry. Framing: props on the hay bales read as "saving a seat"; small props sit on a bale, large ones stand beside it.
5. **Deep links.** `#ep=<id>` selects that episode on load and on `hashchange` (preview state; autoplay isn't attempted without a user gesture). Selecting an episode updates the hash with `history.replaceState`.
6. **Skip link.** A "Skip to all episodes" link at the start of the prop group opens the list.
7. **Stacking fix (bug found in review).** Every prop has `z-index:1`, so a back-row prop's hit box can cover the top of the middle-row prop in front of it. Give each row its own z-index, front row highest; hover/focus/current still lift to the top.
8. **Later:** seasons become filters in the list, not extra scene segments.

## Goal

nikepig.com gets a dedicated **Nikeverse Cartoons** page. It is an illustrated **night-time drive-in cinema**: every episode is an interactive prop in the scene (a car, poster board, snack-bar item or projector-booth window). Hovering over a prop, or tapping it on a touch screen, shows that episode on the drive-in's big screen. A click or a second tap plays the YouTube video embedded right there. Adding a new episode takes one prop image plus one data entry, with no layout work.

## User decisions

- Scene: drive-in cinema at night.
- Playback: on the big drive-in screen, not in a pop-up.
- Launch catalogue: every episode. Episodes not yet public show "Coming soon" until their premiere time.
- Props: a mix of cars, poster boards, snack-bar items and projector-booth items.
- Layout: automatic row-by-row lot (approach A).
- Screen: shape-shifting. It is 9:16 for Shorts and widens to 16:9 for the two landscape episodes (Pilot and C2).
- Art: generated with the user's **Tripo Studio web app** (studio.tripo3d.ai, GPT Image 2.5, 4K) at build time, with the user choosing between variations. Nothing is generated before the build.
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
   - **Overflow** *(superseded by Revision 2: the lot is capped at 12 row props; older episodes go to the archive list)*: when the rows are full, one repeating `lot-extension.webp` segment is added to the right and filling continues there. The scene then scrolls horizontally. There is no episode cap.
   - **Coordinates:** positions are percentages of the **base-scene width and height**. Each `lot-extension` segment is exactly one base-scene width, so segment *n* adds *n* × 100% to x.
   - **Row capacities per base scene:** back row 5, middle row 4, front row 3 (12 cars). Extension segments hold 12 cars each in the same rows.
   - **Anchor measurement:** the special-spot coordinates, row baselines and scales are **measured from the generated background** and stored in one layout constant. *(As built: it lives as `DEFAULT_LAYOUT` in `cartoons/drivein-core.js`, next to the pure `layoutProps` engine, so unit tests can check it; the current values are placeholder geometry that keeps the special spots outside the landscape screen footprint.)*
3. **Screen**:
   - It is an overlaid element (a content box; *Revision 2: no frame art, a soft projector glow instead*), not part of the background painting. The painting leaves a blank screen-support area.
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
- **Keyboard:** Tab moves through the props in display order (*Revision 2: specials, then row props newest-first; the skip link and the "All episodes" list come first*), Enter or Space plays, and Esc stops the video.
- Only one iframe exists at a time. Switching removes the old iframe, which stops its audio.

**Clarifications (spec review 2):**
- **Coming soon:** a coming-soon prop's click, tap or Enter only shows its "Premieres" card. It never creates an iframe, and the "Watch on YouTube" link is hidden until the premiere.
- **Screen on wide lots:** when extension segments make the scene scroll sideways on desktop, the screen stays pinned (`position: sticky`) at the left of the viewport, so it never scrolls away.
- **Tap targets:** each prop `<button>` has a minimum hit area of 44×44 px. It's padded around the image on small back-row props; the art itself is never enlarged.
- **C9:** uses the corrected upload `3mm3QSeXjo8`. Editing an existing entry is a one-line `episodes.json` change.
- **Stale doc:** fix the stale `CLAUDE.md` line that says the `#nft` grid is JS-rendered (it's static markup) during the docs step.

## Mobile (portrait, under 768 px)

*(Superseded: see "Phones (portrait layout)" in Revision 3 — the full-height scene scrolls sideways behind a fixed screen. Landscape phones use the desktop layout.)*

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
- **Thumbnail fails:** *(As built, Revision 3, props dropped)* fall back to the reel icon `art/reel.svg`, on the screen and in the list. Coming-soon episodes show the reel icon without asking YouTube at all. The title is on the reel's tag and `aria-label`.
- **Embed blocked** (for example by a privacy extension): this can't be detected reliably, so the always-visible "Watch on YouTube" link covers it (`https://youtube.com/shorts/<id>`, or `watch?v=` for landscape episodes).
- `prefers-reduced-motion` turns off the reel glow, tag and screen-resize transitions; the screen snaps instead.

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

*(Revision 3, props dropped: no art is needed. The entry plus `npm run sync` is the whole job.)*

1. Append one entry to `cartoons/episodes.json`: `id`, `title`, `youtube`, `format`, `premiere` as ISO with its offset (e.g. `"2026-10-02T01:00:00+08:00"`). `prop` is optional; no `image` or `alt`.
2. `cd tests && npm run sync` (copies the catalogue into the inline fallback), then `npm run unit && npx playwright test`.
3. Schedule the premiere on YouTube too (gating on the page is client-side only).
4. Commit, and merge when the user approves. The newest 13 episodes hang on the reels; the oldest drops to the list. The list shows the YouTube thumbnail once the episode premieres, the reel icon before.

## Out of scope

- A CMS or upload UI.
- View counts or likes.
- Any non-YouTube platforms.
- Sound design for the page.
