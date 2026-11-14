# Research sources

Retrieved by the **Research sources** GitHub workflow (Actions can reach Wikidata and
Wikipedia; the build session can't). Results are committed to the `research-cache`
branch:

- `discovered.json`: Wikidata items with coordinates in the focus area, by topic.
- `sources/*.json`: for each candidate in `candidates.yaml`, the Wikidata statements
  (coordinates, dates; CC0) and the plain-text English Wikipedia article at a fixed
  revision (CC BY-SA 4.0).

Place entries in `data/places/` are written only from these retrieved texts and cite
the exact revision.
