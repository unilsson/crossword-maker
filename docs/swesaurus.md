# Sprint 7 – Synonymer med Swesaurus

The synonym service uses the [Swesaurus](https://spraakbanken.gu.se/resurser/swesaurus) wordnet by **Språkbanken Text, University of Gothenburg**, published under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Dataset citation: Språkbanken (2017), *Swesaurus* (updated 2017-09-19), DOI [10.23695/w5ww-x964](https://doi.org/10.23695/w5ww-x964).

The source data is **not bundled in this repository**. Import happens only when requested by the user. Swesaurus contains fuzzy synonym groups: **suggestions are semantically related and not necessarily interchangeable**.

## Install

Start the Docker Compose stack:

```bash
docker compose up -d --build
docker compose ps
```

In the editor, open **Ordlista → Synonymer och närbesläktade ord** and click **Installera Swesaurus**. The API downloads the source XML (~12 MB) from Språkbanken, parses LMF lexical entries and synset membership, and stores the result in the **same persistent SQLite volume as the crossword projects**.

If the download fails due to DNS, TLS or remote service issues, download `swesaurus.xml` via the official [resource page](https://spraakbanken.gu.se/resurser/swesaurus) and click **Importera XML-fil** in the editor. The server validates the XML and refuses to replace the database if no pairs can be extracted.

## How to use

1. Select at least two letter cells in one row or column (click first cell, Shift-click last cell).
2. Enter a word such as **GAMMAL** in the **Sökord** field.
3. Results are filtered by **synonym relation**, selected range length and existing letters.
4. Click a result to insert it. Locked cells cannot be modified.
5. For an existing, already-filled answer, click **Sök markerat ord**. This enables **Tillåt att ersätta ifyllda bokstäver** so alternatives of the same length can be shown. Changing a letter may affect crossing words, so verify them afterward.

Results are suggestions. The importer ignores multiword phrases and overly large (>50 words) fuzzy synonym groups to avoid low-quality associations.

## API

- `GET /api/synonyms/status` – whether Swesaurus has been imported, source, license, time and statistics.
- `POST /api/synonyms/install` – fetch official XML and import it.
- `POST /api/synonyms/upload` – import user-provided XML (`Content-Type: application/xml`; max 20 MB).
- `GET /api/synonyms?term=GAMMAL&pattern=......` – matching alternatives (periods are wildcards; at most 60 returned).

The importer replaces the synonyms inside a SQLite transaction after successful parsing; failure preserves the previously installed pairs.

## Testing

```bash
cd server
npm install
npm test
```

Recommended manual tests:
- Import Swesaurus and confirm the non-zero synonym count, then restart containers.
- Search a known word; verify related words appear.
- Select a short range with existing crossing letters and confirm only compatible synonyms appear.
- Select a filled word and use **Sök markerat ord**, then choose a same-length replacement.
- Verify locked letters remain unchanged and the edited crossword is still saved.
- Try invalid XML upload; previously imported synonyms must remain usable.

**Security:** The app is designed for a trusted home LAN. Its project and import endpoints do not implement authentication; do not publish the API or editor on the public internet without adding access controls.
