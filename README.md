# williamrosencrans.com

Personal site built as a mammalian cell. Each organelle is a page. Hosted on GitHub Pages at https://williamrosencrans.com (the domain is set by the `CNAME` file; DNS lives in Cloudflare).

| Organelle        | Page               | File               |
|------------------|--------------------|--------------------|
| Nucleus          | About              | `about.html`       |
| Mitochondria     | Research           | `research.html`    |
| Rough ER         | Publications       | `publications.html`|
| Golgi apparatus  | News               | `news.html`        |
| Centrosome       | CV                 | `cv.html`          |
| Lysosomes        | Beyond the Bench   | `life.html`        |
| Plasma membrane  | Contact            | `contact.html`     |

Plain HTML/CSS/JS, no build step.

- **Add news:** copy an `<li>` at the top of the list in `news.html`.
- **Add a paper:** copy a `<li class="pub">` in `publications.html` (set `data-first="true"` for first-author papers).
- **Rename pages / organelles:** edit `ORGANELLES` at the top of `assets/cell.js` (it drives the cell, labels and the nav on every page) and the legend list in `index.html`.
- **Preview locally:** `python3 -m http.server` in this folder, then open http://localhost:8000.
