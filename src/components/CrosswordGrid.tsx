import type { Cell, Crossword } from "../types/crossword";
import CrosswordCell from "./CrosswordCell";

interface CrosswordGridProps {
  crossword: Crossword;
  selected: { row: number; col: number } | null;
  onSelect: (row: number, col: number) => void;
  onChangeCell: (row: number, col: number, cell: Cell) => void;
  onCycleType: (row: number, col: number) => void;
}

export default function CrosswordGrid({
  crossword,
  selected,
  onSelect,
  onChangeCell,
  onCycleType,
}: CrosswordGridProps) {
  return (
    <div
      className="crossword-grid"
      style={{
        gridTemplateColumns: "repeat(" + crossword.width + ", minmax(0, 1fr))",
      }}
      role="grid"
      aria-label={crossword.title}
    >
      {crossword.cells.flatMap((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <CrosswordCell
            key={rowIndex + "-" + colIndex}
            cell={cell}
            row={rowIndex}
            col={colIndex}
            selected={
              selected?.row === rowIndex && selected?.col === colIndex
            }
            onSelect={() => onSelect(rowIndex, colIndex)}
            onCycleType={() => onCycleType(rowIndex, colIndex)}
            onLetterChange={(value) =>
              onChangeCell(
                rowIndex,
                colIndex,
                cell.type === "letter" ? { ...cell, value } : cell,
              )
            }
          />
        )),
      )}
    </div>
  );
}
