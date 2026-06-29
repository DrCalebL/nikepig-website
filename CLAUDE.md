# CLAUDE.md — $NIKEPIG website (`nikepig.com`)

## Doc map + maintenance protocol (read first)
This file is auto-loaded every session — keep it **lean**: durable architecture, invariants, and
gotchas only. History lives elsewhere.
- **`CLAUDE.md`** (this file) — durable architecture + load-bearing invariants. Keep it short.
- **`docs/branch-log.md`** (grep-on-demand, **NOT** auto-loaded) — the per-change narrative. Append
  there, never here. Do **not** `@`-import it (that re-pays the context cost this split removes).
- **`README.md`** — human-facing deploy guide (GitHub Pages + Namecheap DNS).

**Per shipped change:** append the story to `docs/branch-log.md`; update `CLAUDE.md` only if a
*durable architectural fact* changed; commit + push on the designated dev branch.

## What this is
The official marketing site for **$NIKEPIG — the OG Pig of Cardano** (a crypto/memecoin token
project). A **self-contained static single page** — no framework, no build step, no deps. The
**entire site is one `index.html`** (~770 lines: inline `<style>` + inline `<script>`). Deployed
on **GitHub Pages** → `nikepig.com` (apex; committed `CNAME` = `www.nikepig.com`, A-records to
GitHub Pages IPs). **Pushing `main` publishes** — there is no CI/build.

> NOTE: this is the crypto-project site and is **deliberately separate** from `goodpig.xyz` /
> the Good-Pig-Studio (Paddle Merchant-of-Record) game surfaces, which must carry NO crypto
> signal. Crypto branding (ticker, contract address, wallet/DEX links) belongs HERE and must
> never leak into those game repos. (The dev-branch name `paddle-payments-setup-…` is incidental;
> this repo does not host Paddle.)

## Layout (`index.html` sections, in order)
`#navbar` → `#hero` (Nike-the-pig art + contract address + COPY button) → `#about` →
`#shards-comic` (the "Shards of Nike" art gallery / comic covers) → `#nft` (the **Nikeverse**
product-card grid, JS-rendered into `#nikeverse-cards`) → `#memes` → `#gifs` (GIF vault) →
`#buy` (how-to-buy) → `#charts` (exchanges) → `#staking` → `#community` → `#footer`.

## Assets (`assets/`)
- `assets/art/` — hero/comic/stat/title art (PNG/JPG/WebP). Stat sticker tiles
  `stat-{marketcap,allocation,inflation,supply}.webp`; Nikeverse card title logos
  `title-<slug>.webp` (9, alpha, 760px wide) + `shards-logo.png`; backgrounds
  `bg-16x9.webp` (desktop) + `bg-16x9-mobile.webp`; `comic-cover-manga.webp`.
- `assets/memes/`, `assets/gifs/`, `assets/tweets/` — community content.
- **Reference art paths from `index.html` with `assets/...` relative URLs** (GitHub Pages serves
  from repo root). When you replace art, regenerate at the **same filename** so the markup is stable.

## Invariants (READ before editing)
- **Background = a fixed `body::before` layer, NOT `background-attachment:fixed`.** iOS Safari
  stretches `attachment:fixed`+`cover`. The bg is `body::before{position:fixed;top:0;left:0;
  width:100%;height:100vh;height:100lvh;z-index:-1;background:... url(bg-16x9.webp) center/cover}`.
  **Use stable `100lvh`** (the `100vh` line is the fallback) — do NOT switch to dynamic `vh` /
  `inset:0`, which reintroduces the mobile URL-bar "breathing zoom" on scroll. A
  `@media(max-width:768px)` rule swaps in `bg-16x9-mobile.webp`. After `rasterize`-style screen
  toggles, never leave a transform on `body`/a fixed ancestor (it would make `position:fixed`
  layers resolve against it).
- **Reveal-on-scroll + the iOS decode gotcha.** `.reveal{opacity:0}` → `.reveal.active{opacity:1}`
  via `IntersectionObserver` (`threshold:0.08`, `rootMargin:'0px 0px -30px 0px'`). WebKit can
  **decode an image while `opacity:0` and then never repaint it** → blank-until-refresh on iOS.
  Mitigation in the reveal JS: each `.reveal` img gets a `reassert()` (on `load`/`complete`) that
  re-sets `opacity:1` once its card is active, plus a 2500ms safety sweep. **The big Comic 7 manga
  cover is kept ENTIRELY OUT of the reveal system** (always `opacity:1`, `loading="eager"`) — the
  bulletproof fix. Any new large above-the-fold-ish image that must paint on first load should do
  the same rather than rely on the reveal.
- **Stat cards = full-bleed sticker tiles.** Posting-card-battler "Battlegrounds poster" die-cut
  sticker style: borderless 1024×1024 WebP per card, **one standardized font colour per card**
  (different across cards), centred composition, **no pig**. CSS:
  `.stats .stat-card{padding:0;background:none;border:none;backdrop-filter:none;overflow:hidden;
  aspect-ratio:1/1}` + `.stat-graphic{width:100%;height:100%;object-fit:cover}`.
- **Nikeverse card titles = `.verse-title-img` sticker logos.** Each product card uses an `<img
  class="verse-title-img">` (a die-cut sticker-font logo, varied colour/font per product) instead
  of text. The capping rule is **load-bearing for uniform weight across varied aspect ratios**:
  `.verse-title-img{display:block;width:auto;max-width:80%;max-height:115px;height:auto;
  margin:0.2rem auto 1rem;filter:drop-shadow(0 3px 8px rgba(0,0,0,.5))}`. The Shards-of-Nike comic
  card keeps its own `shards-logo.png` (don't give it a generated title). When sizing Shards, fix
  **both** desktop and mobile — a stray mobile `width:…!important` override silently wins on phones.
- **No build step / single file.** All CSS + JS are inline in `index.html`. Terse style. Palette:
  Bison-Valley-Ranch CSS vars (`--wheat/--sunset/--purple/--navy`…); fonts 'More Sugar' (display) +
  'Nunito' (body) via Google Fonts `<link>`. Section bg classes (`sunset-section`/`wheat-section`/
  `navy-section`) are translucent over the fixed ranch bg.

## Sticker-art pipeline (Higgsfield)
Title/stat logos are **Higgsfield GPT-Image-2** (`gpt_image_2`) generations → `remove_background`
for cutouts → re-encoded to **WebP with alpha** (`sharp` at `/tmp/imgtools/node_modules/sharp`).
Gotchas: **`upload.higgsfield.ai` is blocked by the org egress proxy (403 CONNECT)** — you cannot
attach a reference image; use a detailed style prompt instead (or `media_import_url` to confirm a
`media_id` when a `job_id` is rejected, e.g. after `remove_background`). Generation is capped at
**8 concurrent jobs**. Match the Battlegrounds die-cut sticker style (thick keyline, flat vibrant
cel fills, hard offset shadow) for consistency. Commit the final WebP/PNG into `assets/art/` at a
stable filename.

## Run / test / deploy
- **Local:** open `index.html` directly, or `python3 -m http.server`. No install.
- **The Read tool may struggle with the whole file** — prefer `grep -n` / `sed -n 'A,Bp'` for
  targeted reads, and `node --check` after extracting the inline script if you touch JS.
- **Visual/headless:** Playwright (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, module at
  `/opt/node22/lib/node_modules/playwright`). Always assert 0 `pageerror`, and test
  `prefers-reduced-motion`, `deviceScaleFactor:2`, and 375→2560 widths (the bg + reveal + sticker
  sizing are the regression-prone areas). The Read tool rejects huge screenshots — assert on
  numeric metrics (computed styles, `getBoundingClientRect`) instead of eyeballing.
- **Deploy:** push `main` → GitHub Pages publishes to `nikepig.com`. No env vars, no functions.

## Workflow for non-trivial changes
Brainstorm/plan (orchestrator + Opus agents, distinct lenses) → Opus builder wave (single-file
client ⇒ usually ONE builder owns `index.html`) → Opus reviewer wave (contract/regression ·
visual/mobile · cross-file) → orchestrator QC (fix findings incl. nits, re-verify with Playwright)
→ append to `docs/branch-log.md` (+ update `CLAUDE.md` only if a durable fact changed) → commit +
push on the dev branch.

## Repo-scope + git constraints (this session's rules — keep honoring)
- Commit/push **only** on the designated dev branch `claude/paddle-payments-setup-0h567q`; never
  push to a different branch without explicit permission. Do **not** open PRs unless explicitly asked.
- `git push -u origin <branch>`; retry only on **network** errors (exponential backoff 2/4/8/16s).
  Do NOT retry proxy policy denials (403/405/407) — report them.
- GitHub access is scoped to the operator's repos; don't reach outside.
