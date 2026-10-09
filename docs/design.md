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

## Sprint 2: derived answer structure

Sprint 2 introduces an analysis layer without changing the persisted project format.

An `Answer` is derived from one clue. Its identity is the clue ID, and it contains the clue-cell position, direction, ordered letter-cell positions and current value. Answers are recomputed whenever the crossword changes.

Answer traversal starts one cell away from the clue in its arrow direction and continues only through ordinary letter cells. Grid edges, black cells, clue cells and image-covered cells terminate the answer.

A reverse index maps every answer cell back to its answer or answers. This enables selecting a letter cell and seeing the horizontal and/or vertical answers that cross there.

Validation is also derived. Each issue has a severity, message and grid position, plus a clue ID when the issue belongs to a specific clue. The UI uses these issues both for the validation list and for visual markers in the grid.

Because answers and issues are derived rather than persisted, editing a cell, clue direction or image placement can never leave stored answer metadata out of sync.


## Sprint 3: dictionary layer

Sprint 3 adds a dictionary service without changing the persisted crossword schema.

The dictionary is deliberately separate from project JSON. A crossword project stores the puzzle; dictionary data is a reusable local resource.

### Base dictionary

The first supported source is Martin Lindhe's Swedish word list (MIT licensed). It is downloaded on demand rather than committed to the application repository. The browser caches the normalized dataset in a dedicated IndexedDB database.

During import, entries are:

- Unicode-normalized;
- converted to Swedish uppercase;
- restricted to A–Z, Å, Ä and Ö;
- deduplicated.

The in-memory lexicon is indexed by word length with a `Map<number, string[]>`. That makes candidate lookup scan only words of the required length rather than the complete dictionary.

### Candidate matching

A derived answer is converted to a search pattern where filled letters remain literal and empty cells become `.`.

Example:

```text
H··D
```

A candidate must have exactly the same length and match every known letter. Candidate results include source metadata and are capped in the UI while still reporting the total number of matches.

Custom words are searched first and base-dictionary words second. Duplicate spellings are only counted once.

### Filling a candidate

Choosing a candidate writes its letters into the already-derived answer cells. Since the candidate was matched against the current answer pattern, it cannot overwrite a conflicting crossing letter.

This is intentionally a small, local form of assistance. Full multi-answer search, constraint propagation and backtracking remain deferred to the next fill-focused sprint.

### Storage

- Crossword structure: localStorage / exported JSON.
- Image binaries: IndexedDB.
- Base Swedish dictionary: separate IndexedDB database.
- Custom words: localStorage.

Keeping these concerns separate avoids inflating project JSON and allows the dictionary to be reused across puzzles.


## Sprint 4: semantic image phrases

Sprint 4 turns the image notation introduced before Sprint 4 into derived answer-like structures.

Each image arrow owns one `ImagePhrase`. The phrase start is derived from the image edge, the edge offset, the arrow's outward distance and its final direction. From that start cell the phrase traverses ordinary letter cells to the right or downward until a blocker is reached.

Image phrases are derived rather than persisted. The persisted arrow only stores the geometry plus an optional lock flag. This mirrors the existing clue-answer design and prevents stale phrase metadata after grid edits.

### Word boundaries

Letter cells may contain decorative `wordStarts` markers for rightward or downward image phrases. A marker does not stop traversal. Instead it splits the containing image phrase into `ImagePhraseWord` segments. This makes a phrase such as:

```text
..... → ......
```

one semantic phrase with two searchable words.

Markers that do not belong to any image phrase in the same direction generate a validation warning.

### Crossings and locking

Normal clue answers and image phrases share the same physical letter cells, so crossings automatically share one letter value.

Normal answers can be locked by clue ID. Image phrases are locked on their image arrow. Locked structures contribute their cells to a protected-cell set. Assisted filling refuses to change a protected crossing letter, which prevents a suggestion for one answer from silently damaging an already accepted answer or phrase.

### Assisted fill

Sprint 4 remains deliberately local rather than doing global autofill:

- normal answers keep pattern-based dictionary candidates and gain a one-click best candidate;
- every word inside an image phrase gets its own dictionary search and candidate buttons;
- the best candidate for an image-phrase word can be filled with one click;
- locked structures disable destructive fill.

Full constraint propagation and backtracking across several answers remains deferred to the next fill-focused sprint.
