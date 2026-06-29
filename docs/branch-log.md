# branch-log.md — $NIKEPIG website per-change narrative

> Grep-on-demand history. **NOT auto-loaded** (don't `@`-import it into `CLAUDE.md`).
> Append the per-change story here; keep `CLAUDE.md` to durable architecture only.
> Newest entries at the top.

---

## 2026-06 — Nikeverse card sticker-title logos (the "varied sticker fonts" pass)

**Ask:** every Nikeverse product card (except the Shards-of-Nike comic card, which has its own
logo) should use a varied die-cut **sticker-font title logo** in the same art/font style as the
stat cards — "highly varied colours + font choices matching the product type so each card grabs
attention," with the title centred and placed into the card like the Shards comic card's title.

**Built:** 9 Higgsfield GPT-Image-2 die-cut sticker title logos (transparent WebP, alpha, 760px
wide), one per product, replacing the old `<div class="verse-title">` text with
`<img class="verse-title-img">`. Slugs + intrinsic dims:
`title-meme-machine` 760×455 · `title-nike-rocket` 760×494 · `title-pfp-nfts` 760×432 ·
`title-oinkening` 760×391 · `title-charles-ranch` 760×490 · `title-posting` 760×286 ·
`title-greased` 760×357 · `title-rwa` 760×410 · `title-dimensional` 760×459. Colour/font per
product theme (rocket = chrome/flame, ranch = western wood, posting = clean social, etc.).
Dimensional cutout used `media_import_url` to confirm a `media_id` after `remove_background`
rejected the raw `job_id`.

**Shards resize:** the existing `shards-logo.png` (2000×811) was sized up to match the other
card logos (it was rendering small).

**QC pass (Opus reviewer wave → orchestrator fixes, commit `ee8df47`):**
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
`upload.higgsfield.ai` reference-image host is **blocked by the org egress proxy** (403 CONNECT) —
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
