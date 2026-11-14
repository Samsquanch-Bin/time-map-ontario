# Places of interest

One Markdown file per place: YAML front matter (category, dates, coordinates and
where they come from, sources) plus a short story. The format is documented in
`pipeline/tmo_pipeline/places.py` and checked by `python -m tmo_pipeline validate`.

Every story was written by Claude only from the source text retrieved by the
**Research sources** workflow (`research-cache` branch), and every number and year
in a story was checked automatically against that text. They are not reviewed by a
person, and the app labels them "researched by Claude". Stories adapted from
Wikipedia are licensed CC BY-SA 4.0, and each one links the article revision it used.
