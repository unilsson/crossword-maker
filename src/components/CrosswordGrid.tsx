import { imageAtCell } from "../lib/crossword";
import type { Cell, Crossword } from "../types/crossword";
import CrosswordCell from "./CrosswordCell";
import CrosswordImageOverlay from "./CrosswordImageOverlay";

interface CrosswordGridProps {
  crossword: Crossword;
  selected: { row: number; col: number } | null;
  selectedImageId: string | null;
  onSelect: (row: number, col: number) => void;
  onSelectImage: (imageId: string) => void;
  onChangeCell: (row: number, col: number, cell: Cell) => void;
  onCycleType: (row: number, col: number) => void;
}

export default function CrosswordGrid({
  crossword, selected, selectedImageId, onSelect, onSelectImage, onChangeCell, onCycleType,
}: CrosswordGridProps) {
  return (
    <div className="crossword-grid-shell">
      <div className="crossword-grid" role="grid" aria-label={crossword.title}>
        {crossword.cells.flatMap((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const covered = Boolean(imageAtCell(crossword.images, rowIndex, colIndex));

            return (
              <CrosswordCell
                key={rowIndex + "-" + colIndex}
                cell={cell}
                row={rowIndex}
                col={colIndex}
                gridWidth={crossword.width}
                gridHeight={crossword.height}
                covered={covered}
                selected={selected?.row === rowIndex && selected?.col === colIndex}
                onSelect={() => { if (!covered) onSelect(rowIndex, colIndex); }}
                onCycleType={() => { if (!covered) onCycleType(rowIndex, colIndex); }}
                onLetterChange={(value) => {
                  if (covered) return;
                  onChangeCell(rowIndex, colIndex, cell.type === "letter" ? { ...cell, value } : cell);
                }}
              />
            );
          }),
        )}
      </div>

      <div className="crossword-image-layer" aria-hidden="false">
        {crossword.images.map((image) => (
          <CrosswordImageOverlay
            key={image.id}
            image={image}
            gridWidth={crossword.width}
            gridHeight={crossword.height}
            selected={selectedImageId === image.id}
            onSelect={() => onSelectImage(image.id)}
          />
        ))}
      </div>
    </div>
  );
}
