import type { Cell, ClueCell, Crossword, Direction } from "../types/crossword";

export const DEFAULT_SIZE = 15;

export const createLetterCell = (): Cell => ({ type: "letter", value: "" });

export const createEmptyCrossword = (
  width = DEFAULT_SIZE,
  height = DEFAULT_SIZE,
): Crossword => ({
  version: 1,
  title: "Nytt korsord",
  width,
  height,
  cells: Array.from({ length: height }, () =>
    Array.from({ length: width }, createLetterCell),
  ),
});

export const cycleCellType = (cell: Cell): Cell => {
  if (cell.type === "letter") return { type: "black" };

  if (cell.type === "black") {
    return {
      type: "clue",
      clues: [{ id: crypto.randomUUID(), text: "", direction: "right" }],
    };
  }

  return createLetterCell();
};

export const setLetter = (cell: Cell, value: string): Cell => {
  if (cell.type !== "letter") return cell;

  const normalized = value
    .normalize("NFC")
    .toLocaleUpperCase("sv-SE")
    .replace(/[^A-ZÅÄÖ]/g, "")
    .slice(-1);

  return { ...cell, value: normalized };
};

export const updateClue = (
  cell: ClueCell,
  clueId: string,
  patch: Partial<{ text: string; direction: Direction }>,
): ClueCell => ({
  ...cell,
  clues: cell.clues.map((clue) =>
    clue.id === clueId ? { ...clue, ...patch } : clue,
  ),
});

export const addClue = (cell: ClueCell): ClueCell => {
  if (cell.clues.length >= 2) return cell;

  const used = new Set(cell.clues.map((clue) => clue.direction));
  const direction: Direction = used.has("right") ? "down" : "right";

  return {
    ...cell,
    clues: [...cell.clues, { id: crypto.randomUUID(), text: "", direction }],
  };
};

export const removeClue = (cell: ClueCell, clueId: string): ClueCell => {
  if (cell.clues.length <= 1) return cell;
  return { ...cell, clues: cell.clues.filter((clue) => clue.id !== clueId) };
};

const isCell = (value: unknown): value is Cell => {
  if (!value || typeof value !== "object") return false;
  const cell = value as Record<string, unknown>;

  if (cell.type === "letter") return typeof cell.value === "string";
  if (cell.type === "black") return true;

  if (cell.type === "clue" && Array.isArray(cell.clues)) {
    return cell.clues.every((clue) => {
      if (!clue || typeof clue !== "object") return false;
      const item = clue as Record<string, unknown>;
      return (
        typeof item.id === "string" &&
        typeof item.text === "string" &&
        (item.direction === "right" || item.direction === "down")
      );
    });
  }

  return false;
};

export const isCrossword = (value: unknown): value is Crossword => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Crossword>;

  if (
    candidate.version !== 1 ||
    typeof candidate.title !== "string" ||
    !Number.isInteger(candidate.width) ||
    !Number.isInteger(candidate.height) ||
    typeof candidate.width !== "number" ||
    typeof candidate.height !== "number" ||
    candidate.width < 1 ||
    candidate.height < 1 ||
    !Array.isArray(candidate.cells)
  ) {
    return false;
  }

  return (
    candidate.cells.length === candidate.height &&
    candidate.cells.every(
      (row) =>
        Array.isArray(row) &&
        row.length === candidate.width &&
        row.every(isCell),
    )
  );
};
