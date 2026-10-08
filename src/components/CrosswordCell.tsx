import type { CSSProperties, MouseEvent } from "react";
import type { Cell } from "../types/crossword";

interface CrosswordCellProps {
  cell: Cell;
  row: number;
  col: number;
  gridWidth: number;
  gridHeight: number;
  covered: boolean;
  selected: boolean;
  highlighted: boolean;
  hasProblem: boolean;
  uppercaseClues: boolean;
  onSelect: () => void;
  onCycleType: () => void;
  onLetterChange: (value: string) => void;
}

const Arrow = ({ direction }: { direction: "right" | "down" }) => (
  <span className="clue-arrow" aria-hidden="true">{direction === "right" ? "→" : "↓"}</span>
);

export default function CrosswordCell({
  cell,
  row,
  col,
  gridWidth,
  gridHeight,
  covered,
  selected,
  highlighted,
  hasProblem,
  uppercaseClues,
  onSelect,
  onCycleType,
  onLetterChange,
}: CrosswordCellProps) {
  const className = [
    "crossword-cell",
    "crossword-cell--" + cell.type,
    covered ? "is-covered" : "",
    highlighted ? "is-answer-highlighted" : "",
    hasProblem ? "has-problem" : "",
    selected ? "is-selected" : "",
  ].filter(Boolean).join(" ");

  const style: CSSProperties = {
    left: (col / gridWidth) * 100 + "%",
    top: (row / gridHeight) * 100 + "%",
    width: 100 / gridWidth + "%",
    height: 100 / gridHeight + "%",
  };

  const onContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!covered) onCycleType();
  };

  const suffix = covered ? ", täcks av bild" : "";

  if (cell.type === "letter") {
    return (
      <div className={className} role="gridcell" style={style}
        aria-label={"Rad " + (row + 1) + ", kolumn " + (col + 1) + suffix}
        onClick={onSelect} onContextMenu={onContextMenu}>
        {!covered && (
          <input value={cell.value} maxLength={1} inputMode="text" aria-label="Bokstav"
            onFocus={onSelect} onChange={(event) => onLetterChange(event.target.value)} />
        )}
      </div>
    );
  }

  if (cell.type === "black") {
    return <div className={className} role="gridcell" style={style}
      aria-label={"Rad " + (row + 1) + ", kolumn " + (col + 1) + suffix}
      onClick={onSelect} onContextMenu={onContextMenu} />;
  }

  const orderedClues = [...cell.clues]
    .slice(0, 2)
    .sort((a, b) => {
      if (a.direction === b.direction) return 0;
      return a.direction === "right" ? -1 : 1;
    });

  return (
    <div className={className} role="gridcell" style={style}
      aria-label={"Rad " + (row + 1) + ", kolumn " + (col + 1) + suffix}
      onClick={onSelect} onContextMenu={onContextMenu}>
      {!covered && orderedClues.map((clue) => (
        <span className="clue-preview" key={clue.id}>
          <span>
            {uppercaseClues
              ? (clue.text || "Ledtråd").toLocaleUpperCase("sv-SE")
              : clue.text || "Ledtråd"}
          </span>
          <Arrow direction={clue.direction} />
        </span>
      ))}
    </div>
  );
}
