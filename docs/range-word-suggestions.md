# Sprint 6 – Word suggestions for selected ranges

This feature is independent of clue arrows and automatically derived answers.

1. Install the Swedish dictionary in the inspector (if not already installed).
2. Click the first letter cell of a horizontal or vertical span.
3. **Shift-click** the last cell in the same row or column.
4. Read the pattern and suggestions in **Ord för markerade rutor** in the inspector.
5. Click one suggestion to write the word into the marked cells.

Only straight contiguous selections of at least two letter cells are eligible. Existing letters are required to match the candidate; images, clue cells and black cells invalidate the range. Locked crossing cells cannot be changed. Candidates are filtered by length and letter pattern using the existing dictionary engine, including custom words. The first 60 matching candidates are displayed along with the total match count.

The existing project autosave mechanism saves inserted letters in server-backed projects. This feature does not create clue arrows or alter the selected cells' types.

## Test checklist

- Select horizontal and vertical spans; verify pattern and word length.
- Insert a suggestion into empty cells and into cells with crossing letters.
- Verify impossible patterns show no candidates.
- Verify a selection crossing clue, image or black cells does not suggest or insert words.
- Verify locked letters remain unchanged.
- Save a server project, reopen it, and verify inserted letters remain.
