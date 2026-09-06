# Citation List — GitHub Pages

A lightweight, zero-build citation website for Sara Monteiro.

## Files

- `index.html` — citation page
- `styles.css` — responsive styling + light/dark mode
- `script.js` — search, filters, copy buttons, theme toggle
- `CITATIONS.md` — plain Markdown version of the citation list
- `.nojekyll` — tells GitHub Pages to serve the files directly

## Publish with GitHub Pages

1. Create a **public** GitHub repository, for example `citations`.
2. Upload all files from this folder to the repository root.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select `main` and `/ (root)`, then save.

The site will normally be available at:

`https://monteiro-sara.github.io/citations/`

If you instead create the special repository `monteiro-sara.github.io`, GitHub Pages will serve it at:

`https://monteiro-sara.github.io/`

## Updating the list

Edit the citation text directly in `index.html` and the Markdown mirror in `CITATIONS.md`.

The site has no dependencies, package manager, build process, or framework.
