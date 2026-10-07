import { useEffect, useState } from "react";
import { loadImageAsset } from "../lib/imageStore";
import type { CrosswordImage } from "../types/crossword";

interface Props {
  image: CrosswordImage;
  selected: boolean;
  onSelect: () => void;
}

export default function CrosswordImageOverlay({ image, selected, onSelect }: Props) {
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

  return (
    <button
      type="button"
      className={"crossword-image" + (selected ? " is-selected" : "")}
      style={{
        gridRow: image.row + 1 + " / span " + image.rowSpan,
        gridColumn: image.col + 1 + " / span " + image.colSpan,
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
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
