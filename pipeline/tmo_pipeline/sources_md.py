"""Generate SOURCES.md from the source manifests (the manifests are the truth)."""
from __future__ import annotations

from .manifests import Source

HEADER = """# Data sources

*Generated from `pipeline/sources/*.yaml` by `python -m tmo_pipeline sources-md`. Do not edit by hand.*

This app is for personal use. Every dataset it shows is listed here with its licence
and the attribution text the app displays. **Licence check** says how sure we are:

- **confirmed**: the licence was read on the provider's own page or repository.
- **unconfirmed**: only seen via search summaries (many official sites are blocked
  from the build session); it is re-checked when the GitHub data build fetches it.
- **rejected**: must not be used.

"""


def render(sources: dict[str, Source]) -> str:
    lines = [HEADER, "| Source | Used for | Licence | Licence check | Attribution shown in app |", "|---|---|---|---|---|"]
    for s in sorted(sources.values(), key=lambda s: s.id):
        lic = f"[{s.licence}]({s.licence_url})" if s.licence_url else s.licence
        lines.append(
            f"| [{_esc(s.name)}]({s.homepage}) | {', '.join(s.used_for)} | {_esc(lic)} | "
            f"{s.licence_check.status} ({s.licence_check.checked_on}) | {_esc(s.attribution)} |"
        )
    lines.append("")
    lines.append("## Notes per source")
    lines.append("")
    for s in sorted(sources.values(), key=lambda s: s.id):
        lines.append(f"### {s.name} (`{s.id}`)")
        lines.append("")
        lines.append(f"- Provider: {s.provider}")
        if s.data_url:
            lines.append(f"- Data: {s.data_url}")
        lines.append(f"- Licence check: **{s.licence_check.status}** — {s.licence_check.method}")
        if s.licence_check.notes:
            lines.append(f"- Check notes: {s.licence_check.notes}")
        if s.terms_notes:
            lines.append(f"- Terms notes: {s.terms_notes}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def _esc(text: str) -> str:
    return text.replace("|", "\\|").replace("\n", " ")
