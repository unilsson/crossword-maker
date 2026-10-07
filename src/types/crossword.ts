export type Direction = "right" | "down";

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

export interface Crossword {
  version: 1;
  title: string;
  width: number;
  height: number;
  cells: Cell[][];
}
