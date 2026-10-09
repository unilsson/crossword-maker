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

test("imports official Swesaurus 2017 LMF with empty lemmas and SALDO sense ids", () => {
  // Based on actual Swesaurus XML structure: SenseRelation label=syn, not synset.
  const xml = `<?xml version="1.0" encoding="utf-8"?>
  <LexicalResource dtdVersion="16"><Lexicon>
    <LexicalEntry><Lemma /><Sense id="abakus..1">
      <SenseRelation targets="kulram..1"><feat att="label" val="syn" /><feat att="degree" val="86"/></SenseRelation>
      <SenseRelation targets="kulram..1"><feat att="label" val="syn" /><feat att="source" val="wiktionary"/></SenseRelation>
    </Sense></LexicalEntry>
    <LexicalEntry><Lemma /><Sense id="kulram..1">
      <SenseRelation targets="abakus..1"><feat att="label" val="syn" /></SenseRelation>
    </Sense></LexicalEntry>
    <LexicalEntry><Lemma /><Sense id="förkorta..1">
      <SenseRelation targets="abbreviera..1"><feat att="label" val="syn" /></SenseRelation>
      <SenseRelation targets="minska..1"><feat att="label" val="iu" /></SenseRelation>
      <SenseRelation targets="del..1"><feat att="label" val="tp" /></SenseRelation>
    </Sense></LexicalEntry>
  </Lexicon></LexicalResource>`;
  const result = extractSwesaurus(xml);
  assert.equal(result.entries, 3);
  assert.deepEqual(result.pairs, [
    ["ABAKUS", "KULRAM"],
    ["ABBREVIERA", "FÖRKORTA"]
  ]);
});

test("does not import non-synonym Swesaurus relations", () => {
  const xml = `<LexicalResource><Lexicon>
    <LexicalEntry><Lemma/><Sense id="kontinent..1">
      <SenseRelation targets="landmassa..1">
        <feat att="label" val="iu"/>
      </SenseRelation>
    </Sense></LexicalEntry>
  </Lexicon></LexicalResource>`;
  assert.throws(() => extractSwesaurus(xml), /Inga synonympar/);
});

test("does not invent words from arbitrary non-SALDO sense ids", () => {
  const xml = `<LexicalResource><Lexicon>
    <LexicalEntry><Lemma/><Sense id="x01">
      <SenseRelation targets="x02"><feat att="label" val="syn"/></SenseRelation>
    </Sense></LexicalEntry>
  </Lexicon></LexicalResource>`;
  assert.throws(() => extractSwesaurus(xml), /Inga synonympar/);
});
