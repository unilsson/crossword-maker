import { imageAtCell } from "./crossword";
import type {
  Answer,
  CellPosition,
  Crossword,
  Direction,
  ValidationIssue,
} from "../types/crossword";

const stepForDirection = (direction: Direction): CellPosition =>
  direction === "right" ? { row: 0, col: 1 } : { row: 1, col: 0 };

const keyOf = (row: number, col: number) => row + ":" + col;

export interface CrosswordAnalysis {
  answers: Answer[];
  issues: ValidationIssue[];
  answersByCell: Map<string, Answer[]>;
  answersByClueId: Map<string, Answer>;
}

export const deriveAnswers = (crossword: Crossword): Answer[] => {
  const answers: Answer[] = [];

  crossword.cells.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell.type !== "clue") return;
      if (imageAtCell(crossword.images, rowIndex, colIndex)) return;

      for (const clue of cell.clues) {
        const step = stepForDirection(clue.direction);
        const cells: CellPosition[] = [];
        let currentRow = rowIndex + step.row;
        let currentCol = colIndex + step.col;

        while (
          currentRow >= 0 &&
          currentRow < crossword.height &&
          currentCol >= 0 &&
          currentCol < crossword.width
        ) {
          if (imageAtCell(crossword.images, currentRow, currentCol)) break;

          const currentCell = crossword.cells[currentRow][currentCol];
          if (currentCell.type !== "letter") break;

          cells.push({ row: currentRow, col: currentCol });
          currentRow += step.row;
          currentCol += step.col;
        }

        answers.push({
          id: clue.id,
          clueId: clue.id,
          clueText: clue.text,
          clueCell: { row: rowIndex, col: colIndex },
          direction: clue.direction,
          cells,
          value: cells
            .map(({ row, col }) => {
              const answerCell = crossword.cells[row][col];
              return answerCell.type === "letter" ? answerCell.value : "";
            })
            .join(""),
        });
      }
    });
  });

  return answers;
};

export const validateCrossword = (
  crossword: Crossword,
  answers: Answer[],
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const answerByClue = new Map(answers.map((answer) => [answer.clueId, answer]));

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
              "Ledtråden " +
              (clue.direction === "right" ? "åt höger" : "nedåt") +
              " saknar text.",
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
              (clue.direction === "right" ? "åt höger" : "nedåt") +
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
              (direction === "right" ? "åt höger." : "nedåt."),
            cell: { row: rowIndex, col: colIndex },
          });
        }
      }
    });
  });

  return issues;
};

export const analyzeCrossword = (crossword: Crossword): CrosswordAnalysis => {
  const answers = deriveAnswers(crossword);
  const issues = validateCrossword(crossword, answers);
  const answersByCell = new Map<string, Answer[]>();
  const answersByClueId = new Map<string, Answer>();

  for (const answer of answers) {
    answersByClueId.set(answer.clueId, answer);

    for (const cell of answer.cells) {
      const key = keyOf(cell.row, cell.col);
      const current = answersByCell.get(key) ?? [];
      current.push(answer);
      answersByCell.set(key, current);
    }
  }

  return { answers, issues, answersByCell, answersByClueId };
};

export const answerCellKey = (cell: CellPosition): string =>
  keyOf(cell.row, cell.col);
