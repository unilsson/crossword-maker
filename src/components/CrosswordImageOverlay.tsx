import { useEffect, useState } from "react";
import { loadImageAsset } from "../lib/imageStore";
import type { CrosswordImage } from "../types/crossword";

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
    </button>
  );
}
