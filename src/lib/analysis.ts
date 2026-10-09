import { imageAtCell } from "./crossword";
import type {
  Answer,
  CellPosition,
  Crossword,
  CrosswordImage,
  Direction,
  ImageArrow,
  ImagePhrase,
  ImagePhraseWord,
  ValidationIssue,
} from "../types/crossword";

const pathForDirection = (
  direction: Direction,
): { start: CellPosition; step: CellPosition } => {
  if (direction === "right") {
    return { start: { row: 0, col: 1 }, step: { row: 0, col: 1 } };
  }

  if (direction === "right-down") {
    return { start: { row: 0, col: 1 }, step: { row: 1, col: 0 } };
  }

  if (direction === "right-down-plus-one") {
    return { start: { row: 1, col: 1 }, step: { row: 1, col: 0 } };
  }

  if (direction === "down-right") {
    return { start: { row: 1, col: 0 }, step: { row: 0, col: 1 } };
  }

  if (direction === "down-right-plus-one") {
    return { start: { row: 1, col: 1 }, step: { row: 0, col: 1 } };
  }

  return { start: { row: 1, col: 0 }, step: { row: 1, col: 0 } };
};

const directionText = (direction: Direction): string => {
  if (direction === "right") return "åt höger";
  if (direction === "right-down") return "åt höger och sedan nedåt";
  if (direction === "right-down-plus-one") {
    return "åt höger och sedan nedåt, med start ett steg ned";
  }
  if (direction === "down-right") return "nedåt och sedan åt höger";
  if (direction === "down-right-plus-one") {
    return "nedåt och sedan åt höger, med start ett steg åt höger";
  }
  return "nedåt";
};

const keyOf = (row: number, col: number) => row + ":" + col;

const inBounds = (crossword: Crossword, row: number, col: number) =>
  row >= 0 &&
  row < crossword.height &&
  col >= 0 &&
  col < crossword.width;

const imageArrowStart = (
  image: CrosswordImage,
  arrow: ImageArrow,
): CellPosition => {
  if (arrow.edge === "bottom") {
    return {
      row: image.row + image.rowSpan + arrow.distance,
      col: image.col + arrow.offset,
    };
  }

  return {
    row: image.row + arrow.offset,
    col: image.col + image.colSpan + arrow.distance,
  };
};

const imagePhraseStep = (arrow: ImageArrow): CellPosition =>
  arrow.direction === "right"
    ? { row: 0, col: 1 }
    : { row: 1, col: 0 };

const phraseWordValue = (
  crossword: Crossword,
  cells: CellPosition[],
): string =>
  cells
    .map(({ row, col }) => {
      const cell = crossword.cells[row][col];
      return cell.type === "letter" ? cell.value : "";
    })
    .join("");

export interface CrosswordAnalysis {
  answers: Answer[];
  imagePhrases: ImagePhrase[];
  issues: ValidationIssue[];
  answersByCell: Map<string, Answer[]>;
  answersByClueId: Map<string, Answer>;
  imagePhrasesByCell: Map<string, ImagePhrase[]>;
  imagePhrasesByArrowId: Map<string, ImagePhrase>;
  imagePhrasesByImageId: Map<string, ImagePhrase[]>;
}

export const deriveAnswers = (crossword: Crossword): Answer[] => {
  const answers: Answer[] = [];

  crossword.cells.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell.type !== "clue") return;
      if (imageAtCell(crossword.images, rowIndex, colIndex)) return;

      for (const clue of cell.clues) {
        const path = pathForDirection(clue.direction);
        const cells: CellPosition[] = [];
        let currentRow = rowIndex + path.start.row;
        let currentCol = colIndex + path.start.col;

        while (inBounds(crossword, currentRow, currentCol)) {
          if (imageAtCell(crossword.images, currentRow, currentCol)) break;

          const currentCell = crossword.cells[currentRow][currentCol];
          if (currentCell.type !== "letter") break;

          cells.push({ row: currentRow, col: currentCol });
          currentRow += path.step.row;
          currentCol += path.step.col;
        }

        answers.push({
          id: clue.id,
          clueId: clue.id,
          clueText: clue.text,
          clueCell: { row: rowIndex, col: colIndex },
          direction: clue.direction,
          cells,
          value: phraseWordValue(crossword, cells),
        });
      }
    });
  });

  return answers;
};

export const deriveImagePhrases = (crossword: Crossword): ImagePhrase[] => {
  const phrases: ImagePhrase[] = [];

  for (const image of crossword.images) {
    for (const arrow of image.arrows ?? []) {
      const start = imageArrowStart(image, arrow);
      const step = imagePhraseStep(arrow);
      const cells: CellPosition[] = [];
      const words: ImagePhraseWord[] = [];
      let currentWord: CellPosition[] = [];
      let currentRow = start.row;
      let currentCol = start.col;

      while (inBounds(crossword, currentRow, currentCol)) {
        if (imageAtCell(crossword.images, currentRow, currentCol)) break;

        const cell = crossword.cells[currentRow][currentCol];
        if (cell.type !== "letter") break;

        const beginsNewWord =
          cells.length > 0 &&
          (cell.wordStarts ?? []).includes(arrow.direction);

        if (beginsNewWord && currentWord.length > 0) {
          words.push({
            index: words.length,
            cells: currentWord,
            value: phraseWordValue(crossword, currentWord),
          });
          currentWord = [];
        }

        const position = { row: currentRow, col: currentCol };
        cells.push(position);
        currentWord.push(position);

        currentRow += step.row;
        currentCol += step.col;
      }

      if (currentWord.length > 0) {
        words.push({
          index: words.length,
          cells: currentWord,
          value: phraseWordValue(crossword, currentWord),
        });
      }

      phrases.push({
        id: "image-phrase:" + image.id + ":" + arrow.id,
        imageId: image.id,
        arrowId: arrow.id,
        direction: arrow.direction,
        start,
        cells,
        words,
        value: words.map((word) => word.value).join(" "),
        locked: Boolean(arrow.locked),
      });
    }
  }

  return phrases;
};

export const validateCrossword = (
  crossword: Crossword,
  answers: Answer[],
  imagePhrases: ImagePhrase[],
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const answerByClue = new Map(
    answers.map((answer) => [answer.clueId, answer]),
  );
  const phraseByArrow = new Map(
    imagePhrases.map((phrase) => [phrase.arrowId, phrase]),
  );

  crossword.cells.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const coveringImage = imageAtCell(crossword.images, rowIndex, colIndex);

      if (coveringImage && cell.type === "clue") {
        issues.push({
          id: "covered-clue:" + rowIndex + ":" + colIndex,
          severity: "error",
          message: "En bild täcker en ledtrådsruta.",
          cell: { row: rowIndex, col: colIndex },
        });
      }

      if (
        coveringImage &&
        cell.type === "letter" &&
        cell.value.trim().length > 0
      ) {
        issues.push({
          id: "covered-letter:" + rowIndex + ":" + colIndex,
          severity: "warning",
          message: "En bild täcker en redan ifylld bokstav.",
          cell: { row: rowIndex, col: colIndex },
        });
      }

      if (cell.type !== "clue" || coveringImage) return;

      const directionCounts = new Map<Direction, number>();
      for (const clue of cell.clues) {
        directionCounts.set(
          clue.direction,
          (directionCounts.get(clue.direction) ?? 0) + 1,
        );

        const answer = answerByClue.get(clue.id);
        if (!answer) continue;

        if (clue.text.trim().length === 0) {
          issues.push({
            id: "empty-clue:" + clue.id,
            severity: "warning",
            message:
              "Ledtråden " + directionText(clue.direction) + " saknar text.",
            cell: { row: rowIndex, col: colIndex },
            clueId: clue.id,
          });
        }

        if (answer.cells.length === 0) {
          issues.push({
            id: "no-answer:" + clue.id,
            severity: "error",
            message:
              "Ledtrådens pil " +
              directionText(clue.direction) +
              " leder inte till någon bokstavsruta.",
            cell: { row: rowIndex, col: colIndex },
            clueId: clue.id,
          });
        } else if (answer.cells.length === 1) {
          issues.push({
            id: "short-answer:" + clue.id,
            severity: "warning",
            message: "Svaret är bara en bokstav långt.",
            cell: { row: rowIndex, col: colIndex },
            clueId: clue.id,
          });
        }
      }

      for (const [direction, count] of directionCounts) {
        if (count > 1) {
          issues.push({
            id:
              "duplicate-direction:" +
              rowIndex +
              ":" +
              colIndex +
              ":" +
              direction,
            severity: "error",
            message:
              "Ledtrådsrutan har flera pilar " +
              directionText(direction) +
              ".",
            cell: { row: rowIndex, col: colIndex },
          });
        }
      }
    });
  });

  for (const image of crossword.images) {
    for (const arrow of image.arrows ?? []) {
      const phrase = phraseByArrow.get(arrow.id);
      if (!phrase) continue;

      if (!inBounds(crossword, phrase.start.row, phrase.start.col)) {
        issues.push({
          id: "image-phrase-outside:" + arrow.id,
          severity: "error",
          message: "En bildpil startar utanför korsordet.",
          cell: { row: image.row, col: image.col },
        });
      } else if (phrase.cells.length === 0) {
        issues.push({
          id: "image-phrase-blocked:" + arrow.id,
          severity: "error",
          message: "En bildpil leder inte till någon bokstavsruta.",
          cell: { row: image.row, col: image.col },
        });
      } else if (phrase.cells.length === 1) {
        issues.push({
          id: "image-phrase-short:" + arrow.id,
          severity: "warning",
          message: "Bildfrasen är bara en bokstav lång.",
          cell: { row: image.row, col: image.col },
        });
      }
    }
  }

  const phraseDirectionsByCell = new Map<string, Set<string>>();
  for (const phrase of imagePhrases) {
    for (const cell of phrase.cells) {
      const key = keyOf(cell.row, cell.col);
      const directions = phraseDirectionsByCell.get(key) ?? new Set<string>();
      directions.add(phrase.direction);
      phraseDirectionsByCell.set(key, directions);
    }
  }

  crossword.cells.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell.type !== "letter" || !cell.wordStarts?.length) return;
      const directions = phraseDirectionsByCell.get(keyOf(rowIndex, colIndex));

      for (const direction of cell.wordStarts) {
        if (directions?.has(direction)) continue;
        issues.push({
          id:
            "orphan-word-start:" +
            rowIndex +
            ":" +
            colIndex +
            ":" +
            direction,
          severity: "warning",
          message:
            "En ordstartspil används inte av någon bildfras " +
            (direction === "right" ? "åt höger." : "nedåt."),
          cell: { row: rowIndex, col: colIndex },
        });
      }
    });
  });

  return issues;
};

export const analyzeCrossword = (crossword: Crossword): CrosswordAnalysis => {
  const answers = deriveAnswers(crossword);
  const imagePhrases = deriveImagePhrases(crossword);
  const issues = validateCrossword(crossword, answers, imagePhrases);
  const answersByCell = new Map<string, Answer[]>();
  const answersByClueId = new Map<string, Answer>();
  const imagePhrasesByCell = new Map<string, ImagePhrase[]>();
  const imagePhrasesByArrowId = new Map<string, ImagePhrase>();
  const imagePhrasesByImageId = new Map<string, ImagePhrase[]>();

  for (const answer of answers) {
    answersByClueId.set(answer.clueId, answer);

    for (const cell of answer.cells) {
      const key = keyOf(cell.row, cell.col);
      const current = answersByCell.get(key) ?? [];
      current.push(answer);
      answersByCell.set(key, current);
    }
  }

  for (const phrase of imagePhrases) {
    imagePhrasesByArrowId.set(phrase.arrowId, phrase);

    const imageCurrent = imagePhrasesByImageId.get(phrase.imageId) ?? [];
    imageCurrent.push(phrase);
    imagePhrasesByImageId.set(phrase.imageId, imageCurrent);

    for (const cell of phrase.cells) {
      const key = keyOf(cell.row, cell.col);
      const current = imagePhrasesByCell.get(key) ?? [];
      current.push(phrase);
      imagePhrasesByCell.set(key, current);
    }
  }

  return {
    answers,
    imagePhrases,
    issues,
    answersByCell,
    answersByClueId,
    imagePhrasesByCell,
    imagePhrasesByArrowId,
    imagePhrasesByImageId,
  };
};

export const answerCellKey = (cell: CellPosition): string =>
  keyOf(cell.row, cell.col);
