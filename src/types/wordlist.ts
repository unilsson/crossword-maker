export type WordSource = "swedish-wordlist" | "custom";

export interface WordCandidate {
  word: string;
  length: number;
  source: WordSource;
}

export interface WordListDataset {
  version: 1;
  sourceName: string;
  sourceUrl: string;
  license: string;
  fetchedAt: string;
  words: string[];
}

export interface WordLexicon {
  words: string[];
  byLength: Map<number, string[]>;
}

export interface WordSearchResult {
  total: number;
  matches: WordCandidate[];
}
