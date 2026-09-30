# branch-log.md — $NIKEPIG website per-change narrative

> Grep-on-demand history. **NOT auto-loaded** (don't `@`-import it into `CLAUDE.md`).
> Append the per-change story here; keep `CLAUDE.md` to durable architecture only.
> Newest entries at the top.

---

## 2026-09-28 — Cartoons phone layout: full-height scene behind a fixed screen
- Portrait phones/tablets: the stacked sticky-screen layout is gone; the whole barn scene fills the viewport height and scrolls sideways (starting with the barn wall centred) behind a screen that stays centred with its top on the seam and bottom on the wall bottom (spec Revision 3, "Phones (portrait layout)"); new portrait e2e tests at 375/390/412.

---

## 2026-09-27 — Nikeverse Cartoons page (`cartoons/`): barn movie night on 13 painted reels

**What shipped:** a separate static page, `nikepig.com/cartoons/` (`cartoons/index.html` + pure logic in
`cartoons/drivein-core.js` + `cartoons/episodes.json`). Spec:
`docs/superpowers/specs/2026-09-26-nikeverse-cartoons-drive-in-design.md` (**Revision 3** at the top is current);
plan: `docs/superpowers/plans/2026-09-26-nikeverse-cartoons-drive-in.md`.

- **Scene:** movie night at the $NIKEPIG barn on Bison Valley Ranch (the original drive-in lot was dropped: too
  empty without cars). One painted background (`barn-reels-4k.jpeg`, Tripo Studio / GPT Image 2.5, 4096×2336) served
  as `cartoons/art/bg-{1280,1920,2560,3840}.webp` via `image-set()`. The cast is painted in; no prop cut-outs on the lot.
- **Episodes are the 13 film reels** hanging from the fairy lights: invisible round `<button class="reel">` hotspots
  measured from the art (`python tests/tools/process-art.py reels` → `DEFAULT_LAYOUT`). The **newest 13** (premiere
  desc; on equal premieres the later catalogue entry is newer) hang **left to right = newest to oldest**; older episodes
  are list-only (at launch: the pilot). Hover/focus previews, click plays; touch = tap to preview, tap again to play.
- **Markers:** ★ Latest under the leftmost reel, a red NEW badge on the newest released reel, Older ▸ under the
  rightmost reel (opens the list; it drops below the last reel's title tag while that reel is current).
- **Screen:** projected on the barn wall, top edge on the board seam (y 282) and bottom on the wall bottom (y 1442):
  height 49.658% of the scene; 9:16 for Shorts, 16:9 (x 24.8–75.2%) for the pilot and C2. YouTube-nocookie embed;
  "Watch on YouTube" beside the portrait screen, centred under a landscape one.
- **Archive:** "All episodes" dialog (search, newest first, premiere badges, YouTube thumbnails once released, the
  reel icon while coming soon or on error). Skip link first in `<body>`. Deep links `#ep=<id>` (replaceState, no history spam).
- **Premiere gating is client-side** (`premiere` vs the visitor clock) — schedule on YouTube too. A timer at each
  premiere rebuilds the reels without restarting a playing video.
- **Phones:** stacked layout — sticky screen on a close-up of the real barn wall (projector spill, vignette), the whole
  scene below at ≥ 410 px scrolling sideways (newest left); the sticky area shrinks for landscape episodes. Short
  landscape (≤ 500 px tall) gets a taller scene and 36 px non-overlapping reel hit areas. 44 px topbar tap targets.
- **Main site:** "Cartoons" nav link; a Nikeverse Cartoons card in the static `#nft` grid (barn background + the
  NIKEVERSE CARTOONS die-cut sticker, `assets/art/title-cartoons.webp`, obeying the `.verse-title-img` cap); the nav
  drawer now takes over at ≤ 1280 px (12 links no longer fit), the grid centres its trailing cards, and the drawer
  toggle is a real `<button aria-label="Menu" aria-expanded>`.
- **Catalogue:** 14 episodes (pilot … c14), the corrected re-uploads (C3–C9 public; C10–C12 unlisted until premiere).
  `prop` is optional. **Props dropped (user, 2026-09-27 late):** `cartoons/props/` deleted (~422 KB), `image`/`alt`
  removed from the catalogue (ignored if present); the reel icon is now `cartoons/art/reel.svg`.
- **Tests** (`tests/`, Playwright 1.56.1 pinned): `cd tests && npm run unit && node tools/sync-fallback.js --check &&
  npx playwright test` — 28 unit (incl. an inline-fallback drift check) + 87 e2e (74 cartoons, 13 main site), 0 `pageerror`.
- **Add an episode:** append to `cartoons/episodes.json` (`id`, `title`, `youtube`, `format`, `premiere` ISO with
  `+08:00`), then `cd tests && npm run sync`. No art needed.

---

## 2026-06 — Nikeverse card sticker-title logos (the "varied sticker fonts" pass)

**Ask:** every Nikeverse product card (except the Shards-of-Nike comic card, which has its own
logo) should use a varied die-cut **sticker-font title logo** in the same art/font style as the
stat cards — "highly varied colours + font choices matching the product type so each card grabs
attention," with the title centred and placed into the card like the Shards comic card's title.

**Built:** 9 AI-generated die-cut sticker title logos (transparent WebP, alpha, 760px
wide), one per product, replacing the old `<div class="verse-title">` text with
`<img class="verse-title-img">`. Slugs + intrinsic dims:
`title-meme-machine` 760×455 · `title-nike-rocket` 760×494 · `title-pfp-nfts` 760×432 ·
`title-oinkening` 760×391 · `title-charles-ranch` 760×490 · `title-posting` 760×286 ·
`title-greased` 760×357 · `title-rwa` 760×410 · `title-dimensional` 760×459. Colour/font per
product theme (rocket = chrome/flame, ranch = western wood, posting = clean social, etc.).
Dimensional cutout needed a re-import to confirm the asset after the background-removal step
rejected the raw job.

**Shards resize:** the existing `shards-logo.png` (2000×811) was sized up to match the other
card logos (it was rendering small).

**QC pass (AI reviewer wave → orchestrator fixes, commit `ee8df47`):**
- `.verse-title-img` capped at `max-height:115px` (+ `width:auto;max-width:80%`) so the varied
  intrinsic aspect ratios render at uniform visual weight across the grid.
- Removed the dead `.verse-title` CSS rules (desktop + mobile) left over from the text titles.
- **Reviewer B catch:** the Shards desktop resize hadn't fixed mobile — a leftover mobile
  `.verse-card img[alt="The Shards of Nike"]{width:180px!important}` override was shrinking it on
  phones. Removed it → Shards now matches its neighbours on mobile too.
- Verified (Playwright): dead rules = 0, Shards override = 0, `max-height:115px` present; desktop
  logo heights 80–115px, mobile 91–115px, Shards mobile width 243px (matches neighbours), 0 errors.

Commits: `4dd6a33` (the 9 logos) · `e4d2113` (Shards resize) · `ee8df47` (QC fixes).

---

## 2026-06 — Stat cards redesigned as Battlegrounds-style sticker tiles + mobile bg + Comic 7

**Stat cards (tokenomics, `#stats`):** the previous "epic graphics" cards (`e484026`) were
unreadable. Redesigned in the posting-card-battler **"Battlegrounds poster" die-cut sticker
style**: full-bleed borderless 1024×1024 WebP per card, **no pig** (too many non-Nike pigs), each
card a **single standardized font colour** (different per card), **centred/symmetric** composition.
Accepted set: `$38M` peak market cap (magenta/yellow) · `0%` creator allocation (cyan/white, the
"big centred badge" gen `4625312b`) · `0` inflation (violet/lime) · `100%` community (orange/cyan).
Generated borderless then cropped on canvas (earlier gold-rim gens had uneven borders). The
the image-model reference-image upload host is **blocked by the org egress proxy** (403 CONNECT) —
used a detailed style prompt instead of attaching a reference.

CSS: `.stats .stat-card{padding:0;background:none;border:none;backdrop-filter:none;overflow:hidden;
border-radius:20px;aspect-ratio:1/1}` + `.stat-graphic{width:100%;height:100%;object-fit:cover}`.

**Mobile background:** use the desktop ranch bg on mobile without the iOS Safari `cover`-stretch
bug and without the URL-bar "breathing zoom" on scroll. Fix = `body::before{position:fixed;
height:100vh;height:100lvh}` painting a dedicated WebP variant (`bg-16x9-mobile.webp`, 73KB) under
`@media(max-width:768px)`; stable `100lvh` (NOT dynamic vh / `inset:0`) kills the scroll-zoom.
Added 3 `<head>` preloads (mobile bg / desktop bg / comic cover) with `fetchpriority`/`media`.
Deleted orphaned `bg-16x9.png` + stat-icon PNGs.

**Comic 7 first-paint:** the large manga cover wouldn't show on first load on Safari mobile (needed
a refresh) while the other covers did. Root cause = WebKit "decode-while-`opacity:0`, never repaint"
bug for large images inside opacity:0 reveals. Bulletproof fix (`ea957ce`) = **remove Comic 7 from
the `.reveal` system entirely** (always `opacity:1`, `loading="eager"`); reverted the
translateZ/backface/`.repaint` experiments.

Commits: `e484026` (first epic-graphics attempt) · `1ebaf32` (sticker redesign + mobile bg +
Comic 7 harden) · `ea957ce` (Comic 7 out of reveal).

---

## Reveal-on-scroll robustness (the iOS decode gotcha)

`IntersectionObserver` toggles `.reveal` → `.reveal.active` (`{threshold:0.08,rootMargin:'0px 0px
-30px 0px'}`). To dodge the WebKit "image decoded while `opacity:0` never repaints" bug, after
observing, every `.reveal` img gets a `reassert()` (`load` once / `complete`) that re-sets
`opacity:1` when its card is active, plus a 2500ms safety sweep. The single biggest offender (the
full-size Comic 7 manga cover) is kept **out of the reveal system** rather than patched.

---

## Remove AscendEX CEX (delisted / exchange shut down)

AscendEX (the site's only centralized-exchange listing) closed down, so its buy-step card was
removed from the **How to Buy** (`#buy`) section. Change was run through the full multi-agent
workflow (2-lens brainstorm → single builder on `index.html` → 2-lens review → orchestrator QC +
Playwright).

- Deleted the entire 3rd `.buy-step` card (step-number "3", `ascendex-logo.png`, "CEX listing"
  copy, `ascendex.com` link). Eternl (1) + Vespr (2) remain.
- The `.buy-steps` grid uses an **inline** `grid-template-columns` that overrides the base
  `auto-fit` rule, so the columns had to be edited inline: `repeat(3,1fr);max-width:900px` →
  `repeat(2,1fr);max-width:640px` — keeps the two remaining cards centered at their original
  per-card width instead of stretching. Mobile `@media(max-width:768px)` already forces a single
  column, so no mobile edit was needed.
- Deleted the now-orphaned `assets/art/ascendex-logo.png` asset.
- Verified: repo-wide `grep -rni ascend` on tracked content is clean; Playwright shows 2 cards,
  2 equal columns on desktop, 1 column at 375px, 0 page errors (the 2 console lines are external
  font fetches failing under `file://`, unrelated).

## 2026-09-29 — Cartoons social share card
- `cartoons/art/og-cartoons.jpg` (1200x630): the barn scene with the Nikeverse Cartoons title sticker only
  (owner: no "every night" promise and no URL on the image). `cartoons/index.html` gets Open Graph + Twitter
  `summary_large_image` tags pointing at it (absolute https URL).
- Same day: C15/C16 catalogue entries; Massive Rocket card kept but its Sign Up button removed; Instagram,
  Facebook, TikTok and YouTube links (Simple Icons glyphs) added to the hero row and Join the Herd.
- Homepage share card: `assets/art/og-nikepig.jpg` (1200x630) = Charles's Jun 18 2024 "Fun Fact: I have a pig named
  Nike" tweet screenshot (`assets/tweets/tweet-01-jun18-fun-fact.png`) centred over a blurred Nike photo; Open Graph + Twitter tags added to `index.html`.

- 2026-09-30: Cartoons: add C17 "Blind Spot" (YouTube aI1yZ3pTKcQ, premieres 4 Oct 2026 01:00 SGT); fallback synced; unit + 99 e2e pass.
