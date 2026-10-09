import { XMLParser, XMLValidator } from "fast-xml-parser";

export const SWESAURUS_URL =
  "https://svn.spraakbanken.gu.se/sb-arkiv/pub/lmf/swesaurus/swesaurus.xml";
export const SWESAURUS_PAGE = "https://spraakbanken.gu.se/resurser/swesaurus";
export const SWESAURUS_LICENSE = "CC BY 4.0";

const many = (value) => value === undefined || value === null ? [] :
  Array.isArray(value) ? value : [value];
const normalize = (value) => String(value ?? "").normalize("NFC").trim().toLocaleUpperCase("sv-SE");
const crosswordWord = (value) => /^[A-ZÅÄÖ]{2,50}$/.test(value);

// The official 2017 Swesaurus LMF export has empty Lemma nodes. Words are
// encoded in SALDO sense ids, e.g. "abakus..1" or "världsdel..1".
const wordFromSaldoSenseId = (id) => {
  if (!/\\.\\.[0-9]+$/.test(String(id ?? ""))) return null;
  const word = normalize(String(id).replace(/\\.\\.[0-9]+$/, ""));
  return crosswordWord(word) ? word : null;
};

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
  // Genuine Swesaurus uses SenseRelation targets="sense-id" with
  // <feat att="label" val="syn"/>. Other labels such as iu/ui/tp/pt
  // are NOT synonym relationships, so never import them as suggestions.
  const directedPairs = new Set();
  const addRelation = (first, second) => {
    if (!first || !second || first === second) return;
    const sorted = [first, second].sort((a, b) => a.localeCompare(b, "sv-SE"));
    directedPairs.add(sorted.join("\\t"));
  };
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
      const explicitWord = normalize(written);
      const entryId = feature(entry, "id");
      for (const sense of many(entry.Sense)) {
        const senseId = feature(sense, "id");
        const word = crosswordWord(explicitWord) ? explicitWord : wordFromSaldoSenseId(senseId);
        if (!word) continue;
        if (entryId) entryToWord.set(entryId, word);
        if (senseId) senseToWord.set(senseId, word);
        const synsetId = ["synset", "synsetId", "synsetID", "synsetRef", "synset_id"]
          .map(key => feature(sense, key)).find(Boolean);
        if (synsetId) add(synsetId, word);
        for (const relation of many(sense.SenseRelation)) {
          // Swesaurus has many relation types; only "syn" means synonyms.
          if (feature(relation, "label") !== "syn") continue;
          const targets = (feature(relation, "targets") ?? "").split(/\\s+/).filter(Boolean);
          for (const target of targets) {
            const other = wordFromSaldoSenseId(target);
            addRelation(word, other);
          }
        }
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

  const pairs = new Set(directedPairs);
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
    throw new Error("Inga synonympar hittades i XML-filen. Importen kräver Swesaurus med SenseRelation label=syn.");
  }
  return { pairs: [...pairs].map(pair => pair.split("\t")), entries, groups: groups.size, skippedLargeGroups };
};

export const normalizedTerm = (value) => normalize(value);
export const matchesCrosswordPattern = (word, pattern) =>
  word.length === pattern.length && [...word].every((letter, i) =>
    pattern[i] === "." || pattern[i] === letter);
