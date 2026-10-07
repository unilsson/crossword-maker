# Crossword Maker

A browser-based editor for **Swedish/Scandinavian-style crosswords**: clue text is placed inside the grid and arrows indicate whether an answer runs right or down.

## Sprint 1

The first sprint establishes the editor core:

- React + TypeScript + Vite.
- 15×15 editable grid.
- Letter, black and clue cells.
- One or two clues per clue cell, with right/down arrows.
- Swedish letters Å, Ä and Ö.
- Autosave in the browser using localStorage.
- Import/export of the complete crossword as JSON.
- Responsive editor with a cell inspector.

### Controls

- **Left click**: select a cell.
- **Right click**: cycle cell type: letter → black → clue → letter.
- When a letter cell is selected, type A–Z/Å/Ä/Ö.
- Arrow keys move the selection.
- Use the inspector to edit clue text and arrow direction.

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

Crosswords are stored as versioned JSON. Example cell types:

```ts
type Cell =
  | { type: "letter"; value: string }
  | { type: "black" }
  | {
      type: "clue";
      clues: {
        id: string;
        text: string;
        direction: "right" | "down";
      }[];
    };
```

See [docs/design.md](docs/design.md) for design notes and the boundaries of Sprint 1.

## Planned next steps

1. Detect answer runs and validate grid consistency.
2. Add a Swedish word list and word metadata.
3. Add assisted/automatic fill.
4. Generate clue suggestions with AI.
5. Add print/PDF and interactive publishing.
