# Crossword Maker

A browser-based editor for **Swedish/Scandinavian-style crosswords**: clue text lives inside the grid, arrows indicate answer direction, images can occupy multi-cell areas, answer structure is derived automatically, and a Swedish word list can suggest matching words.

## Sprint 3

The editor currently includes:

- React + TypeScript + Vite.
- 15×15 editable grid.
- Letter, black and clue cells.
- One or two clues per clue cell, with right/down arrows.
- Swedish letters Å, Ä and Ö.
- Images that can span multiple rows and columns.
- Automatic answer detection from clue arrows.
- Answer highlighting and reverse lookup from letter cells.
- Structural validation with clickable errors and warnings.
- Optional Swedish dictionary installation with local IndexedDB caching.
- Pattern-based word lookup for a selected answer.
- Custom user words stored locally in the browser.
- One-click insertion of a matching candidate into the selected answer.
- Autosave in localStorage and JSON import/export.

### Answer rules

A clue pointing right (`→`) starts in the cell immediately to the right. A clue pointing down (`↓`) starts immediately below. The answer continues through letter cells and stops at the grid edge, a black cell, another clue cell or an image-covered cell.

Derived answers are not stored in project JSON. They are recalculated from the current layout.

## Swedish word list

Sprint 3 uses the public **Martin Lindhe Swedish word list** as its optional base dictionary:

- Source: https://github.com/martinlindhe/wordlist_swedish
- License: MIT
- Upstream description: alphabetically sorted distinct Swedish spellings; names are not included.

The list is **not bundled into this repository**. The user explicitly installs it from the editor. It is then fetched from the upstream raw file, normalized to uppercase Swedish crossword letters, filtered to entries containing only A–Z/Å/Ä/Ö, and cached in IndexedDB.

This keeps the application repository small and makes the external data source and license explicit.

### Candidate lookup

When a selected letter or clue cell belongs to an answer, Sprint 3 can search the installed dictionary by:

- exact answer length;
- all letters already present in the answer;
- Swedish letters Å, Ä and Ö.

For example, the pattern `H··D` only returns four-letter words whose first letter is H and last letter is D.

Candidate metadata currently includes:

- normalized word;
- word length;
- source (`ordlista` or `eget`).

Clicking a candidate fills the corresponding answer cells. Existing crossing letters are safe because candidates are filtered against the current pattern before they are shown.

### Custom words

Users can add project-independent custom words from the inspector. Custom words are normalized and validated using the same A–Z/Å/Ä/Ö rules and are stored in localStorage. Custom matches are shown before base-dictionary matches.

## Validation

Sprint 2/3 reports:

- clue arrows that do not lead to any letter cells;
- one-letter answers as warnings;
- clue cells with duplicate arrow directions;
- empty clue text as a warning;
- images that cover clue cells;
- images that cover already-filled letters.

Click a validation item to jump to the relevant cell or image.

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

Crossword JSON remains version 2. Sprint 3 adds dictionary state outside the project JSON, so no project-format bump is needed.

Image binaries are stored separately in IndexedDB. The downloaded Swedish word list is also cached separately in IndexedDB. Custom words are stored in localStorage.

See [docs/design.md](docs/design.md) for design notes.

## Planned next steps

1. Add richer word metadata and ranking/frequency data.
2. Add assisted multi-answer fill and automatic fill/backtracking.
3. Generate clue suggestions with AI.
4. Add portable project bundles plus print/PDF and interactive publishing.
