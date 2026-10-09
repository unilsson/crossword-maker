import { XMLParser, XMLValidator } from "fast-xml-parser";

export const SWESAURUS_URL =
  "https://svn.spraakbanken.gu.se/sb-arkiv/pub/lmf/swesaurus/swesaurus.xml";
export const SWESAURUS_PAGE = "https://spraakbanken.gu.se/resurser/swesaurus";
export const SWESAURUS_LICENSE = "CC BY 4.0";

const many = (value) => value === undefined || value === null ? [] :
  Array.isArray(value) ? value : [value];
const normalize = (value) => String(value ?? "").normalize("NFC").trim().toLocaleUpperCase("sv-SE");
const crosswordWord = (value) => /^[A-ZÅÄÖ]{2,50}$/.test(value);

/** Read either LMF feat att/val or newer attribute-based WN-LMF. */
const feature = (node, key) => {
  if (!node || typeof node !== "object") return null;
  const direct = node["@_" + key] ?? node[key];
  if (typeof direct === "string" || typeof direct === "number") return String(direct);
  for (const feat of many(node.feat ?? node.DC)) {
    if ((feat?.["@_att"] ?? feat?.["@_name"])?.toLowerCase() === key.toLowerCase()) {
      return String(feat["@_val"] ?? feat["@_value"] ?? "");
    }
  }
  return null;
};

export const extractSwesaurus = (xml) => {
  if (XMLValidator.validate(xml) !== true) throw new Error("Filen är inte giltig XML.");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    parseAttributeValue: false,
    trimValues: true,
  });
  const root = parser.parse(xml).LexicalResource;
  if (!root) throw new Error("Förväntade LexicalResource i XML-filen.");

  const groups = new Map();
  const senseToWord = new Map();
  const entryToWord = new Map();
  const add = (key, word) => {
    if (!key || !crosswordWord(word)) return;
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key).add(word);
  };
  let entries = 0;
  const lexicons = many(root.Lexicon);
  for (const lexicon of lexicons) {
    for (const entry of many(lexicon.LexicalEntry)) {
      entries += 1;
      const lemma = entry.Lemma ?? entry.lemma;
      const written = feature(lemma, "writtenForm") ?? feature(entry, "writtenForm");
      const word = normalize(written);
      if (!crosswordWord(word)) continue;
      const entryId = feature(entry, "id");
      if (entryId) entryToWord.set(entryId, word);
      for (const sense of many(entry.Sense)) {
        const senseId = feature(sense, "id");
        if (senseId) senseToWord.set(senseId, word);
        const synsetId = ["synset", "synsetId", "synsetID", "synsetRef", "synset_id"]
          .map(key => feature(sense, key)).find(Boolean);
        if (synsetId) add(synsetId, word);
      }
    }
  }

  // Also support LMF variants that define synset memberships on Synset nodes.
  for (const lexicon of lexicons) {
    for (const synset of many(lexicon.Synset)) {
      const id = feature(synset, "id");
      if (!id) continue;
      const references = [
        feature(synset, "members"),
        feature(synset, "senses"),
        feature(synset, "sense"),
      ].filter(Boolean).join(" ").split(/[\s,;]+/).filter(Boolean);
      for (const ref of references) {
        const word = senseToWord.get(ref) ?? entryToWord.get(ref);
        if (word) add(id, word);
      }
      for (const member of [
        ...many(synset.Sense),
        ...many(synset.SynsetMember),
      ]) {
        const ref = feature(member, "idref") ?? feature(member, "ref") ?? feature(member, "sense");
        const word = senseToWord.get(ref) ?? entryToWord.get(ref);
        if (word) add(id, word);
      }
    }
  }

  const pairs = new Set();
  let skippedLargeGroups = 0;
  for (const words of groups.values()) {
    if (words.size > 50) {
      skippedLargeGroups += 1; // Avoid very broad fuzzy synonym groups.
      continue;
    }
    const sorted = [...words].sort((a, b) => a.localeCompare(b, "sv-SE"));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        pairs.add(sorted[i] + "\t" + sorted[j]);
      }
    }
  }
  if (entries === 0 || pairs.size === 0) {
    throw new Error("Inga synonympar hittades. Swesaurus-formatet kan ha ändrats.");
  }
  return { pairs: [...pairs].map(pair => pair.split("\t")), entries, groups: groups.size, skippedLargeGroups };
};

export const normalizedTerm = (value) => normalize(value);
export const matchesCrosswordPattern = (word, pattern) =>
  word.length === pattern.length && [...word].every((letter, i) =>
    pattern[i] === "." || pattern[i] === letter);
