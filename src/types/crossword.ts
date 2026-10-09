export type Direction = "right" | "down" | "right-down" | "down-right" | "right-down-plus-one" | "down-right-plus-one";
export type ImageFit = "cover" | "contain";
export type WordStartDirection = "right" | "down";
export type ImageArrowEdge = "bottom" | "right";
export type ImageArrowDirection = "right" | "down";

export interface Clue {
  id: string;
  text: string;
  direction: Direction;
}

export interface CellAppearance {
  fill?: string;
}

export type LetterCell = CellAppearance & {
  type: "letter";
  value: string;
  wordStarts?: WordStartDirection[];
};

export type BlackCell = CellAppearance & {
  type: "black";
};

export type ClueCell = CellAppearance & {
  type: "clue";
  clues: Clue[];
};

export type Cell = LetterCell | BlackCell | ClueCell;

export interface ImageArrow {
  id: string;
  edge: ImageArrowEdge;
  offset: number;
  direction: ImageArrowDirection;
  distance: number;
  locked?: boolean;
}

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
  arrows?: ImageArrow[];
}

export interface Crossword {
  version: 2;
  title: string;
  width: number;
  height: number;
  cells: Cell[][];
  images: CrosswordImage[];
  uppercaseClues?: boolean;
  lockedAnswerIds?: string[];
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

export interface ImagePhraseWord {
  index: number;
  cells: CellPosition[];
  value: string;
}

export interface ImagePhrase {
  id: string;
  imageId: string;
  arrowId: string;
  direction: ImageArrowDirection;
  start: CellPosition;
  cells: CellPosition[];
  words: ImagePhraseWord[];
  value: string;
  locked: boolean;
}

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  message: string;
  cell: CellPosition;
  clueId?: string;
}
