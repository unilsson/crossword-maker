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
import { deleteImageAsset, saveImageAsset, syncImageAssets } from "./lib/imageStore";
import { listProjects, getProject, createProject, saveProject, removeProject } from "./lib/projects";
import type { ProjectSummary } from "./lib/projects";
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
  ImageArrow,
  ImageArrowDirection,
  ImageArrowEdge,
  ImagePhrase,
  ImagePhraseWord,
  WordStartDirection,
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

const toggleWordStart = (
  cell: Cell,
  direction: WordStartDirection,
): Cell => {
  if (cell.type !== "letter") return cell;

  const current = new Set(cell.wordStarts ?? []);
  if (current.has(direction)) current.delete(direction);
  else current.add(direction);

  const wordStarts = Array.from(current);
  return {
    ...cell,
    wordStarts: wordStarts.length > 0 ? wordStarts : undefined,
  };
};

const directionLabel = (direction: Direction) => {
  if (direction === "right") return "→ Höger";
  if (direction === "right-down") return "↳ Höger–nedåt";
  if (direction === "right-down-plus-one") return "↳ Höger–nedåt +1";
  if (direction === "down-right") return "↳ Nedåt–höger";
  if (direction === "down-right-plus-one") return "↳ Nedåt–höger +1";
  return "↓ Nedåt";
};

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

  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [saveStatus, setSaveStatus] = useState("Lokalt utkast – inte sparat på servern");
  const [projectBusy, setProjectBusy] = useState(false);
  const projectIdRef = useRef<string | null>(null);
  const crosswordRef = useRef(crossword);
  crosswordRef.current = crossword;
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadProjects = async () => setProjects(await listProjects());
  const persist = async () => {
    const id = projectIdRef.current;
    if (!id) return;
    const snapshot = crosswordRef.current;
    const next = writeQueue.current.then(async () => {
      await saveProject(id, snapshot);
    });
    writeQueue.current = next.catch(() => undefined);
    await next;
    setSaveStatus("Sparat på servern");
    await loadProjects();
  };
  const flush = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await persist();
  };
  const openProject = async (id: string) => {
    setProjectBusy(true);
    try {
      await flush();
      const document = await getProject(id);
      const migrated = migrateCrossword(document);
      if (!migrated) throw new Error("Ogiltigt korsord.");
      projectIdRef.current = id;
      setProjectId(id);
      crosswordRef.current = migrated;
      await createServerProject(migrated);
      setSelected({ row: 0, col: 0 });
      setSelectionAnchor({ row: 0, col: 0 });
      setSelectedImageId(null);
      setSaveStatus("Sparat på servern");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Kunde inte öppna projektet.");
    } finally { setProjectBusy(false); }
  };
  const createServerProject = async (document: Crossword) => {
    setProjectBusy(true);
    try {
      await flush();
      await syncImageAssets(document.images.map(image => image.assetId));
      const created = await createProject(document);
      projectIdRef.current = created.id;
      setProjectId(created.id);
      crosswordRef.current = document;
      setCrossword(document);
      setSaveStatus("Sparat på servern");
      await loadProjects();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Kunde inte skapa projektet.");
    } finally { setProjectBusy(false); }
  };
  useEffect(() => {
    void loadProjects().catch(() => setSaveStatus("Servern kan inte nås."));
  }, []);

  const [selected, setSelected] = useState<Selection>({ row: 0, col: 0 });
  const [selectionAnchor, setSelectionAnchor] = useState<Selection>({
    row: 0,
    col: 0,
  });
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
    if (!projectId) return;
    setSaveStatus("Ändringar väntar på att sparas…");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist().catch((error: unknown) =>
        setSaveStatus("Sparfel: " + (error instanceof Error ? error.message : "okänt fel"))
      );
    }, 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [crossword, projectId]);

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

  const selectedRange = useMemo(() => {
    if (!selected) return [] as { row: number; col: number }[];
    if (!selectionAnchor) return [selected];

    if (selectionAnchor.row === selected.row) {
      const start = Math.min(selectionAnchor.col, selected.col);
      const end = Math.max(selectionAnchor.col, selected.col);
      return Array.from({ length: end - start + 1 }, (_, index) => ({
        row: selected.row,
        col: start + index,
      }));
    }

    if (selectionAnchor.col === selected.col) {
      const start = Math.min(selectionAnchor.row, selected.row);
      const end = Math.max(selectionAnchor.row, selected.row);
      return Array.from({ length: end - start + 1 }, (_, index) => ({
        row: start + index,
        col: selected.col,
      }));
    }

    return [selected];
  }, [selected, selectionAnchor]);

  const selectedRangeKeys = useMemo(
    () => new Set(selectedRange.map((cell) => answerCellKey(cell))),
    [selectedRange],
  );

  const selectionHasFill = useMemo(
    () =>
      selectedRange.some(
        ({ row, col }) => Boolean(crossword.cells[row]?.[col]?.fill),
      ),
    [crossword, selectedRange],
  );

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

  const selectedCellImagePhrases = useMemo<ImagePhrase[]>(() => {
    if (!selected || selectedCell?.type !== "letter" || selectedImage) return [];
    return analysis.imagePhrasesByCell.get(answerCellKey(selected)) ?? [];
  }, [analysis, selected, selectedCell, selectedImage]);

  const selectedImagePhrases = useMemo<ImagePhrase[]>(
    () =>
      selectedImage
        ? analysis.imagePhrasesByImageId.get(selectedImage.id) ?? []
        : [],
    [analysis, selectedImage],
  );

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
    for (const phrase of selectedCellImagePhrases) {
      for (const cell of phrase.cells) {
        highlighted.add(answerCellKey(cell));
      }
    }
    for (const phrase of selectedImagePhrases) {
      for (const cell of phrase.cells) {
        highlighted.add(answerCellKey(cell));
      }
    }
    return highlighted;
  }, [selectedAnswers, selectedCellImagePhrases, selectedImagePhrases]);

  const lockedCellKeys = useMemo(() => {
    const locked = new Set<string>();
    const lockedAnswerIds = new Set(crossword.lockedAnswerIds ?? []);

    for (const answer of analysis.answers) {
      if (!lockedAnswerIds.has(answer.id)) continue;
      for (const cell of answer.cells) locked.add(answerCellKey(cell));
    }

    for (const phrase of analysis.imagePhrases) {
      if (!phrase.locked) continue;
      for (const cell of phrase.cells) locked.add(answerCellKey(cell));
    }

    return locked;
  }, [analysis.answers, analysis.imagePhrases, crossword.lockedAnswerIds]);

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

  const cellsPattern = (
    cells: { row: number; col: number }[],
    blank = "·",
  ) =>
    cells
      .map(({ row, col }) => {
        const cell = crossword.cells[row][col];
        return cell.type === "letter" && cell.value ? cell.value : blank;
      })
      .join("");

  const answerPattern = (answer: Answer) => cellsPattern(answer.cells);
  const answerSearchPattern = (answer: Answer) =>
    cellsPattern(answer.cells, ".");

  const imagePhrasePattern = (phrase: ImagePhrase) =>
    phrase.words.map((word) => cellsPattern(word.cells)).join(" ");

  const imagePhraseWordSearch = (word: ImagePhraseWord) =>
    lexicon
      ? searchWords(lexicon, customWords, cellsPattern(word.cells, "."), 12)
      : null;

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

  const selectCell = (row: number, col: number, extend = false) => {
    const next = { row, col };

    if (
      extend &&
      selectionAnchor &&
      (selectionAnchor.row === row || selectionAnchor.col === col)
    ) {
      setSelected(next);
    } else {
      setSelected(next);
      setSelectionAnchor(next);
    }

    setSelectedImageId(null);
  };

  const applyFillToSelection = (fill?: string) => {
    if (selectedRange.length === 0 || selectedImage) return;
    const keys = new Set(selectedRange.map((cell) => answerCellKey(cell)));

    setCrossword((current) => ({
      ...current,
      cells: current.cells.map((row, rowIndex) =>
        row.map((cell, colIndex) =>
          keys.has(rowIndex + ":" + colIndex)
            ? { ...cell, fill }
            : cell,
        ),
      ),
    }));
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

  const addImageArrow = () => {
    if (!selectedImage) return;

    const arrow: ImageArrow = {
      id: crypto.randomUUID(),
      edge: "bottom",
      offset: 0,
      direction: "right",
      distance: 0,
      locked: false,
    };

    updateSelectedImage({
      arrows: [...(selectedImage.arrows ?? []), arrow],
    });
  };

  const updateImageArrow = (
    arrowId: string,
    patch: Partial<
      Pick<ImageArrow, "edge" | "offset" | "direction" | "distance" | "locked">
    >,
  ) => {
    if (!selectedImage) return;

    updateSelectedImage({
      arrows: (selectedImage.arrows ?? []).map((arrow) =>
        arrow.id === arrowId ? { ...arrow, ...patch } : arrow,
      ),
    });
  };

  const removeImageArrow = (arrowId: string) => {
    if (!selectedImage) return;
    updateSelectedImage({
      arrows: (selectedImage.arrows ?? []).filter(
        (arrow) => arrow.id !== arrowId,
      ),
    });
  };

  const toggleAnswerLock = (answerId: string) => {
    setCrossword((current) => {
      const locked = new Set(current.lockedAnswerIds ?? []);
      if (locked.has(answerId)) locked.delete(answerId);
      else locked.add(answerId);
      return { ...current, lockedAnswerIds: Array.from(locked) };
    });
  };

  const toggleImagePhraseLock = (arrowId: string) => {
    const owner = crossword.images.find((image) =>
      (image.arrows ?? []).some((arrow) => arrow.id === arrowId),
    );
    const arrow = owner?.arrows?.find((item) => item.id === arrowId);
    if (!owner || !arrow) return;

    setCrossword((current) => ({
      ...current,
      images: current.images.map((image) =>
        image.id === owner.id
          ? {
              ...image,
              arrows: (image.arrows ?? []).map((item) =>
                item.id === arrowId
                  ? { ...item, locked: !Boolean(item.locked) }
                  : item,
              ),
            }
          : image,
      ),
    }));
  };

  const fillCells = (
    cells: { row: number; col: number }[],
    word: string,
    ownerLocked = false,
  ) => {
    if (ownerLocked || word.length !== cells.length) return false;

    const conflict = cells.some(({ row, col }, index) => {
      const key = row + ":" + col;
      if (!lockedCellKeys.has(key)) return false;
      const cell = crossword.cells[row][col];
      return cell.type !== "letter" || cell.value !== word[index];
    });

    if (conflict) {
      window.alert(
        "Kan inte fylla eftersom en korsande låst fras eller ett låst svar skulle ändras.",
      );
      return false;
    }

    const letters = new Map<string, string>();
    cells.forEach((cell, index) => {
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
    return true;
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

  const fillAnswer = (answer: Answer, word: string) =>
    fillCells(
      answer.cells,
      word,
      (crossword.lockedAnswerIds ?? []).includes(answer.id),
    );

  const fillImagePhraseWord = (
    phrase: ImagePhrase,
    word: ImagePhraseWord,
    value: string,
  ) => fillCells(word.cells, value, phrase.locked);

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
      if (lockedCellKeys.has(answerCellKey(selected))) return;
      updateSelectedCell((cell) => setLetter(cell, event.key));
      const nextCol = Math.min(crossword.width - 1, selected.col + 1);
      const next = { row: selected.row, col: nextCol };
      setSelected(next);
      setSelectionAnchor(next);
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
    const next = {
      row: Math.max(0, Math.min(crossword.height - 1, selected.row + move[0])),
      col: Math.max(0, Math.min(crossword.width - 1, selected.col + move[1])),
    };
    setSelected(next);
    setSelectionAnchor(next);
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
      setSelectionAnchor({ row: 0, col: 0 });
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
        arrows: [],
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
      setSelectionAnchor(null);
      return;
    }

    setSelectedImageId(null);
    setSelected({ row, col });
    setSelectionAnchor({ row, col });
  };

  const reset = async () => {
    if (!window.confirm("Skapa ett nytt tomt 15×15-korsord?")) return;
    await createServerProject(createEmptyCrossword());
    setSelected({ row: 0, col: 0 });
    setSelectionAnchor({ row: 0, col: 0 });
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

      <section className="project-bar" aria-label="Projekt">
        <label htmlFor="saved-projects">Sparade korsord</label>
        <select id="saved-projects" value={projectId ?? ""} disabled={projectBusy}
          onChange={event => { if (event.target.value) void openProject(event.target.value); }}>
          <option value="">Lokalt utkast – välj ett projekt</option>
          {projects.map(project => <option key={project.id} value={project.id}>
            {project.title || "Namnlöst"} – {new Date(project.updatedAt).toLocaleString("sv-SE")}
          </option>)}
        </select>
        <button type="button" disabled={projectBusy}
          onClick={() => void createServerProject(crossword)}>Spara som nytt projekt</button>
        <button type="button" disabled={!projectId || projectBusy}
          onClick={() => void flush().catch(error => setSaveStatus("Sparfel: " + String(error)))}>Spara nu</button>
        <button type="button" disabled={!projectId || projectBusy}
          onClick={() => {
            if (!projectId || !window.confirm("Ta bort detta korsord från servern?")) return;
            void (async () => {
              setProjectBusy(true);
              try {
                await flush();
                await removeProject(projectId);
                projectIdRef.current = null;
                setProjectId(null);
                setSaveStatus("Projekt borttaget – lokalt utkast kvar.");
                await loadProjects();
              } catch (error) {
                window.alert(String(error));
              } finally { setProjectBusy(false); }
            })();
          }}>Ta bort</button>
        <span role="status">{saveStatus}</span>
      </section>
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
              <span className="status-ok">
                {analysis.imagePhrases.length} bildfraser
              </span>
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
            selectedRangeCells={selectedImage ? new Set<string>() : selectedRangeKeys}
            selectedImageId={selectedImageId}
            highlightedCells={highlightedCells}
            problemCells={problemCells}
            lockedCells={lockedCellKeys}
            uppercaseClues={Boolean(crossword.uppercaseClues)}
            onSelect={(row, col, extend) => {
              selectCell(row, col, extend);
            }}
            onSelectImage={(imageId) => {
              setSelectedImageId(imageId);
              setSelected(null);
              setSelectionAnchor(null);
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

              <section className="image-arrow-editor">
                <div className="image-arrow-heading">
                  <div>
                    <strong>Pilar från bilden</strong>
                    <p className="hint">
                      Varje pil definierar nu en riktig bildfras. Frasen börjar
                      efter pilens avstånd och fortsätter genom bokstavsrutor
                      tills något blockerar.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={addImageArrow}
                  >
                    + Pil
                  </button>
                </div>

                {(selectedImage.arrows ?? []).length === 0 ? (
                  <p className="hint">
                    Inga bildfraser ännu. Lägg till en pil för att skapa en
                    semantisk fras från bilden.
                  </p>
                ) : (
                  <div className="image-arrow-list">
                    {(selectedImage.arrows ?? []).map((arrow, index) => {
                      const maxOffset =
                        arrow.edge === "bottom"
                          ? selectedImage.colSpan
                          : selectedImage.rowSpan;

                      return (
                        <div className="image-arrow-item" key={arrow.id}>
                          <div className="image-arrow-item-header">
                            <strong>Pil {index + 1}</strong>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => removeImageArrow(arrow.id)}
                            >
                              Ta bort
                            </button>
                          </div>

                          <div className="image-arrow-grid">
                            <label className="field">
                              <span>Kant</span>
                              <select
                                value={arrow.edge}
                                onChange={(event) =>
                                  updateImageArrow(arrow.id, {
                                    edge: event.target.value as ImageArrowEdge,
                                    offset: 0,
                                  })
                                }
                              >
                                <option value="bottom">Underkant</option>
                                <option value="right">Högerkant</option>
                              </select>
                            </label>

                            <label className="field">
                              <span>Position</span>
                              <input
                                type="number"
                                min={1}
                                max={maxOffset}
                                value={arrow.offset + 1}
                                onChange={(event) =>
                                  updateImageArrow(arrow.id, {
                                    offset: Math.max(
                                      0,
                                      Number(event.target.value) - 1,
                                    ),
                                  })
                                }
                              />
                            </label>

                            <label className="field">
                              <span>Pekar</span>
                              <select
                                value={arrow.direction}
                                onChange={(event) =>
                                  updateImageArrow(arrow.id, {
                                    direction: event.target
                                      .value as ImageArrowDirection,
                                  })
                                }
                              >
                                <option value="right">→ Höger</option>
                                <option value="down">↓ Nedåt</option>
                              </select>
                            </label>

                            <label className="field">
                              <span>Avstånd till start</span>
                              <input
                                type="number"
                                min={0}
                                max={4}
                                value={arrow.distance}
                                onChange={(event) =>
                                  updateImageArrow(arrow.id, {
                                    distance: Math.max(
                                      0,
                                      Math.min(
                                        4,
                                        Number(event.target.value),
                                      ),
                                    ),
                                  })
                                }
                              />
                            </label>
                          </div>

                          {(() => {
                            const phrase =
                              analysis.imagePhrasesByArrowId.get(arrow.id);
                            if (!phrase) return null;

                            return (
                              <section className="image-phrase-summary">
                                <div className="image-phrase-summary-heading">
                                  <div>
                                    <strong>Bildfras</strong>
                                    <code>
                                      {phrase.cells.length > 0
                                        ? imagePhrasePattern(phrase)
                                        : "—"}
                                    </code>
                                  </div>
                                  <button
                                    type="button"
                                    className="text-button"
                                    onClick={() =>
                                      toggleImagePhraseLock(arrow.id)
                                    }
                                  >
                                    {phrase.locked ? "🔓 Lås upp" : "🔒 Lås"}
                                  </button>
                                </div>

                                <small>
                                  {phrase.cells.length} bokstäver ·{" "}
                                  {phrase.words.length}{" "}
                                  {phrase.words.length === 1 ? "ord" : "ord"}
                                </small>

                                {phrase.words.map((word) => {
                                  const search = imagePhraseWordSearch(word);
                                  const best = search?.matches[0];

                                  return (
                                    <div
                                      className="image-phrase-word"
                                      key={phrase.id + ":" + word.index}
                                    >
                                      <div className="image-phrase-word-heading">
                                        <span>Ord {word.index + 1}</span>
                                        <code>{cellsPattern(word.cells)}</code>
                                      </div>

                                      {wordListState !== "ready" || !lexicon ? (
                                        <p className="hint">
                                          Installera ordlistan för förslag.
                                        </p>
                                      ) : search && search.total > 0 ? (
                                        <>
                                          <div className="image-phrase-word-actions">
                                            <small>
                                              {search.total.toLocaleString(
                                                "sv-SE",
                                              )}{" "}
                                              träffar
                                            </small>
                                            {best && !phrase.locked && (
                                              <button
                                                type="button"
                                                className="secondary compact-action"
                                                onClick={() =>
                                                  fillImagePhraseWord(
                                                    phrase,
                                                    word,
                                                    best.word,
                                                  )
                                                }
                                              >
                                                Fyll bästa: {best.word}
                                              </button>
                                            )}
                                          </div>
                                          <div className="phrase-candidate-list">
                                            {search.matches
                                              .slice(0, 6)
                                              .map((candidate) => (
                                                <button
                                                  type="button"
                                                  key={
                                                    candidate.source +
                                                    ":" +
                                                    candidate.word
                                                  }
                                                  disabled={phrase.locked}
                                                  onClick={() =>
                                                    fillImagePhraseWord(
                                                      phrase,
                                                      word,
                                                      candidate.word,
                                                    )
                                                  }
                                                >
                                                  {candidate.word}
                                                </button>
                                              ))}
                                          </div>
                                        </>
                                      ) : (
                                        <p className="hint">
                                          Inga ord matchar mönstret.
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </section>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

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
                        updateSelectedCell((cell) => ({
                          type: "letter",
                          value: "",
                          ...(cell.fill ? { fill: cell.fill } : {}),
                        }));
                      } else if (type === "black") {
                        updateSelectedCell((cell) => ({
                          type: "black",
                          ...(cell.fill ? { fill: cell.fill } : {}),
                        }));
                      } else {
                        updateSelectedCell((cell) => ({
                          type: "clue",
                          clues: [
                            {
                              id: crypto.randomUUID(),
                              text: "",
                              direction: "right",
                            },
                          ],
                          ...(cell.fill ? { fill: cell.fill } : {}),
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

              <section className="cell-color-section">
                <div className="cell-color-heading">
                  <div>
                    <strong>
                      {selectedRange.length > 1
                        ? selectedRange.length + " rutors färg"
                        : "Rutans färg"}
                    </strong>
                    <small>
                      Shift-klicka en annan ruta i samma rad eller kolumn för
                      att markera ett sammanhängande område.
                    </small>
                  </div>
                  {selectionHasFill && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => applyFillToSelection(undefined)}
                    >
                      Ingen färg
                    </button>
                  )}
                </div>

                <div className="cell-color-controls">
                  <input
                    className="cell-color-picker"
                    type="color"
                    aria-label="Markerade rutors färg"
                    value={selectedCell.fill ?? "#fff2a8"}
                    onChange={(event) =>
                      applyFillToSelection(event.target.value)
                    }
                  />
                  <div className="cell-color-presets" aria-label="Färgförslag">
                    {["#fff2a8", "#dceeff", "#f8dfe8", "#e4f1df"].map(
                      (color) => (
                        <button
                          type="button"
                          className="cell-color-swatch"
                          key={color}
                          aria-label={"Välj färg " + color}
                          title={color}
                          style={{ backgroundColor: color }}
                          onClick={() => applyFillToSelection(color)}
                        />
                      ),
                    )}
                  </div>
                </div>

                {selectedRange.length > 1 && (
                  <p className="range-selection-summary">
                    {selectionAnchor?.row === selected?.row
                      ? "Vågrät markering"
                      : "Lodrät markering"}{" "}
                    · {selectedRange.length} rutor
                  </p>
                )}
              </section>

              {selectedCell.type === "letter" && (
                <>
                  <label className="field">
                    <span>Bokstav</span>
                    <input
                      maxLength={1}
                      value={selectedCell.value}
                      disabled={lockedCellKeys.has(answerCellKey(selected!))}
                      onChange={(event) =>
                        updateSelectedCell((cell) =>
                          setLetter(cell, event.target.value),
                        )
                      }
                    />
                    <small>
                      {lockedCellKeys.has(answerCellKey(selected!))
                        ? "Rutan är låst av ett svar eller en bildfras."
                        : "Stöd för A–Z samt Å, Ä och Ö."}
                    </small>
                  </label>

                  <section className="word-start-section">
                    <div>
                      <strong>Ordgräns i bildfras</strong>
                      <p className="hint">
                        Pilarna betyder bara nytt ord och stoppar inte frasen.
                      </p>
                    </div>
                    <div className="word-start-buttons">
                      {(["right", "down"] as WordStartDirection[]).map(
                        (direction) => {
                          const active = (selectedCell.wordStarts ?? []).includes(
                            direction,
                          );
                          return (
                            <button
                              type="button"
                              key={direction}
                              className={active ? "active" : "secondary"}
                              onClick={() =>
                                updateSelectedCell((cell) =>
                                  toggleWordStart(cell, direction),
                                )
                              }
                            >
                              {direction === "right"
                                ? "→ Nytt ord åt höger"
                                : "↓ Nytt ord nedåt"}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </section>

                  {selectedCellImagePhrases.length > 0 && (
                    <section className="answer-membership">
                      <h3>Tillhör bildfras</h3>
                      {selectedCellImagePhrases.map((phrase) => (
                        <div className="answer-card" key={phrase.id}>
                          <strong>
                            Bildfras · {phrase.direction === "right" ? "→" : "↓"}
                            {phrase.locked ? " · 🔒" : ""}
                          </strong>
                          <span>{imagePhrasePattern(phrase) || "—"}</span>
                          <small>
                            {phrase.words.length}{" "}
                            {phrase.words.length === 1 ? "ord" : "ord"} ·{" "}
                            {phrase.cells.length} bokstäver
                          </small>
                        </div>
                      ))}
                    </section>
                  )}

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
                            <option value="right-down">↳ Höger–nedåt</option>
                            <option value="right-down-plus-one">
                              ↳ Höger–nedåt +1
                            </option>
                            <option value="down-right">↳ Nedåt–höger</option>
                            <option value="down-right-plus-one">
                              ↳ Nedåt–höger +1
                            </option>
                            <option value="down">↓ Nedåt</option>
                          </select>
                        </label>

                        {answer && (
                          <div className="answer-summary answer-summary--with-lock">
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
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => toggleAnswerLock(answer.id)}
                            >
                              {(crossword.lockedAnswerIds ?? []).includes(answer.id)
                                ? "🔓 Lås upp"
                                : "🔒 Lås"}
                            </button>
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
                  <div>
                    <h3>Ordförslag</h3>
                    <code>{answerPattern(activeAnswer)}</code>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => toggleAnswerLock(activeAnswer.id)}
                  >
                    {(crossword.lockedAnswerIds ?? []).includes(activeAnswer.id)
                      ? "🔓 Lås upp"
                      : "🔒 Lås"}
                  </button>
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
                    <div className="candidate-actions-row">
                      <p className="candidate-count">
                        {wordSearch.total.toLocaleString("sv-SE")} träffar
                        {wordSearch.total > wordSearch.matches.length
                          ? " · visar de första " + wordSearch.matches.length
                          : ""}
                      </p>
                      {wordSearch.matches[0] &&
                        !(crossword.lockedAnswerIds ?? []).includes(
                          activeAnswer.id,
                        ) && (
                          <button
                            type="button"
                            className="secondary compact-action"
                            onClick={() =>
                              fillAnswer(activeAnswer, wordSearch.matches[0].word)
                            }
                          >
                            Fyll bästa
                          </button>
                        )}
                    </div>
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
        Svar, bildfraser och validering räknas fram från rutnätet. Låsningar
        sparas i projektet. Den svenska ordlistan cachas lokalt i IndexedDB.
      </footer>
    </main>
  );
}
