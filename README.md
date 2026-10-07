# Crossword Maker

A browser-based editor for **Swedish/Scandinavian-style crosswords**: clue text is placed inside the grid, arrows indicate answer direction, and images can occupy multi-cell areas.

## Sprint 1 + 1.1

The editor currently includes:

- React + TypeScript + Vite.
- 15×15 editable grid.
- Letter, black and clue cells.
- One or two clues per clue cell, with right/down arrows.
- Swedish letters Å, Ä and Ö.
- Images that can span multiple rows and columns.
- Image positioning, resizing, cover/contain fitting, replacement and removal.
- Image assets stored locally in IndexedDB.
- Autosave in the browser using localStorage.
- Import/export of the crossword structure as JSON.
- Automatic migration of Sprint 1 project JSON to the current format.
- Responsive editor with a cell/image inspector.

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

Then open the URL printed by Vite.

Build a production bundle with:

```bash
npm run build
```

## Project format

Crossword JSON is versioned. Version 2 contains both the grid and image metadata:

```ts
interface Crossword {
  version: 2;
  title: string;
  width: number;
  height: number;
  cells: Cell[][];
  images: CrosswordImage[];
}

interface CrosswordImage {
  id: string;
  assetId: string;
  fileName: string;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  fit: "cover" | "contain";
  alt: string;
}
```

Image binaries are intentionally not embedded in JSON. They are stored in the browser's IndexedDB and referenced through `assetId`. A JSON file moved to another browser therefore keeps image placement metadata, but the local image binary must also exist there. A portable project bundle is a future feature.

See [docs/design.md](docs/design.md) for design notes.

## Planned next steps

1. Detect answer runs and treat image areas as blockers.
2. Validate grid consistency and clue directions.
3. Add a Swedish word list and word metadata.
4. Add assisted/automatic fill.
5. Generate clue suggestions with AI.
6. Add portable project bundles plus print/PDF and interactive publishing.
