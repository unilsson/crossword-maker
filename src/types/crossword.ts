export type Direction = "right" | "down" | "right-down" | "down-right" | "right-down-plus-one" | "down-right-plus-one";
export type ImageFit = "cover" | "contain";

export interface Clue {
  id: string;
  text: string;
  direction: Direction;
}

export type LetterCell = {
  type: "letter";
  value: string;
};

export type BlackCell = {
  type: "black";
};

export type ClueCell = {
  type: "clue";
  clues: Clue[];
};

export type Cell = LetterCell | BlackCell | ClueCell;

export interface CrosswordImage {
  id: string;
  assetId: string;
  fileName: string;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  fit: ImageFit;
  alt: string;
}

export interface Crossword {
  version: 2;
  title: string;
  width: number;
  height: number;
  cells: Cell[][];
  images: CrosswordImage[];
  uppercaseClues?: boolean;
}


export interface CellPosition {
  row: number;
  col: number;
}

export interface Answer {
  id: string;
  clueId: string;
  clueText: string;
  clueCell: CellPosition;
  direction: Direction;
  cells: CellPosition[];
  value: string;
}

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  message: string;
  cell: CellPosition;
  clueId?: string;
}
