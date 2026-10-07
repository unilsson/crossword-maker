# Design notes

## Product goal

Crossword Maker is a browser-based editor for Swedish/Scandinavian-style crosswords where clue text lives inside the grid and arrows indicate answer direction.

The internal model is intentionally designed around this style rather than treating it as a special case of an American-style crossword.

## Sprint 1 model

A crossword contains a rectangular matrix of cells. Every cell is exactly one of:

- **letter** — contains zero or one Swedish letter.
- **black** — blocks answer runs.
- **clue** — contains one or two clues. Each clue has text and an arrow direction (`right` or `down`).

Project files use JSON and carry a `version` field so future migrations can be explicit.

## Interaction

- Left click selects a cell.
- Right click cycles `letter → black → clue → letter`.
- The inspector can set the type directly.
- Letter cells accept A–Z, Å, Ä and Ö.
- Clue cells can contain up to two clues in Sprint 1.
- Current work is autosaved to `localStorage`.
- Projects can be exported/imported as JSON.

## Deliberately deferred

Sprint 1 does not attempt word extraction, dictionary lookup, automatic filling, clue generation, print/PDF output, images in clue cells, or collaboration.

These are later sprints built on top of the stable cell model.
