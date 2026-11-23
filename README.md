# Botsy Studios website

Static site, no build step. Works on any free host (GitHub Pages, Cloudflare Pages, Netlify).

## Before going live
1. In `site.js`, set `DISCORD_INVITE` to the permanent invite link.
2. Upload the whole folder. For Cloudflare Pages / Netlify, drag and drop it. For GitHub Pages, push it to a repo and enable Pages.

## Updating reviews
Reviews come only from real members:
1. In Discord, run `/reviews export` (Management+). The bot sends you `reviews.json`.
2. Replace `reviews.json` here with that file and re-upload.

Until there are reviews, the page shows a friendly "be the first" message.

Note: open the site through a host or local server (`npx serve .`). Opening the HTML file directly blocks loading reviews.json.
