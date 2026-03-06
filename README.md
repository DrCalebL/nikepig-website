# $NIKEPIG Website — nikepig.com

The official website for $NIKEPIG — The OG Pig of Cardano.

## Quick Deploy: GitHub Pages + Namecheap Domain

### Step 1: Push to GitHub

```bash
# Create a new repo on GitHub called "nikepig-website" (or whatever you want)
# Then from this folder:
git init
git add .
git commit -m "Initial deploy - nikepig.com"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nikepig-website.git
git push -u origin main
```

### Step 2: Enable GitHub Pages

1. Go to your repo on GitHub
2. **Settings** → **Pages** (left sidebar)
3. Under **Source**, select **Deploy from a branch**
4. Branch: `main`, folder: `/ (root)`
5. Click **Save**
6. Wait ~2 minutes, your site will be live at `https://YOUR_USERNAME.github.io/nikepig-website/`

### Step 3: Connect Namecheap Domain

#### In GitHub:
1. Still in **Settings → Pages**
2. Under **Custom domain**, type `www.nikepig.com`
3. Click **Save**
4. Check **Enforce HTTPS** (may take a few minutes to appear)

#### In Namecheap:
1. Go to **Domain List** → click **Manage** next to nikepig.com
2. Go to **Advanced DNS** tab
3. Delete any existing A records or CNAME for `@` and `www`
4. Add these **A Records** for the apex domain (`@`):

| Type | Host | Value |
|------|------|-------|
| A Record | @ | 185.199.108.153 |
| A Record | @ | 185.199.109.153 |
| A Record | @ | 185.199.110.153 |
| A Record | @ | 185.199.111.153 |

5. Add this **CNAME** for `www`:

| Type | Host | Value |
|------|------|-------|
| CNAME | www | YOUR_USERNAME.github.io |

6. DNS propagation takes 10-30 minutes (sometimes up to 48 hours)

### Step 4: Create CNAME file

Create a file called `CNAME` (no extension) in the repo root containing:
```
www.nikepig.com
```

This is already included in this repo.

---

## Alternative: Cloudflare Pages (also free, faster CDN)

1. Push to GitHub (same as Step 1 above)
2. Go to [Cloudflare Pages](https://pages.cloudflare.com/)
3. Connect your GitHub repo
4. Build settings: leave blank (static site, no build needed)
5. Deploy
6. Add custom domain in Cloudflare Pages settings
7. Update Namecheap nameservers to Cloudflare's (they'll tell you which ones)

Cloudflare gives you a global CDN, free SSL, and DDoS protection out of the box.

---

## File Structure

```
nikepig-website/
├── index.html          # The entire site (single page)
├── CNAME               # GitHub Pages custom domain
├── README.md           # This file
└── assets/
    ├── art/            # Nano Banana Pro 2 artwork & community art
    │   ├── nft-portrait.png
    │   ├── charles-and-nike.png
    │   ├── origin-tweet.png
    │   ├── christmas-nike.webp
    │   ├── rollercoaster-moon.png
    │   ├── valentines-nike.jpg
    │   ├── team-piggy.png
    │   ├── blanket-fort.png
    │   └── gaming-couch.png
    └── memes/          # Community memes (20 images)
        ├── charles-holding-nike.jpg
        ├── wall-street-pig.jpg
        ├── art-of-100x.jpg
        ├── king-nike.jpg
        ├── space-nike.jpg
        └── ... (15 more)
```

## TODO
- [ ] Replace `YOUR_NIKEPIG_POLICY_ID_HERE` with actual policy ID
- [ ] Verify all social links (X, Telegram, Discord)
- [ ] Update exchange links
- [ ] Add favicon (save a pig emoji or Nike art as favicon.ico)

## Built with
- Pure HTML/CSS/JS (no frameworks, no build step)
- Google Fonts (Bangers, Lilita One, Fredoka)
- Nano Banana Pro 2 generated artwork
- Community memes
