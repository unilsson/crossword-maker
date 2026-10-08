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

const Arrow = ({ direction }: { direction: "right" | "down" | "right-down" | "down-right" | "down-right-plus-one" }) => (
  <span
    className={"clue-edge-arrow clue-edge-arrow--" + direction}
    aria-hidden="true"
  />
);

const formatClueText = (text: string, uppercase: boolean) => {
  const displayText = text || "Ledtråd";
  const casedText = uppercase
    ? displayText.toLocaleUpperCase("sv-SE")
    : displayText;

  return casedText.replace(/\|/g, "\u00AD");
};

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

  const directionOrder: Record<
    "right" | "right-down" | "down-right" | "down-right-plus-one" | "down",
    number
  > = {
    right: 0,
    "right-down": 1,
    "down-right": 2,
    "down-right-plus-one": 3,
    down: 4,
  };

  const orderedClues = [...cell.clues]
    .slice(0, 2)
    .sort((a, b) => directionOrder[a.direction] - directionOrder[b.direction]);

  return (
    <div className={className} role="gridcell" style={style}
      aria-label={"Rad " + (row + 1) + ", kolumn " + (col + 1) + suffix}
      onClick={onSelect} onContextMenu={onContextMenu}>
      {!covered && orderedClues.map((clue) => (
        <span className="clue-preview" key={clue.id}>
          <span
            lang="sv"
            className={clue.text.includes("|") ? "has-manual-hyphens" : undefined}
          >
            {formatClueText(clue.text, uppercaseClues)}
          </span>
          <Arrow direction={clue.direction} />
        </span>
      ))}
    </div>
  );
}
