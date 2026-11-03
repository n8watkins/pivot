# Pivot brand

The Pivot logo is a lowercase "p" drawn as one stroke, with a coral arrow pointing back at the stem.

## Colors

| Name | Hex | Use |
| --- | --- | --- |
| Sage | `#4d6d5a` | The p's stroke on light surfaces, and the tile background. |
| Coral | `#e88b70` | The arrow, on every version. |
| Paper | `#f5f7f2` | The p's stroke on dark surfaces and on the sage tile. |

## Which file to use where

| File | What it is | Use it for |
| --- | --- | --- |
| `pivot-p-sage.svg`, `pivot-p-sage.png` (512), `pivot-p-sage-1024.png` | Sage p on transparent | Light backgrounds: docs, slides, the GitHub OAuth app logo (`pivot-p-sage.png`). |
| `pivot-p-white.svg`, `pivot-p-white.png` (512), `pivot-p-white-1024.png` | Paper p on transparent | Dark backgrounds. |
| `pivot-tile.svg`, `pivot.png` (512), `pivot-tile-1024.png` | Paper p on a rounded sage tile | Anywhere a solid background is needed: avatars, app listings, social cards. |
| `pivot-tile-square.svg` | The tile without rounded corners | The Apple touch icon, which iOS rounds itself. |
| `pivot-tile-maskable.svg` | The square tile with the p scaled into the maskable safe zone | Android maskable icons. |

Leave clear space around the mark of at least the stroke's width, and do not recolor the arrow.

## In the app

- Pages use the inline `Logo` component in `src/components/pivot/ui.tsx`. Its stroke follows the `--logo-stroke` token (sage, or paper inside an `.on-dark` surface), so the SVG is never duplicated as an image.
- `public/icon.svg` is the favicon. It switches between the sage and the paper p with the browser's color scheme, and `public/favicon.ico` is its fallback.
- `npm run icons` renders `public/favicon.ico`, `public/apple-icon.png` and the manifest icons in `public/icons/` from the SVGs here. Run it after changing a source, and commit the output.
