# Crossword Maker

A browser-based editor for **Swedish/Scandinavian-style crosswords**: clue text lives inside the grid, arrows indicate answer direction, images can occupy multi-cell areas, and the editor derives answer structure automatically.

## Sprint 2

The editor currently includes:

- React + TypeScript + Vite.
- 15×15 editable grid.
- Letter, black and clue cells.
- One or two clues per clue cell, with right/down arrows.
- Swedish letters Å, Ä and Ö.
- Images that can span multiple rows and columns.
- Image positioning, resizing, cover/contain fitting, replacement and removal.
- Image assets stored locally in IndexedDB.
- Automatic answer detection from clue arrows.
- Answer length and current letter pattern in the inspector.
- Highlighting of answer cells when selecting a clue or letter cell.
- Reverse lookup showing which answers a letter cell belongs to.
- Structural validation with clickable errors and warnings.
- Image areas treated as blockers by answer detection.
- Autosave in the browser using localStorage.
- Import/export of the crossword structure as JSON.
- Automatic migration of Sprint 1 project JSON to the current format.

### Answer rules

A clue pointing right (`→`) starts in the cell immediately to the right. A clue pointing down (`↓`) starts immediately below. The answer continues through letter cells and stops at:

- the edge of the grid;
- a black cell;
- another clue cell;
- an image-covered cell.

Derived answers are not stored in project JSON. They are recalculated from the current layout, so there is no duplicated answer structure that can become stale.

### Validation

Sprint 2 currently reports:

- clue arrows that do not lead to any letter cells;
- one-letter answers as warnings;
- clue cells with duplicate arrow directions;
- empty clue text as a warning;
- images that cover clue cells;
- images that cover already-filled letters.

Click a validation item to jump to the relevant cell or image.

### Controls

- **Left click**: select a cell or image.
- **Right click a free cell**: cycle cell type: letter → black → clue → letter.
- When a letter cell is selected, type A–Z/Å/Ä/Ö.
- Arrow keys move the cell selection.
- Use the inspector to edit clue text and arrow direction.
- Select a cell and click **+ Bild** to place an image with its top-left corner there.
- Select an image to move it, change its size, choose cover/contain, replace it or remove it.

## Run locally

Requires a recent Node.js version.

```bash
npm install
npm run dev
```

Build a production bundle with:

```bash
npm run build
```

## Project format

Crossword JSON remains version 2. Sprint 2 adds derived analysis only, so no project-format bump is needed.

Image binaries are intentionally not embedded in JSON. They are stored in the browser's IndexedDB and referenced through `assetId`. A portable project bundle is a future feature.

See [docs/design.md](docs/design.md) for design notes.

## Planned next steps

1. Add a Swedish word list and word metadata.
2. Add assisted/automatic fill.
3. Generate clue suggestions with AI.
4. Add portable project bundles plus print/PDF and interactive publishing.
