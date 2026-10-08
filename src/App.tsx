import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import CrosswordGrid from "./components/CrosswordGrid";
import { analyzeCrossword, answerCellKey } from "./lib/analysis";
import {
  addClue,
  clampImageToGrid,
  createEmptyCrossword,
  cycleCellType,
  imageAtCell,
  migrateCrossword,
  removeClue,
  setLetter,
  updateClue,
} from "./lib/crossword";
import { deleteImageAsset, saveImageAsset } from "./lib/imageStore";
import {
  buildLexicon,
  installSwedishWordList,
  isValidCrosswordWord,
  loadCachedWordList,
  loadCustomWords,
  normalizeCrosswordWord,
  saveCustomWords,
  searchWords,
  WORD_LIST_LICENSE,
  WORD_LIST_SOURCE_NAME,
} from "./lib/wordlist";
import type {
  Answer,
  Cell,
  Crossword,
  CrosswordImage,
  Direction,
  ImageFit,
} from "./types/crossword";
import type { WordLexicon, WordListDataset } from "./types/wordlist";

const STORAGE_KEY = "crossword-maker.current";

type Selection = { row: number; col: number } | null;
type ImageUploadMode = "add" | "replace";

const imagesOverlap = (a: CrosswordImage, b: CrosswordImage) =>
  a.id !== b.id &&
  a.row < b.row + b.rowSpan &&
  a.row + a.rowSpan > b.row &&
  a.col < b.col + b.colSpan &&
  a.col + a.colSpan > b.col;

const directionLabel = (direction: Direction) =>
  direction === "right" ? "→ Höger" : "↓ Nedåt";

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
  const [wordDataset, setWordDataset] = useState<WordListDataset | null>(null);
  const [lexicon, setLexicon] = useState<WordLexicon | null>(null);
  const [wordListState, setWordListState] = useState<
    "checking" | "not-installed" | "installing" | "ready" | "error"
  >("checking");
  const [wordListError, setWordListError] = useState("");
  const [customWords, setCustomWords] = useState<string[]>(() => loadCustomWords());
  const [customWordInput, setCustomWordInput] = useState("");
  const [activeAnswerId, setActiveAnswerId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(crossword));
  }, [crossword]);

  useEffect(() => {
    let cancelled = false;

    void loadCachedWordList()
      .then((dataset) => {
        if (cancelled) return;
        if (!dataset) {
          setWordListState("not-installed");
          return;
        }

        setWordDataset(dataset);
        setLexicon(buildLexicon(dataset.words));
        setWordListState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setWordListError(
          error instanceof Error ? error.message : "Kunde inte läsa ordlistan.",
        );
        setWordListState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const analysis = useMemo(() => analyzeCrossword(crossword), [crossword]);

  const selectedCell = useMemo(() => {
    if (!selected) return null;
    return crossword.cells[selected.row]?.[selected.col] ?? null;
  }, [crossword, selected]);

  const selectedImage = useMemo(
    () => crossword.images.find((image) => image.id === selectedImageId) ?? null,
    [crossword.images, selectedImageId],
  );

  const selectedAnswers = useMemo<Answer[]>(() => {
    if (!selected || !selectedCell || selectedImage) return [];

    if (selectedCell.type === "letter") {
      return analysis.answersByCell.get(answerCellKey(selected)) ?? [];
    }

    if (selectedCell.type === "clue") {
      return selectedCell.clues
        .map((clue) => analysis.answersByClueId.get(clue.id))
        .filter((answer): answer is Answer => Boolean(answer));
    }

    return [];
  }, [analysis, selected, selectedCell, selectedImage]);

  const activeAnswer =
    selectedAnswers.find((answer) => answer.id === activeAnswerId) ??
    selectedAnswers[0] ??
    null;

  const highlightedCells = useMemo(() => {
    const highlighted = new Set<string>();
    for (const answer of selectedAnswers) {
      for (const cell of answer.cells) {
        highlighted.add(answerCellKey(cell));
      }
    }
    return highlighted;
  }, [selectedAnswers]);

  const problemCells = useMemo(
    () =>
      new Set(
        analysis.issues.map((issue) => answerCellKey(issue.cell)),
      ),
    [analysis.issues],
  );

  const errorCount = analysis.issues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const warningCount = analysis.issues.filter(
    (issue) => issue.severity === "warning",
  ).length;

  const answerPattern = (answer: Answer) =>
    answer.cells
      .map(({ row, col }) => {
        const cell = crossword.cells[row][col];
        return cell.type === "letter" && cell.value ? cell.value : "·";
      })
      .join("");

  const answerSearchPattern = (answer: Answer) =>
    answer.cells
      .map(({ row, col }) => {
        const cell = crossword.cells[row][col];
        return cell.type === "letter" && cell.value ? cell.value : ".";
      })
      .join("");

  const wordSearch = useMemo(() => {
    if (!lexicon || !activeAnswer || activeAnswer.cells.length === 0) return null;
    return searchWords(
      lexicon,
      customWords,
      answerSearchPattern(activeAnswer),
      40,
    );
  }, [activeAnswer, crossword, customWords, lexicon]);

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

  const installWordList = async () => {
    setWordListState("installing");
    setWordListError("");

    try {
      const dataset = await installSwedishWordList();
      setWordDataset(dataset);
      setLexicon(buildLexicon(dataset.words));
      setWordListState("ready");
    } catch (error) {
      setWordListError(
        error instanceof Error ? error.message : "Kunde inte installera ordlistan.",
      );
      setWordListState("error");
    }
  };

  const addCustomWord = () => {
    const word = normalizeCrosswordWord(customWordInput);
    if (!isValidCrosswordWord(word)) {
      window.alert("Egna ord får bara innehålla A–Z samt Å, Ä och Ö.");
      return;
    }

    const next = Array.from(new Set([...customWords, word]));
    setCustomWords(next);
    saveCustomWords(next);
    setCustomWordInput("");
  };

  const clearCustomWords = () => {
    if (customWords.length === 0) return;
    if (!window.confirm("Ta bort alla egna ord ur ordlistan?")) return;
    setCustomWords([]);
    saveCustomWords([]);
  };

  const fillAnswer = (answer: Answer, word: string) => {
    if (word.length !== answer.cells.length) return;

    const letters = new Map<string, string>();
    answer.cells.forEach((cell, index) => {
      letters.set(answerCellKey(cell), word[index]);
    });

    setCrossword((current) => ({
      ...current,
      cells: current.cells.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const value = letters.get(rowIndex + ":" + colIndex);
          return value !== undefined && cell.type === "letter"
            ? { ...cell, value }
            : cell;
        }),
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
      window.alert(
        "Välj först den ruta där bildens övre vänstra hörn ska ligga.",
      );
      return;
    }

    const assetId = crypto.randomUUID();
    const image: CrosswordImage = clampImageToGrid(
      {
        id: crypto.randomUUID(),
        assetId,
        fileName: file.name,
        row: selected.row,
        col: selected.col,
        rowSpan: 3,
        colSpan: 3,
        fit: "cover",
        alt: "",
      },
      crossword.width,
      crossword.height,
    );

    if (crossword.images.some((existing) => imagesOverlap(image, existing))) {
      window.alert("Det finns redan en bild på den platsen.");
      return;
    }

    await saveImageAsset(assetId, file);
    setCrossword((current) => ({
      ...current,
      images: [...current.images, image],
    }));
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

  const selectIssue = (row: number, col: number) => {
    const image = imageAtCell(crossword.images, row, col);
    if (image) {
      setSelectedImageId(image.id);
      setSelected(null);
      return;
    }

    setSelectedImageId(null);
    setSelected({ row, col });
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
            Editor för svenska korsord med strukturanalys, ordlista, ledtrådar och bilder.
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
          <button
            type="button"
            className="secondary"
            onClick={() => {
              if (!selected) {
                window.alert("Välj först en ruta i korsordet.");
                return;
              }
              setImageUploadMode("add");
              imageInputRef.current?.click();
            }}
          >
            + Bild
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
          <input
            ref={imageInputRef}
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImageFile(file);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </header>

      <section className="workspace">
        <div className="board-panel">
          <div className="board-toolbar">
            <div className="board-toolbar-left">
              <span>
                {crossword.width} × {crossword.height}
              </span>
              <label className="toolbar-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(crossword.uppercaseClues)}
                  onChange={(event) =>
                    setCrossword((current) => ({
                      ...current,
                      uppercaseClues: event.target.checked,
                    }))
                  }
                />
                <span>Ledtrådar i VERSALER</span>
              </label>
            </div>
            <div className="analysis-status" aria-label="Korsordsstatus">
              <span className="status-ok">{analysis.answers.length} svar</span>
              {errorCount > 0 && (
                <span className="status-error">{errorCount} fel</span>
              )}
              {warningCount > 0 && (
                <span className="status-warning">{warningCount} varningar</span>
              )}
              {analysis.issues.length === 0 && (
                <span className="status-ok">✓ Inga problem</span>
              )}
            </div>
          </div>

          <CrosswordGrid
            crossword={crossword}
            selected={selectedImage ? null : selected}
            selectedImageId={selectedImageId}
            highlightedCells={highlightedCells}
            problemCells={problemCells}
            uppercaseClues={Boolean(crossword.uppercaseClues)}
            onSelect={(row, col) => {
              setSelected({ row, col });
              setSelectedImageId(null);
            }}
            onSelectImage={(imageId) => {
              setSelectedImageId(imageId);
              setSelected(null);
            }}
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

          <section className="problems-panel">
            <div className="problems-heading">
              <h2>Validering</h2>
              <span>
                {analysis.issues.length === 0
                  ? "Korsordsstrukturen ser bra ut."
                  : analysis.issues.length + " problem att kontrollera"}
              </span>
            </div>

            {analysis.issues.length > 0 && (
              <div className="problem-list">
                {analysis.issues.map((issue) => (
                  <button
                    type="button"
                    className={"problem-item problem-item--" + issue.severity}
                    key={issue.id}
                    onClick={() => selectIssue(issue.cell.row, issue.cell.col)}
                  >
                    <span className="problem-symbol">
                      {issue.severity === "error" ? "!" : "⚠"}
                    </span>
                    <span>
                      <strong>
                        Rad {issue.cell.row + 1}, kolumn {issue.cell.col + 1}
                      </strong>
                      <small>{issue.message}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="inspector">
          {selectedImage ? (
            <>
              <h2>Bild</h2>
              <p className="cell-position">{selectedImage.fileName}</p>

              <div className="image-size-grid">
                <label className="field">
                  <span>Rad</span>
                  <input
                    type="number"
                    min={1}
                    max={crossword.height}
                    value={selectedImage.row + 1}
                    onChange={(event) =>
                      updateSelectedImage({
                        row: Number(event.target.value) - 1,
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>Kolumn</span>
                  <input
                    type="number"
                    min={1}
                    max={crossword.width}
                    value={selectedImage.col + 1}
                    onChange={(event) =>
                      updateSelectedImage({
                        col: Number(event.target.value) - 1,
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>Höjd i rutor</span>
                  <input
                    type="number"
                    min={1}
                    value={selectedImage.rowSpan}
                    onChange={(event) =>
                      updateSelectedImage({
                        rowSpan: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>Bredd i rutor</span>
                  <input
                    type="number"
                    min={1}
                    value={selectedImage.colSpan}
                    onChange={(event) =>
                      updateSelectedImage({
                        colSpan: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>

              <label className="field">
                <span>Anpassning</span>
                <select
                  value={selectedImage.fit}
                  onChange={(event) =>
                    updateSelectedImage({
                      fit: event.target.value as ImageFit,
                    })
                  }
                >
                  <option value="cover">Fyll området (beskär)</option>
                  <option value="contain">Visa hela bilden</option>
                </select>
              </label>

              <label className="field">
                <span>Bildbeskrivning</span>
                <input
                  value={selectedImage.alt}
                  placeholder="T.ex. Ett gammalt lok"
                  onChange={(event) =>
                    updateSelectedImage({ alt: event.target.value })
                  }
                />
              </label>

              <div className="image-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setImageUploadMode("replace");
                    imageInputRef.current?.click();
                  }}
                >
                  Byt bild
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => void removeSelectedImage()}
                >
                  Ta bort bild
                </button>
              </div>

              <p className="hint">
                Bilder blockerar svar i ordanalysen. En ledtråd kan alltså inte
                löpa genom ett bildområde.
              </p>
            </>
          ) : !selected || !selectedCell ? (
            <>
              <h2>Ruta</h2>
              <p>Välj en ruta eller en bild i korsordet.</p>
            </>
          ) : (
            <>
              <h2>Ruta</h2>
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
                <>
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

                  <section className="answer-membership">
                    <h3>Tillhör svar</h3>
                    {selectedAnswers.length === 0 ? (
                      <p className="hint">
                        Rutan ingår ännu inte i något svar från en ledtråd.
                      </p>
                    ) : (
                      selectedAnswers.map((answer) => (
                        <div className="answer-card" key={answer.id}>
                          <strong>{directionLabel(answer.direction)}</strong>
                          <span>{answer.clueText || "Utan ledtrådstext"}</span>
                          <small>
                            {answer.cells.length} bokstäver ·{" "}
                            <code>{answerPattern(answer)}</code>
                          </small>
                        </div>
                      ))
                    )}
                  </section>
                </>
              )}

              {selectedCell.type === "black" && (
                <p className="hint">
                  Svarta rutor blockerar ord och används för att forma
                  korsordet.
                </p>
              )}

              {selectedCell.type === "clue" && (
                <div className="clue-editor">
                  {selectedCell.clues.map((clue, index) => {
                    const answer = analysis.answersByClueId.get(clue.id);
                    const clueIssues = analysis.issues.filter(
                      (issue) => issue.clueId === clue.id,
                    );

                    return (
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
                          <small>
                            Automatisk svensk avstavning används. Skriv | för
                            en egen avstavningspunkt, t.ex. männi|skans.
                          </small>
                        </label>

                        <label className="field">
                          <span>Pil</span>
                          <select
                            value={clue.direction}
                            onChange={(event) =>
                              updateSelectedCell((cell) =>
                                cell.type === "clue"
                                  ? updateClue(cell, clue.id, {
                                      direction: event.target
                                        .value as Direction,
                                    })
                                  : cell,
                              )
                            }
                          >
                            <option value="right">→ Höger</option>
                            <option value="down">↓ Nedåt</option>
                          </select>
                        </label>

                        {answer && (
                          <div className="answer-summary">
                            <span>
                              <strong>Svar:</strong> {answer.cells.length}{" "}
                              {answer.cells.length === 1
                                ? "bokstav"
                                : "bokstäver"}
                            </span>
                            <code>
                              {answer.cells.length > 0
                                ? answerPattern(answer)
                                : "—"}
                            </code>
                          </div>
                        )}

                        {clueIssues.map((issue) => (
                          <p
                            className={
                              "inline-issue inline-issue--" + issue.severity
                            }
                            key={issue.id}
                          >
                            {issue.message}
                          </p>
                        ))}
                      </div>
                    );
                  })}

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

          <section className="dictionary-panel">
            <div className="dictionary-heading">
              <div>
                <h2>Ordlista</h2>
                <p>
                  {wordListState === "ready" && wordDataset
                    ? wordDataset.words.length.toLocaleString("sv-SE") + " svenska ord"
                    : wordListState === "installing"
                      ? "Hämtar och indexerar ord…"
                      : wordListState === "checking"
                        ? "Kontrollerar lokal ordlista…"
                        : "Ingen svensk ordlista installerad"}
                </p>
              </div>

              {(wordListState === "not-installed" ||
                wordListState === "error") && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void installWordList()}
                >
                  Installera
                </button>
              )}

              {wordListState === "ready" && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void installWordList()}
                >
                  Uppdatera
                </button>
              )}
            </div>

            {wordListState === "error" && (
              <p className="inline-issue inline-issue--error">
                {wordListError || "Kunde inte läsa ordlistan."}
              </p>
            )}

            <p className="dictionary-source">
              Källa: {WORD_LIST_SOURCE_NAME} · {WORD_LIST_LICENSE}
            </p>

            <div className="custom-word-row">
              <input
                value={customWordInput}
                placeholder="Lägg till eget ord"
                aria-label="Eget ord"
                onChange={(event) => setCustomWordInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomWord();
                  }
                }}
              />
              <button type="button" onClick={addCustomWord}>
                Lägg till
              </button>
            </div>

            <div className="custom-word-meta">
              <span>{customWords.length} egna ord</span>
              {customWords.length > 0 && (
                <button
                  type="button"
                  className="text-button"
                  onClick={clearCustomWords}
                >
                  Rensa egna
                </button>
              )}
            </div>

            {activeAnswer && (
              <section className="candidate-section">
                <div className="candidate-heading">
                  <h3>Ordförslag</h3>
                  <code>{answerPattern(activeAnswer)}</code>
                </div>

                {selectedAnswers.length > 1 && (
                  <label className="field compact-field">
                    <span>Aktivt svar</span>
                    <select
                      value={activeAnswer.id}
                      onChange={(event) => setActiveAnswerId(event.target.value)}
                    >
                      {selectedAnswers.map((answer) => (
                        <option value={answer.id} key={answer.id}>
                          {directionLabel(answer.direction)} ·{" "}
                          {answer.clueText || "Utan ledtrådstext"}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {wordListState !== "ready" || !lexicon ? (
                  <p className="hint">
                    Installera ordlistan för att söka svenska ord som passar
                    bokstavsmönstret.
                  </p>
                ) : activeAnswer.cells.length === 0 ? (
                  <p className="hint">Ledtråden har inga svarsrutor.</p>
                ) : wordSearch && wordSearch.total > 0 ? (
                  <>
                    <p className="candidate-count">
                      {wordSearch.total.toLocaleString("sv-SE")} träffar
                      {wordSearch.total > wordSearch.matches.length
                        ? " · visar de första " + wordSearch.matches.length
                        : ""}
                    </p>
                    <div className="candidate-list">
                      {wordSearch.matches.map((candidate) => (
                        <button
                          type="button"
                          className="candidate-word"
                          key={candidate.source + ":" + candidate.word}
                          onClick={() => fillAnswer(activeAnswer, candidate.word)}
                          title={
                            candidate.source === "custom"
                              ? "Eget ord"
                              : WORD_LIST_SOURCE_NAME
                          }
                        >
                          <span>{candidate.word}</span>
                          <small>
                            {candidate.length} ·{" "}
                            {candidate.source === "custom" ? "eget" : "ordlista"}
                          </small>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="hint">
                    Inga ord i ordlistan matchar det aktuella mönstret.
                  </p>
                )}
              </section>
            )}
          </section>
        </aside>
      </section>

      <footer>
        Svar och validering räknas fram från rutnätet. Den svenska ordlistan
        cachas lokalt i IndexedDB och egna ord sparas i webbläsaren.
      </footer>
    </main>
  );
}
