import type { Cell } from "../types/crossword";

interface CrosswordCellProps {
  cell: Cell;
  row: number;
  col: number;
  selected: boolean;
  onSelect: () => void;
  onCycleType: () => void;
  onLetterChange: (value: string) => void;
}

const Arrow = ({ direction }: { direction: "right" | "down" }) => (
  <span className="clue-arrow" aria-hidden="true">
    {direction === "right" ? "→" : "↓"}
  </span>
);

export default function CrosswordCell({
  cell,
  row,
  col,
  selected,
  onSelect,
  onCycleType,
  onLetterChange,
}: CrosswordCellProps) {
  const className = [
    "crossword-cell",
    "crossword-cell--" + cell.type,
    selected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const onContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    onCycleType();
  };

  if (cell.type === "letter") {
    return (
      <div
        className={className}
        role="gridcell"
        aria-label={"Rad " + (row + 1) + ", kolumn " + (col + 1) + ", bokstavsruta"}
        onClick={onSelect}
        onContextMenu={onContextMenu}
      >
        <input
          value={cell.value}
          maxLength={1}
          inputMode="text"
          aria-label="Bokstav"
          onFocus={onSelect}
          onChange={(event) => onLetterChange(event.target.value)}
        />
      </div>
    );
  }

  if (cell.type === "black") {
    return (
      <div
        className={className}
        role="gridcell"
        aria-label={"Rad " + (row + 1) + ", kolumn " + (col + 1) + ", svart ruta"}
        onClick={onSelect}
        onContextMenu={onContextMenu}
      />
    );
  }

  return (
    <div
      className={className}
      role="gridcell"
      aria-label={"Rad " + (row + 1) + ", kolumn " + (col + 1) + ", ledtrådsruta"}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      {cell.clues.slice(0, 2).map((clue) => (
        <span className="clue-preview" key={clue.id}>
          <span>{clue.text || "Ledtråd"}</span>
          <Arrow direction={clue.direction} />
        </span>
      ))}
    </div>
  );
}
