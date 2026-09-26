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
  episodes.json     the episode catalogue (the only file edited per upload)
  art/              bg-4k source, bg-desktop.webp, bg-mobile.webp, lot-extension.webp, screen-frame.webp
  props/            one WebP cutout (alpha) per episode
```

Main site (`index.html`) changes:
- A **"Cartoons"** link in `#navbar`, pointing to `cartoons/`.
- A **Nikeverse Cartoons** card in the `#nft` Nikeverse grid, with a sticker title logo (`assets/art/title-cartoons.webp`) that follows the existing `.verse-title-img` rules.
- Nothing else on the main page changes.

## Units

1. **Catalogue (`episodes.json`)**: an array of episodes in display order. Fields:
   `id` (e.g. `"c14"`), `title`, `youtube` (11-char ID), `format` (`"portrait"` | `"landscape"`), `premiere` (ISO datetime with offset), `prop` (`"car"` | `"poster"` | `"snack"` | `"booth"`), `image` (path under `props/`), `alt` (short description).
2. **Layout engine**: a pure function from the catalogue plus viewport size to a position and scale for each prop.
   - **Special spots:** poster board ×2, snack counter ×1 and booth window ×1 are fixed anchor points in the art, each with its own coordinates. They are filled in catalogue order. If a special prop has no free spot, it falls back to a car row.
   - **Car rows:** three perspective rows. The back row is smallest and highest; the front row is largest and lowest. Rows fill left to right, starting with the front row.
   - **Overflow:** when the rows are full, one repeating `lot-extension.webp` segment is added to the right and filling continues there. The scene then scrolls horizontally. There is no episode cap.
   - Positions are percentages of the scene, so the layout scales with the viewport.
3. **Screen**:
   - It is an overlaid element (frame art plus a content box), not part of the background painting. The painting leaves a blank screen-support area.
   - It animates between 9:16 and 16:9 according to the selected episode's `format`.
   - **Idle:** a "Now showing: Nikeverse" title card.
   - **Preview:** the thumbnail (`https://i.ytimg.com/vi/<id>/hqdefault.jpg`), the title and a play button.
   - **Playing:** an iframe from `https://www.youtube-nocookie.com/embed/<id>?autoplay=1&playsinline=1&rel=0`.
   - **Coming soon:** a "Premieres <date>" card with no player.
4. **Props**:
   - Each prop is a `<button>` holding the prop image, with `aria-label` "Play <title>" or "<title>, premieres <date>".
   - Hover or focus lifts and glows the prop and shows a small title tag.
   - Props before their premiere are dimmed and carry a "Premieres" tag.
   - The public/coming-soon state is computed on each page load from `premiere` against the current time, so no edit is needed at premiere.

## Interaction

- **Desktop:** hover or focus previews on the screen. A click plays. Hovering over another prop stops the current embed and previews the new one. Leaving all props keeps the last preview.
- **Touch:** the first tap previews and the second tap on the same prop plays. Tapping another prop switches the preview.
- **Keyboard:** Tab moves through the props in catalogue order, Enter or Space plays, and Esc stops the video.
- Only one iframe exists at a time. Switching removes the old iframe, which stops its audio.

## Mobile (portrait, under 768 px)

- The screen is sticky at the top of the viewport and takes about 45% of its height.
- The lot sits below it as a horizontally scrollable strip with scroll snap.
- Props have a tap target of at least 44 px.
- `bg-mobile.webp` is a crop of the 4K source.

## Art pipeline (at build time)

- **Background:** one 4K generation in Tripo3D (GPT Image 2.5). It shows a night drive-in in the Nikeverse Meme Machine 2D cartoon style (bold outlines, painted, vivid, no text): a starry sky over ranch hills, an **empty** lot with three row lines, the snack bar (left), the projector booth (right), two empty poster boards, and a blank area where the screen frame sits.
- **Derived art:** the desktop WebP, the mobile crop, and a seamlessly tiling `lot-extension.webp` strip, cut from or generated to match the background.
- **Screen frame:** a separate cutout: the tall screen frame and its support.
- **Props:** one cutout per episode, in the same style with a transparent background, hinting at the story. Examples:
  - C14: a pickup with a daisy on the antenna.
  - C11: a car with a coat rack on its roof.
  - C13: a snack-counter "4 chips" sign.
  - Pilot: a poster board with the apple-chip ledger.
- **Characters** in props must match the canonical sheets (Nike: stump legs, innocent expression).
- **Encoding:** WebP. The desktop background should be ≤ 600 KB and each prop ≤ 120 KB where possible.

## Launch catalogue

| # | id | Title | YouTube | Format | Premiere (+08:00) |
|---|---|---|---|---|---|
| 1 | pilot | The Apple Chip Ledger | KCV8nHowlpo | landscape | public |
| 2 | c2 | Do Your Cutest Thing | NR6ogdyPKVI | landscape | public |
| 3 | c3 | 45-Minute Diner Wait | 9mZ-7DSqlhw | portrait | public |
| 4 | c4 | Apple Chip Intervention | g3YqccJJMhM | portrait | public |
| 5 | c5 | Time for chores! | O1ketGJn30k | portrait | public |
| 6 | c6 | Moral Support | UFt6lYeoTn8 | portrait | public |
| 7 | c7 | Father-in-Law Chat | TVqPTvtZ06U | portrait | public |
| 8 | c8 | The 6 AM Negotiation | vpWMmHa_ups | portrait | public |
| 9 | c9 | The Void | Pu5IT4YgGqg | portrait | public |
| 10 | c10 | Order in the Yard | rlubzu5TNZ8 | portrait | 2026-09-27T01:00 |
| 11 | c11 | The Coat Rack | R1lDhWt_96g | portrait | 2026-09-28T01:00 |
| 12 | c12 | Low-Maintenance | F7CV6N0rygE | portrait | 2026-09-29T01:00 |
| 13 | c13 | Worth It | vIue1jLRDuw | portrait | 2026-09-30T01:00 |
| 14 | c14 | Forever Hungry | 4COtDWxmMLQ | portrait | 2026-10-01T01:00 |

The IDs were read from YouTube Studio on 2026-09-26. Episodes marked "public" get `premiere` set to their actual publish date.

## Error handling

- **Catalogue fails to load:** the lot shows "Episodes are warming up, try again" and the screen stays on the idle card.
- **Thumbnail fails:** fall back to the prop image on the screen.
- **Missing prop image:** show a generic car silhouette labelled with the title.
- **Embed blocked** (for example by a privacy extension): the screen shows a "Watch on YouTube" link to `https://youtube.com/shorts/<id>`, or `watch?v=` for landscape episodes.
- `prefers-reduced-motion` turns off the prop lift and screen-resize animations; the screen snaps instead.

## Testing

- Headless browser (Playwright) at 375, 768, 1440 and 2560 px, and at `deviceScaleFactor` 2.
- The page must produce zero `pageerror` events.
- The layout engine must place props without overlap using the launch catalogue and synthetic catalogues of 5 and 30 entries.
- The screen must switch between 9:16 and 16:9 correctly.
- Freeze the clock before and after a premiere to check that the coming-soon state flips.
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
