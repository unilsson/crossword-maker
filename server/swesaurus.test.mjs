import { test } from "node:test";
import assert from "node:assert/strict";
import { extractSwesaurus, matchesCrosswordPattern } from "./swesaurus.mjs";

test("imports LMF feat format, associates words through synsets", () => {
  const xml = `<?xml version="1.0"?>
<LexicalResource><Lexicon>
  <LexicalEntry id="a"><Lemma><feat att="writtenForm" val="snabb"/></Lemma>
    <Sense id="sa"><feat att="synset" val="g1"/></Sense></LexicalEntry>
  <LexicalEntry id="b"><Lemma><feat att="writtenForm" val="kvick"/></Lemma>
    <Sense id="sb"><feat att="synset" val="g1"/></Sense></LexicalEntry>
  <LexicalEntry id="c"><Lemma><feat att="writtenForm" val="rask"/></Lemma>
    <Sense id="sc"><feat att="synset" val="g1"/></Sense></LexicalEntry>
</Lexicon></LexicalResource>`;
  const imported = extractSwesaurus(xml);
  assert.equal(imported.entries, 3);
  assert.deepEqual(imported.pairs, [
    ["KVICK", "RASK"],
    ["KVICK", "SNABB"],
    ["RASK", "SNABB"]
  ]);
});

test("imports attribute-based WN-LMF including Swedish letters", () => {
  const xml = `<LexicalResource><Lexicon>
    <LexicalEntry id="en"><Lemma writtenForm="ödmjuk" partOfSpeech="a"/>
      <Sense id="se" synset="set"/></LexicalEntry>
    <LexicalEntry id="tv"><Lemma writtenForm="blyg" partOfSpeech="a"/>
      <Sense id="st" synset="set"/></LexicalEntry>
  </Lexicon></LexicalResource>`;
  assert.deepEqual(extractSwesaurus(xml).pairs, [["BLYG", "ÖDMJUK"]]);
});

test("accepts synset member lists referring to senses", () => {
  const xml = `<LexicalResource><Lexicon>
    <LexicalEntry id="w1"><Lemma writtenForm="glad"/><Sense id="s1"/></LexicalEntry>
    <LexicalEntry id="w2"><Lemma writtenForm="nöjd"/><Sense id="s2"/></LexicalEntry>
    <Synset id="g1" members="s1 s2"/>
  </Lexicon></LexicalResource>`;
  assert.deepEqual(extractSwesaurus(xml).pairs, [["GLAD", "NÖJD"]]);
});

test("rejects malformed XML or missing synonym relations", () => {
  assert.throws(() => extractSwesaurus("<bad>"), /XML/);
  assert.throws(() => extractSwesaurus(
    "<LexicalResource><Lexicon><LexicalEntry id='a'><Lemma writtenForm='ensam'/></LexicalEntry></Lexicon></LexicalResource>"
  ), /Inga synonympar/);
});

test("matches letter pattern and length exactly", () => {
  assert.equal(matchesCrosswordPattern("RÅDHUS", "R..HUS"), true);
  assert.equal(matchesCrosswordPattern("RÅDHUS", "R..H.."), true);
  assert.equal(matchesCrosswordPattern("RÅDHUS", "R..H.SS"), false);
  assert.equal(matchesCrosswordPattern("RÅDHUS", "R...S"), false);
});
