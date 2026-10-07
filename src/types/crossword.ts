export type Direction = "right" | "down";
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
}
