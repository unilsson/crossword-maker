# Design notes

## Product goal

Crossword Maker is a browser-based editor for Swedish/Scandinavian-style crosswords where clue text lives inside the grid, arrows indicate answer direction, and pictures can be part of the puzzle layout.

The internal model is intentionally designed around this style rather than treating it as a special case of an American-style crossword.

## Cell model

A crossword contains a rectangular matrix of cells. Every cell is exactly one of:

- **letter** — contains zero or one Swedish letter.
- **black** — blocks answer runs.
- **clue** — contains one or two clues. Each clue has text and an arrow direction (`right` or `down`).

## Sprint 1.1 image model

Images are first-class objects layered on top of the cell grid. An image owns a rectangular area defined by `row`, `col`, `rowSpan` and `colSpan`. This avoids pretending a multi-cell picture is a special kind of single cell.

Cells covered by an image are unavailable for editing while the image is present. Later word-detection code must treat every covered cell as a blocker.

Image metadata lives in project JSON. Binary image data is stored in IndexedDB and addressed by `assetId`. This keeps autosaved JSON small and makes a future backend/storage abstraction straightforward.

Current image operations:

- place from the selected top-left cell;
- default placement is 3×3 cells, clamped to the grid;
- move by row/column;
- resize by row/column span;
- `cover` or `contain` image fit;
- edit alt text;
- replace image asset;
- remove image;
- prevent image-to-image overlap.

## Project versioning

Sprint 1 used JSON format version 1. Sprint 1.1 introduces version 2 with an `images` array. Version 1 projects are migrated automatically to version 2 with an empty image list.

## Interaction

- Left click selects a cell or image.
- Right click cycles a free cell `letter → black → clue → letter`.
- The inspector can set a cell type directly.
- Letter cells accept A–Z, Å, Ä and Ö.
- Clue cells can contain up to two clues.
- Current work is autosaved to `localStorage`.
- Image binaries are stored in IndexedDB.
- Project structure and image metadata can be exported/imported as JSON.

## Deliberately deferred

Sprint 1.1 does not attempt word extraction, dictionary lookup, automatic filling, clue generation, print/PDF output, image cropping controls, image-led clue arrows, portable image bundles, or collaboration.

Those features build on top of the stable grid and image models.
