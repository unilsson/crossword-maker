import type {
  Cell,
  ClueCell,
  Crossword,
  CrosswordImage,
  Direction,
} from "../types/crossword";

export const DEFAULT_SIZE = 15;

export const createLetterCell = (): Cell => ({ type: "letter", value: "" });

export const createEmptyCrossword = (
  width = DEFAULT_SIZE,
  height = DEFAULT_SIZE,
): Crossword => ({
  version: 2,
  title: "Nytt korsord",
  width,
  height,
  cells: Array.from({ length: height }, () =>
    Array.from({ length: width }, createLetterCell),
  ),
  images: [],
  uppercaseClues: false,
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
  const direction: Direction =
    (["right", "down", "right-down", "down-right", "right-down-plus-one", "down-right-plus-one"] as const).find(
      (candidate) => !used.has(candidate),
    ) ?? "right";

  return {
    ...cell,
    clues: [...cell.clues, { id: crypto.randomUUID(), text: "", direction }],
  };
};

export const removeClue = (cell: ClueCell, clueId: string): ClueCell => {
  if (cell.clues.length <= 1) return cell;
  return { ...cell, clues: cell.clues.filter((clue) => clue.id !== clueId) };
};

export const clampImageToGrid = (
  image: CrosswordImage,
  width: number,
  height: number,
): CrosswordImage => {
  const row = Math.max(0, Math.min(height - 1, image.row));
  const col = Math.max(0, Math.min(width - 1, image.col));
  const rowSpan = Math.max(1, Math.min(image.rowSpan, height - row));
  const colSpan = Math.max(1, Math.min(image.colSpan, width - col));

  return { ...image, row, col, rowSpan, colSpan };
};

export const imageAtCell = (
  images: CrosswordImage[],
  row: number,
  col: number,
): CrosswordImage | undefined =>
  images.find(
    (image) =>
      row >= image.row &&
      row < image.row + image.rowSpan &&
      col >= image.col &&
      col < image.col + image.colSpan,
  );

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
        (item.direction === "right" ||
          item.direction === "down" ||
          item.direction === "right-down" ||
          item.direction === "down-right" ||
          item.direction === "right-down-plus-one" ||
          item.direction === "down-right-plus-one")
      );
    });
  }

  return false;
};

const isImage = (value: unknown): value is CrosswordImage => {
  if (!value || typeof value !== "object") return false;
  const image = value as Record<string, unknown>;

  return (
    typeof image.id === "string" &&
    typeof image.assetId === "string" &&
    typeof image.fileName === "string" &&
    Number.isInteger(image.row) &&
    Number.isInteger(image.col) &&
    Number.isInteger(image.rowSpan) &&
    Number.isInteger(image.colSpan) &&
    typeof image.row === "number" &&
    typeof image.col === "number" &&
    typeof image.rowSpan === "number" &&
    typeof image.colSpan === "number" &&
    image.row >= 0 &&
    image.col >= 0 &&
    image.rowSpan >= 1 &&
    image.colSpan >= 1 &&
    (image.fit === "cover" || image.fit === "contain") &&
    typeof image.alt === "string"
  );
};

const validGrid = (
  cells: unknown,
  width: number,
  height: number,
): cells is Cell[][] =>
  Array.isArray(cells) &&
  cells.length === height &&
  cells.every(
    (row) => Array.isArray(row) && row.length === width && row.every(isCell),
  );

export const isCrossword = (value: unknown): value is Crossword => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Crossword> & { version?: number };

  if (
    candidate.version !== 2 ||
    typeof candidate.title !== "string" ||
    typeof candidate.width !== "number" ||
    typeof candidate.height !== "number" ||
    !Number.isInteger(candidate.width) ||
    !Number.isInteger(candidate.height) ||
    candidate.width < 1 ||
    candidate.height < 1 ||
    !validGrid(candidate.cells, candidate.width, candidate.height) ||
    !Array.isArray(candidate.images) ||
    !candidate.images.every(isImage) ||
    (candidate.uppercaseClues !== undefined &&
      typeof candidate.uppercaseClues !== "boolean")
  ) {
    return false;
  }

  return candidate.images.every(
    (image) =>
      image.row + image.rowSpan <= candidate.height! &&
      image.col + image.colSpan <= candidate.width!,
  );
};

export const migrateCrossword = (value: unknown): Crossword | null => {
  if (isCrossword(value)) {
    return {
      ...value,
      uppercaseClues: value.uppercaseClues ?? false,
    };
  }

  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;

  if (
    candidate.version !== 1 ||
    typeof candidate.title !== "string" ||
    typeof candidate.width !== "number" ||
    typeof candidate.height !== "number" ||
    !Number.isInteger(candidate.width) ||
    !Number.isInteger(candidate.height) ||
    candidate.width < 1 ||
    candidate.height < 1 ||
    !validGrid(candidate.cells, candidate.width, candidate.height)
  ) {
    return null;
  }

  return {
    version: 2,
    title: candidate.title,
    width: candidate.width,
    height: candidate.height,
    cells: candidate.cells,
    images: [],
    uppercaseClues: false,
  };
};
