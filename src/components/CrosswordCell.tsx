import type { CSSProperties, MouseEvent } from "react";
import type {
  Cell,
  Direction,
  WordStartDirection,
} from "../types/crossword";

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

const arrowGeometry: Record<
  Direction,
  { viewBox: string; path: string }
> = {
  right: {
    viewBox: "0 0 20 24",
    path: "M1 12 H18 M14 8 L18 12 L14 16",
  },
  down: {
    viewBox: "0 0 24 20",
    path: "M12 1 V18 M8 14 L12 18 L16 14",
  },
  "right-down": {
    viewBox: "0 0 20 24",
    path: "M1 4 H12 Q14 4 14 6 V21 M10 17 L14 21 L18 17",
  },
  "down-right": {
    viewBox: "0 0 24 20",
    path: "M4 1 V12 Q4 14 6 14 H21 M17 10 L21 14 L17 18",
  },
  "right-down-plus-one": {
    viewBox: "0 0 20 30",
    path: "M0 0 L9 9 Q11 11 11 14 V26 M7 22 L11 26 L15 22",
  },
  "down-right-plus-one": {
    viewBox: "0 0 30 20",
    path: "M0 0 L9 9 Q11 11 14 11 H26 M22 7 L26 11 L22 15",
  },
};

const Arrow = ({ direction }: { direction: Direction }) => {
  const geometry = arrowGeometry[direction];

  return (
    <svg
      className={"clue-edge-arrow clue-edge-arrow--" + direction}
      viewBox={geometry.viewBox}
      aria-hidden="true"
      focusable="false"
    >
      <path d={geometry.path} />
    </svg>
  );
};

const WordStartMarker = ({
  direction,
}: {
  direction: WordStartDirection;
}) => (
  <svg
    className={"word-start-marker word-start-marker--" + direction}
    viewBox="0 0 20 20"
    aria-hidden="true"
    focusable="false"
  >
    {direction === "right" ? (
      <path d="M1 10 H17 M13 6 L17 10 L13 14" />
    ) : (
      <path d="M10 1 V17 M6 13 L10 17 L14 13" />
    )}
  </svg>
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
    ...(cell.fill ? { backgroundColor: cell.fill } : {}),
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
          <>
            {(cell.wordStarts ?? []).map((direction) => (
              <WordStartMarker key={direction} direction={direction} />
            ))}
            <input value={cell.value} maxLength={1} inputMode="text" aria-label="Bokstav"
              onFocus={onSelect} onChange={(event) => onLetterChange(event.target.value)} />
          </>
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
    "right" | "right-down" | "right-down-plus-one" | "down-right" | "down-right-plus-one" | "down",
    number
  > = {
    right: 0,
    "right-down": 1,
    "right-down-plus-one": 2,
    "down-right": 3,
    "down-right-plus-one": 4,
    down: 5,
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
