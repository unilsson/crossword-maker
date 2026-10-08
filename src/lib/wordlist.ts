import type {
  WordCandidate,
  WordLexicon,
  WordListDataset,
  WordSearchResult,
} from "../types/wordlist";

export const WORD_LIST_SOURCE_NAME = "Martin Lindhes Swedish word list";
export const WORD_LIST_SOURCE_PAGE =
  "https://github.com/martinlindhe/wordlist_swedish";
export const WORD_LIST_SOURCE_URL =
  "https://raw.githubusercontent.com/martinlindhe/wordlist_swedish/master/swe_wordlist";
export const WORD_LIST_LICENSE = "MIT";

const DB_NAME = "crossword-maker-wordlist";
const DB_VERSION = 1;
const STORE_NAME = "datasets";
const DATASET_KEY = "swedish";
const CUSTOM_WORDS_KEY = "crossword-maker.custom-words";

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const getDataset = async (): Promise<WordListDataset | null> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(DATASET_KEY);

    request.onsuccess = () => {
      const value = request.result as WordListDataset | undefined;
      resolve(value?.version === 1 && Array.isArray(value.words) ? value : null);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
};

const putDataset = async (dataset: WordListDataset): Promise<void> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(dataset, DATASET_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
};

export const clearCachedWordList = async (): Promise<void> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(DATASET_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
};

export const normalizeCrosswordWord = (value: string): string =>
  value.normalize("NFC").trim().toLocaleUpperCase("sv-SE");

export const isValidCrosswordWord = (value: string): boolean =>
  /^[A-ZÅÄÖ]+$/.test(value);

const parseWordList = (text: string): string[] => {
  const seen = new Set<string>();
  const words: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const word = normalizeCrosswordWord(rawLine);
    if (!word || !isValidCrosswordWord(word) || seen.has(word)) continue;

    seen.add(word);
    words.push(word);
  }

  return words;
};

export const buildLexicon = (words: string[]): WordLexicon => {
  const byLength = new Map<number, string[]>();

  for (const word of words) {
    const bucket = byLength.get(word.length);
    if (bucket) bucket.push(word);
    else byLength.set(word.length, [word]);
  }

  return { words, byLength };
};

export const loadCachedWordList = async (): Promise<WordListDataset | null> =>
  getDataset();

export const installSwedishWordList = async (): Promise<WordListDataset> => {
  const response = await fetch(WORD_LIST_SOURCE_URL, { cache: "no-cache" });

  if (!response.ok) {
    throw new Error(
      "Kunde inte hämta ordlistan (" +
        response.status +
        " " +
        response.statusText +
        ").",
    );
  }

  const words = parseWordList(await response.text());
  if (words.length < 100_000) {
    throw new Error(
      "Ordlistan såg oväntat liten ut och sparades därför inte.",
    );
  }

  const dataset: WordListDataset = {
    version: 1,
    sourceName: WORD_LIST_SOURCE_NAME,
    sourceUrl: WORD_LIST_SOURCE_PAGE,
    license: WORD_LIST_LICENSE,
    fetchedAt: new Date().toISOString(),
    words,
  };

  await putDataset(dataset);
  return dataset;
};

export const loadCustomWords = (): string[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_WORDS_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return Array.from(
      new Set(
        parsed
          .filter((value): value is string => typeof value === "string")
          .map(normalizeCrosswordWord)
          .filter(isValidCrosswordWord),
      ),
    );
  } catch {
    return [];
  }
};

export const saveCustomWords = (words: string[]): void => {
  localStorage.setItem(CUSTOM_WORDS_KEY, JSON.stringify(words));
};

const matchesPattern = (word: string, pattern: string): boolean => {
  if (word.length !== pattern.length) return false;

  for (let index = 0; index < pattern.length; index += 1) {
    const expected = pattern[index];
    if (expected !== "." && word[index] !== expected) return false;
  }

  return true;
};

export const searchWords = (
  lexicon: WordLexicon,
  customWords: string[],
  pattern: string,
  limit = 40,
): WordSearchResult => {
  const normalizedPattern = normalizeCrosswordWord(pattern).replace(/[^A-ZÅÄÖ.]/g, ".");
  const length = normalizedPattern.length;
  const baseWords = lexicon.byLength.get(length) ?? [];
  const customSet = new Set(
    customWords
      .map(normalizeCrosswordWord)
      .filter((word) => word.length === length && isValidCrosswordWord(word)),
  );

  const matches: WordCandidate[] = [];
  let total = 0;
  const seen = new Set<string>();

  for (const word of customSet) {
    if (!matchesPattern(word, normalizedPattern)) continue;
    total += 1;
    seen.add(word);
    if (matches.length < limit) {
      matches.push({ word, length, source: "custom" });
    }
  }

  for (const word of baseWords) {
    if (seen.has(word) || !matchesPattern(word, normalizedPattern)) continue;
    total += 1;
    if (matches.length < limit) {
      matches.push({ word, length, source: "swedish-wordlist" });
    }
  }

  return { total, matches };
};
