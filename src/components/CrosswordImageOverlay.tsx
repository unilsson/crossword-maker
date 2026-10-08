import { useEffect, useState } from "react";
import { loadImageAsset } from "../lib/imageStore";
import type {
  CSSProperties,
} from "react";
import type {
  CrosswordImage,
  ImageArrow,
} from "../types/crossword";

const arrowStyle = (
  arrow: ImageArrow,
  image: CrosswordImage,
): CSSProperties => {
  const cellWidth = 100 / image.colSpan;
  const cellHeight = 100 / image.rowSpan;

  if (arrow.edge === "bottom") {
    return {
      left: (arrow.offset + 0.5) * cellWidth + "%",
      top: "100%",
      width: (arrow.direction === "right" ? cellWidth * 1.15 : cellWidth * 0.45) + "%",
      height:
        cellHeight *
          Math.max(0.8, arrow.distance + (arrow.direction === "right" ? 0.65 : 0.85)) +
        "%",
      transform: "translateX(-1px)",
    };
  }

  return {
    left: "100%",
    top: (arrow.offset + 0.5) * cellHeight + "%",
    width:
      cellWidth *
        Math.max(0.8, arrow.distance + (arrow.direction === "down" ? 0.65 : 0.85)) +
      "%",
    height: (arrow.direction === "down" ? cellHeight * 1.15 : cellHeight * 0.45) + "%",
    transform: "translateY(-1px)",
  };
};

const imageArrowPath = (arrow: ImageArrow): string => {
  if (arrow.edge === "bottom" && arrow.direction === "down") {
    return "M10 0 V88 M4 80 L10 88 L16 80";
  }

  if (arrow.edge === "bottom" && arrow.direction === "right") {
    return "M2 0 V68 Q2 78 12 78 H90 M82 70 L90 78 L82 86";
  }

  if (arrow.edge === "right" && arrow.direction === "right") {
    return "M0 10 H88 M80 4 L88 10 L80 16";
  }

  return "M0 2 H68 Q78 2 78 12 V90 M70 82 L78 90 L86 82";
};

interface Props {
  image: CrosswordImage;
  gridWidth: number;
  gridHeight: number;
  selected: boolean;
  onSelect: () => void;
}

export default function CrosswordImageOverlay({
  image, gridWidth, gridHeight, selected, onSelect,
}: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    void loadImageAsset(image.assetId).then((blob) => {
      if (!blob || cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.assetId]);

  const left = (image.col / gridWidth) * 100;
  const top = (image.row / gridHeight) * 100;
  const width = (image.colSpan / gridWidth) * 100;
  const height = (image.rowSpan / gridHeight) * 100;

  return (
    <button
      type="button"
      className={"crossword-image" + (selected ? " is-selected" : "")}
      style={{
        left: left + "%",
        top: top + "%",
        width: width + "%",
        height: height + "%",
      }}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
      aria-label={image.alt || image.fileName || "Bild i korsordet"}
      title={image.fileName}
    >
      {src ? (
        <img src={src} alt={image.alt} style={{ objectFit: image.fit }} draggable={false} />
      ) : (
        <span>Bild saknas lokalt</span>
      )}

      {(image.arrows ?? []).map((arrow) => (
        <svg
          key={arrow.id}
          className="image-exit-arrow"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={arrowStyle(arrow, image)}
          aria-hidden="true"
          focusable="false"
        >
          <path d={imageArrowPath(arrow)} />
        </svg>
      ))}
    </button>
  );
}
