import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import CrosswordGrid from "./components/CrosswordGrid";
import {
  addClue,
  createEmptyCrossword,
  cycleCellType,
  isCrossword,
  removeClue,
  setLetter,
  updateClue,
} from "./lib/crossword";
import type { Cell, Crossword, Direction } from "./types/crossword";

const STORAGE_KEY = "crossword-maker.current";

type Selection = { row: number; col: number } | null;

export default function App() {
  const [crossword, setCrossword] = useState<Crossword>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return createEmptyCrossword();

    try {
      const parsed: unknown = JSON.parse(saved);
      return isCrossword(parsed) ? parsed : createEmptyCrossword();
    } catch {
      return createEmptyCrossword();
    }
  });

  const [selected, setSelected] = useState<Selection>({ row: 0, col: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(crossword));
  }, [crossword]);

  const selectedCell = useMemo(() => {
    if (!selected) return null;
    return crossword.cells[selected.row]?.[selected.col] ?? null;
  }, [crossword, selected]);

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
    if (!selected || !selectedCell) return;
    updateCell(selected.row, selected.col, updater(selectedCell));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!selected) return;

    const target = event.target;
    if (
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLInputElement && !target.closest(".crossword-cell"))
    ) {
      return;
    }

    if (
      /^[a-zåäöA-ZÅÄÖ]$/.test(event.key) &&
      selectedCell?.type === "letter"
    ) {
      event.preventDefault();
      updateSelectedCell((cell) => setLetter(cell, event.key));

      const nextCol = Math.min(crossword.width - 1, selected.col + 1);
      setSelected({ row: selected.row, col: nextCol });
      return;
    }

    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
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
    const blob = new Blob([JSON.stringify(crossword, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeTitle =
      crossword.title.trim().replace(/\s+/g, "-").toLowerCase() || "korsord";

    anchor.href = url;
    anchor.download = safeTitle + ".json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const loadJson = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isCrossword(parsed)) {
        window.alert("Filen ser inte ut som ett Crossword Maker-projekt.");
        return;
      }

      setCrossword(parsed);
      setSelected({ row: 0, col: 0 });
    } catch {
      window.alert("Kunde inte läsa JSON-filen.");
    }
  };

  const reset = () => {
    if (!window.confirm("Skapa ett nytt tomt 15×15-korsord?")) return;
    setCrossword(createEmptyCrossword());
    setSelected({ row: 0, col: 0 });
  };

  return (
    <main className="app-shell" tabIndex={-1} onKeyDown={handleKeyDown}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Crossword Maker</p>
          <input
            className="title-input"
            value={crossword.title}
            aria-label="Korsordets titel"
            onChange={(event) =>
              setCrossword((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
          />
          <p className="subtitle">
            Editor för svenska korsord med ledtrådar i rutnätet.
          </p>
        </div>

        <div className="header-actions">
          <button type="button" className="secondary" onClick={reset}>
            Nytt
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Ladda JSON
          </button>
          <button type="button" onClick={downloadJson}>
            Spara JSON
          </button>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void loadJson(file);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </header>

      <section className="workspace">
        <div className="board-panel">
          <div className="board-toolbar">
            <span>{crossword.width} × {crossword.height}</span>
            <span>Högerklicka en ruta för att växla typ</span>
          </div>

          <CrosswordGrid
            crossword={crossword}
            selected={selected}
            onSelect={(row, col) => setSelected({ row, col })}
            onChangeCell={(row, col, cell) =>
              updateCell(
                row,
                col,
                cell.type === "letter" ? setLetter(cell, cell.value) : cell,
              )
            }
            onCycleType={(row, col) =>
              updateCell(row, col, cycleCellType(crossword.cells[row][col]))
            }
          />
        </div>

        <aside className="inspector">
          <h2>Ruta</h2>

          {!selected || !selectedCell ? (
            <p>Välj en ruta i korsordet.</p>
          ) : (
            <>
              <p className="cell-position">
                Rad {selected.row + 1}, kolumn {selected.col + 1}
              </p>

              <div className="segmented" aria-label="Ruttyp">
                {(["letter", "black", "clue"] as const).map((type) => (
                  <button
                    type="button"
                    key={type}
                    className={selectedCell.type === type ? "active" : ""}
                    onClick={() => {
                      if (type === "letter") {
                        updateSelectedCell(() => ({
                          type: "letter",
                          value: "",
                        }));
                      } else if (type === "black") {
                        updateSelectedCell(() => ({ type: "black" }));
                      } else {
                        updateSelectedCell(() => ({
                          type: "clue",
                          clues: [
                            {
                              id: crypto.randomUUID(),
                              text: "",
                              direction: "right",
                            },
                          ],
                        }));
                      }
                    }}
                  >
                    {type === "letter"
                      ? "Bokstav"
                      : type === "black"
                        ? "Svart"
                        : "Ledtråd"}
                  </button>
                ))}
              </div>

              {selectedCell.type === "letter" && (
                <label className="field">
                  <span>Bokstav</span>
                  <input
                    maxLength={1}
                    value={selectedCell.value}
                    onChange={(event) =>
                      updateSelectedCell((cell) =>
                        setLetter(cell, event.target.value),
                      )
                    }
                  />
                  <small>Stöd för A–Z samt Å, Ä och Ö.</small>
                </label>
              )}

              {selectedCell.type === "black" && (
                <p className="hint">
                  Svarta rutor blockerar ord och används för att forma
                  korsordet.
                </p>
              )}

              {selectedCell.type === "clue" && (
                <div className="clue-editor">
                  {selectedCell.clues.map((clue, index) => (
                    <div className="clue-block" key={clue.id}>
                      <div className="clue-block-header">
                        <strong>Ledtråd {index + 1}</strong>
                        {selectedCell.clues.length > 1 && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() =>
                              updateSelectedCell((cell) =>
                                cell.type === "clue"
                                  ? removeClue(cell, clue.id)
                                  : cell,
                              )
                            }
                          >
                            Ta bort
                          </button>
                        )}
                      </div>

                      <label className="field">
                        <span>Text</span>
                        <textarea
                          rows={3}
                          value={clue.text}
                          placeholder="Skriv ledtråden…"
                          onChange={(event) =>
                            updateSelectedCell((cell) =>
                              cell.type === "clue"
                                ? updateClue(cell, clue.id, {
                                    text: event.target.value,
                                  })
                                : cell,
                            )
                          }
                        />
                      </label>

                      <label className="field">
                        <span>Pil</span>
                        <select
                          value={clue.direction}
                          onChange={(event) =>
                            updateSelectedCell((cell) =>
                              cell.type === "clue"
                                ? updateClue(cell, clue.id, {
                                    direction: event.target.value as Direction,
                                  })
                                : cell,
                            )
                          }
                        >
                          <option value="right">→ Höger</option>
                          <option value="down">↓ Nedåt</option>
                        </select>
                      </label>
                    </div>
                  ))}

                  {selectedCell.clues.length < 2 && (
                    <button
                      type="button"
                      className="secondary full-width"
                      onClick={() =>
                        updateSelectedCell((cell) =>
                          cell.type === "clue" ? addClue(cell) : cell,
                        )
                      }
                    >
                      + Lägg till andra ledtråden
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </aside>
      </section>

      <footer>
        Projektet sparas automatiskt i webbläsaren. Exportera JSON för backup
        eller versionshantering.
      </footer>
    </main>
  );
}
