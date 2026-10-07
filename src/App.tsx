import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import CrosswordGrid from "./components/CrosswordGrid";
import {
  addClue,
  clampImageToGrid,
  createEmptyCrossword,
  cycleCellType,
  migrateCrossword,
  removeClue,
  setLetter,
  updateClue,
} from "./lib/crossword";
import { deleteImageAsset, saveImageAsset } from "./lib/imageStore";
import type { Cell, Crossword, CrosswordImage, Direction, ImageFit } from "./types/crossword";

const STORAGE_KEY = "crossword-maker.current";

type Selection = { row: number; col: number } | null;
type ImageUploadMode = "add" | "replace";

const imagesOverlap = (a: CrosswordImage, b: CrosswordImage) =>
  a.id !== b.id &&
  a.row < b.row + b.rowSpan &&
  a.row + a.rowSpan > b.row &&
  a.col < b.col + b.colSpan &&
  a.col + a.colSpan > b.col;

export default function App() {
  const [crossword, setCrossword] = useState<Crossword>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return createEmptyCrossword();

    try {
      const parsed: unknown = JSON.parse(saved);
      return migrateCrossword(parsed) ?? createEmptyCrossword();
    } catch {
      return createEmptyCrossword();
    }
  });

  const [selected, setSelected] = useState<Selection>({ row: 0, col: 0 });
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [imageUploadMode, setImageUploadMode] = useState<ImageUploadMode>("add");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(crossword));
  }, [crossword]);

  const selectedCell = useMemo(() => {
    if (!selected) return null;
    return crossword.cells[selected.row]?.[selected.col] ?? null;
  }, [crossword, selected]);

  const selectedImage = useMemo(
    () => crossword.images.find((image) => image.id === selectedImageId) ?? null,
    [crossword.images, selectedImageId],
  );

  const updateCell = (row: number, col: number, nextCell: Cell) => {
    setCrossword((current) => ({
      ...current,
      cells: current.cells.map((currentRow, rowIndex) =>
        rowIndex === row
          ? currentRow.map((cell, colIndex) =>
              colIndex === col ? nextCell : cell,
            )
          : currentRow,
      ),
    }));
  };

  const updateSelectedCell = (updater: (cell: Cell) => Cell) => {
    if (!selected || !selectedCell || selectedImage) return;
    updateCell(selected.row, selected.col, updater(selectedCell));
  };

  const updateSelectedImage = (patch: Partial<CrosswordImage>) => {
    if (!selectedImage) return;

    const candidate = clampImageToGrid(
      { ...selectedImage, ...patch },
      crossword.width,
      crossword.height,
    );

    if (crossword.images.some((image) => imagesOverlap(candidate, image))) {
      window.alert("Bilden kan inte överlappa en annan bild.");
      return;
    }

    setCrossword((current) => ({
      ...current,
      images: current.images.map((image) =>
        image.id === candidate.id ? candidate : image,
      ),
    }));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!selected || selectedImage) return;

    const target = event.target;
    if (
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLInputElement && !target.closest(".crossword-cell"))
    ) {
      return;
    }

    if (/^[a-zåäöA-ZÅÄÖ]$/.test(event.key) && selectedCell?.type === "letter") {
      event.preventDefault();
      updateSelectedCell((cell) => setLetter(cell, event.key));
      const nextCol = Math.min(crossword.width - 1, selected.col + 1);
      setSelected({ row: selected.row, col: nextCol });
      return;
    }

    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    };
    const move = moves[event.key];
    if (!move) return;

    event.preventDefault();
    setSelected({
      row: Math.max(0, Math.min(crossword.height - 1, selected.row + move[0])),
      col: Math.max(0, Math.min(crossword.width - 1, selected.col + move[1])),
    });
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(crossword, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeTitle = crossword.title.trim().replace(/\s+/g, "-").toLowerCase() || "korsord";
    anchor.href = url;
    anchor.download = safeTitle + ".json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const loadJson = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const migrated = migrateCrossword(parsed);
      if (!migrated) {
        window.alert("Filen ser inte ut som ett Crossword Maker-projekt.");
        return;
      }
      setCrossword(migrated);
      setSelected({ row: 0, col: 0 });
      setSelectedImageId(null);
    } catch {
      window.alert("Kunde inte läsa JSON-filen.");
    }
  };

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      window.alert("Välj en bildfil.");
      return;
    }

    if (imageUploadMode === "replace" && selectedImage) {
      const newAssetId = crypto.randomUUID();
      await saveImageAsset(newAssetId, file);
      const oldAssetId = selectedImage.assetId;
      updateSelectedImage({ assetId: newAssetId, fileName: file.name });
      await deleteImageAsset(oldAssetId);
      return;
    }

    if (!selected) {
      window.alert("Välj först den ruta där bildens övre vänstra hörn ska ligga.");
      return;
    }

    const assetId = crypto.randomUUID();
    const image: CrosswordImage = clampImageToGrid({
      id: crypto.randomUUID(),
      assetId,
      fileName: file.name,
      row: selected.row,
      col: selected.col,
      rowSpan: 3,
      colSpan: 3,
      fit: "cover",
      alt: "",
    }, crossword.width, crossword.height);

    if (crossword.images.some((existing) => imagesOverlap(image, existing))) {
      window.alert("Det finns redan en bild på den platsen.");
      return;
    }

    await saveImageAsset(assetId, file);
    setCrossword((current) => ({ ...current, images: [...current.images, image] }));
    setSelectedImageId(image.id);
  };

  const removeSelectedImage = async () => {
    if (!selectedImage) return;
    const image = selectedImage;
    setCrossword((current) => ({
      ...current,
      images: current.images.filter((item) => item.id !== image.id),
    }));
    setSelectedImageId(null);
    await deleteImageAsset(image.assetId);
  };

  const reset = () => {
    if (!window.confirm("Skapa ett nytt tomt 15×15-korsord?")) return;
    setCrossword(createEmptyCrossword());
    setSelected({ row: 0, col: 0 });
    setSelectedImageId(null);
  };

  return (
    <main className="app-shell" tabIndex={-1} onKeyDown={handleKeyDown}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Crossword Maker</p>
          <input className="title-input" value={crossword.title} aria-label="Korsordets titel"
            onChange={(event) => setCrossword((current) => ({ ...current, title: event.target.value }))} />
          <p className="subtitle">Editor för svenska korsord med ledtrådar och bilder i rutnätet.</p>
        </div>

        <div className="header-actions">
          <button type="button" className="secondary" onClick={reset}>Nytt</button>
          <button type="button" className="secondary" onClick={() => fileInputRef.current?.click()}>Ladda JSON</button>
          <button type="button" className="secondary" onClick={() => {
            if (!selected) { window.alert("Välj först en ruta i korsordet."); return; }
            setImageUploadMode("add");
            imageInputRef.current?.click();
          }}>+ Bild</button>
          <button type="button" onClick={downloadJson}>Spara JSON</button>
          <input ref={fileInputRef} className="sr-only" type="file" accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void loadJson(file);
              event.currentTarget.value = "";
            }} />
          <input ref={imageInputRef} className="sr-only" type="file" accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImageFile(file);
              event.currentTarget.value = "";
            }} />
        </div>
      </header>

      <section className="workspace">
        <div className="board-panel">
          <div className="board-toolbar">
            <span>{crossword.width} × {crossword.height}</span>
            <span>Välj ruta och klicka + Bild för att placera en bild</span>
          </div>

          <CrosswordGrid
            crossword={crossword}
            selected={selectedImage ? null : selected}
            selectedImageId={selectedImageId}
            onSelect={(row, col) => { setSelected({ row, col }); setSelectedImageId(null); }}
            onSelectImage={(imageId) => { setSelectedImageId(imageId); setSelected(null); }}
            onChangeCell={(row, col, cell) =>
              updateCell(row, col, cell.type === "letter" ? setLetter(cell, cell.value) : cell)
            }
            onCycleType={(row, col) => updateCell(row, col, cycleCellType(crossword.cells[row][col]))}
          />
        </div>

        <aside className="inspector">
          {selectedImage ? (
            <>
              <h2>Bild</h2>
              <p className="cell-position">{selectedImage.fileName}</p>

              <div className="image-size-grid">
                <label className="field"><span>Rad</span><input type="number" min={1} max={crossword.height}
                  value={selectedImage.row + 1}
                  onChange={(event) => updateSelectedImage({ row: Number(event.target.value) - 1 })} /></label>
                <label className="field"><span>Kolumn</span><input type="number" min={1} max={crossword.width}
                  value={selectedImage.col + 1}
                  onChange={(event) => updateSelectedImage({ col: Number(event.target.value) - 1 })} /></label>
                <label className="field"><span>Höjd i rutor</span><input type="number" min={1}
                  value={selectedImage.rowSpan}
                  onChange={(event) => updateSelectedImage({ rowSpan: Number(event.target.value) })} /></label>
                <label className="field"><span>Bredd i rutor</span><input type="number" min={1}
                  value={selectedImage.colSpan}
                  onChange={(event) => updateSelectedImage({ colSpan: Number(event.target.value) })} /></label>
              </div>

              <label className="field"><span>Anpassning</span>
                <select value={selectedImage.fit}
                  onChange={(event) => updateSelectedImage({ fit: event.target.value as ImageFit })}>
                  <option value="cover">Fyll området (beskär)</option>
                  <option value="contain">Visa hela bilden</option>
                </select>
              </label>

              <label className="field"><span>Bildbeskrivning</span>
                <input value={selectedImage.alt} placeholder="T.ex. Ett gammalt lok"
                  onChange={(event) => updateSelectedImage({ alt: event.target.value })} />
              </label>

              <div className="image-actions">
                <button type="button" className="secondary" onClick={() => {
                  setImageUploadMode("replace");
                  imageInputRef.current?.click();
                }}>Byt bild</button>
                <button type="button" className="danger" onClick={() => void removeSelectedImage()}>Ta bort bild</button>
              </div>

              <p className="hint">Bildfilen lagras lokalt i webbläsarens IndexedDB. JSON-filen innehåller bara bildreferensen.</p>
            </>
          ) : !selected || !selectedCell ? (
            <>
              <h2>Ruta</h2>
              <p>Välj en ruta eller en bild i korsordet.</p>
            </>
          ) : (
            <>
              <h2>Ruta</h2>
              <p className="cell-position">Rad {selected.row + 1}, kolumn {selected.col + 1}</p>

              <div className="segmented" aria-label="Ruttyp">
                {(["letter", "black", "clue"] as const).map((type) => (
                  <button type="button" key={type} className={selectedCell.type === type ? "active" : ""}
                    onClick={() => {
                      if (type === "letter") updateSelectedCell(() => ({ type: "letter", value: "" }));
                      else if (type === "black") updateSelectedCell(() => ({ type: "black" }));
                      else updateSelectedCell(() => ({ type: "clue", clues: [{ id: crypto.randomUUID(), text: "", direction: "right" }] }));
                    }}>
                    {type === "letter" ? "Bokstav" : type === "black" ? "Svart" : "Ledtråd"}
                  </button>
                ))}
              </div>

              {selectedCell.type === "letter" && (
                <label className="field"><span>Bokstav</span>
                  <input maxLength={1} value={selectedCell.value}
                    onChange={(event) => updateSelectedCell((cell) => setLetter(cell, event.target.value))} />
                  <small>Stöd för A–Z samt Å, Ä och Ö.</small>
                </label>
              )}

              {selectedCell.type === "black" && <p className="hint">Svarta rutor blockerar ord och används för att forma korsordet.</p>}

              {selectedCell.type === "clue" && (
                <div className="clue-editor">
                  {selectedCell.clues.map((clue, index) => (
                    <div className="clue-block" key={clue.id}>
                      <div className="clue-block-header"><strong>Ledtråd {index + 1}</strong>
                        {selectedCell.clues.length > 1 && (
                          <button type="button" className="text-button"
                            onClick={() => updateSelectedCell((cell) => cell.type === "clue" ? removeClue(cell, clue.id) : cell)}>Ta bort</button>
                        )}
                      </div>
                      <label className="field"><span>Text</span>
                        <textarea rows={3} value={clue.text} placeholder="Skriv ledtråden…"
                          onChange={(event) => updateSelectedCell((cell) => cell.type === "clue" ? updateClue(cell, clue.id, { text: event.target.value }) : cell)} />
                      </label>
                      <label className="field"><span>Pil</span>
                        <select value={clue.direction}
                          onChange={(event) => updateSelectedCell((cell) => cell.type === "clue" ? updateClue(cell, clue.id, { direction: event.target.value as Direction }) : cell)}>
                          <option value="right">→ Höger</option>
                          <option value="down">↓ Nedåt</option>
                        </select>
                      </label>
                    </div>
                  ))}
                  {selectedCell.clues.length < 2 && (
                    <button type="button" className="secondary full-width"
                      onClick={() => updateSelectedCell((cell) => cell.type === "clue" ? addClue(cell) : cell)}>+ Lägg till andra ledtråden</button>
                  )}
                </div>
              )}
            </>
          )}
        </aside>
      </section>

      <footer>Projektet sparas automatiskt i webbläsaren. Bilder lagras lokalt i IndexedDB; exportera JSON för projektets struktur och metadata.</footer>
    </main>
  );
}
