# Crossword Maker

A browser-based editor for **Swedish/Scandinavian-style crosswords**: clue text lives inside the grid, arrows indicate answer direction, images can occupy multi-cell areas, answer structure is derived automatically, and a Swedish word list can suggest matching words.


## Sprint 7 – Swesaurus synonyms

The editor includes a **Synonymer och närbesläktade ord** panel beside the ordinary pattern-based word suggestions. Swesaurus can be installed to the server SQLite database and searched by meaning, answer length and existing letters. Clicking a compatible suggestion inserts it in the selected horizontal or vertical range. Locked cells are protected.

The synonym source is [Swesaurus by Språkbanken Text](https://spraakbanken.gu.se/resurser/swesaurus), licensed under **CC BY 4.0**. It is not bundled with the application; users opt in to download it via the UI, or may upload the official XML file. Fuzzy synonym groups can include words that are related but not directly interchangeable. See [docs/swesaurus.md](docs/swesaurus.md) for installation, attribution and tests.

Docker Compose now builds the API from `server/Dockerfile`, rather than bind-mounting its code. All projects, image assets and imported synonyms persist in the named `crossword-data` volume.

## Sprint 4

The editor currently includes:

- React + TypeScript + Vite.
- 15×15 editable grid.
- Letter, black and clue cells.
- One or two clues per clue cell, with right, down, right-then-down, right-then-down +1, down-then-right and down-then-right +1 arrows.
- Project-level toggle for rendering all clue text in uppercase without changing the stored clue text.
- Automatic Swedish clue hyphenation, with `|` as an optional manual soft-hyphen marker.
- Swedish letters Å, Ä and Ö.
- Images that can span multiple rows and columns.
- Optional per-cell background colors, including a free color picker and quick presets.
- Straight multi-cell color selection: click one cell, then Shift-click another cell in the same row or column to color the whole range at once.
- Semantic image phrases derived from arrows leaving images.
- Word-start arrows inside image phrases; these split a phrase into words without ending the phrase.
- Configurable image-arrow edge position, direction and distance to the first phrase cell.
- Pattern display and Swedish dictionary suggestions for every word in an image phrase.
- One-click "Fyll bästa" assistance for normal answers and image-phrase words.
- Locking for normal answers and image phrases so assisted filling cannot change protected letters.
- Automatic answer detection from clue arrows.
- Answer highlighting and reverse lookup from letter cells.
- Structural validation with clickable errors and warnings.
- Optional Swedish dictionary installation with local IndexedDB caching.
- Pattern-based word lookup for a selected answer.
- Custom user words stored locally in the browser.
- One-click insertion of a matching candidate into the selected answer.
- Autosave in localStorage and JSON import/export.

### Answer rules

A clue pointing right (`→`) starts in the cell immediately to the right and continues right. A clue pointing down (`↓`) starts immediately below and continues down. A right-then-down clue (`↳`) starts in the cell immediately to the right and then continues downward from that column. A right-then-down +1 clue starts one row below and one column to the right of the clue cell, then continues down. A down-then-right clue starts immediately below the clue cell and then continues right along that row. A down-then-right +1 clue starts one row below and one column to the right of the clue cell, then continues right. Answers stop at the grid edge, a black cell, another clue cell or an image-covered cell.

Derived answers are not stored in project JSON. They are recalculated from the current layout.

Image arrows now define semantic image phrases. The arrow edge and offset determine where it leaves the image; its distance determines how many cells outward the phrase starts, and its direction determines whether the phrase then continues right or down. The phrase continues through ordinary letter cells until the grid edge, a black/clue cell or another image blocks it.

A word-start arrow on a letter cell means “new word here” for a matching image phrase direction. It does not terminate the phrase. The inspector shows the complete phrase pattern with spaces at these word boundaries, and each word can use the Swedish dictionary independently.


### Clue typography

Clue text uses Swedish automatic hyphenation in the grid. If a clue needs manual typographic control, insert `|` at an allowed break point, for example `männi|skans`. The marker remains visible in the editor field but is rendered as a soft hyphen in the crossword, so a hyphen appears only when the line actually breaks there.

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

Crossword JSON remains version 2. Optional cell colors, word-start markers, image-phrase locks and normal-answer locks are backward-compatible optional fields, so Sprint 4 does not require a project-format bump. Dictionary state remains outside project JSON.

Image binaries are stored separately in IndexedDB. The downloaded Swedish word list is also cached separately in IndexedDB. Custom words are stored in localStorage.

See [docs/design.md](docs/design.md) for design notes.

## Planned next steps

1. Add true multi-answer autofill with constraint propagation and backtracking.
2. Add richer word metadata and ranking/frequency data.
3. Generate clue suggestions with AI.
4. Add portable project bundles plus print/PDF and interactive publishing.
