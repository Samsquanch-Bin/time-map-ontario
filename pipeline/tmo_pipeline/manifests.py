"""Source manifests: one YAML file per data source.

A manifest records where data comes from, its licence, the exact attribution
text shown in the app, and the state of our licence check. The pipeline will
not build anything from a source whose manifest is missing or incomplete, or
whose licence check was rejected.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from .config import SOURCES_DIR

REQUIRED_FIELDS = ("id", "name", "provider", "homepage", "licence", "attribution", "licence_check", "used_for")
CHECK_STATUSES = ("confirmed", "unconfirmed", "rejected")


class ManifestError(ValueError):
    pass


@dataclass(frozen=True)
class LicenceCheck:
    status: str  # confirmed | unconfirmed | rejected
    method: str  # how it was checked, e.g. "read live terms page", "search summary only"
    checked_on: str  # ISO date
    notes: str = ""


@dataclass(frozen=True)
class Source:
    id: str
    name: str
    provider: str
    homepage: str
    licence: str
    attribution: str
    licence_check: LicenceCheck
    used_for: tuple[str, ...]
    licence_url: str = ""
    data_url: str = ""
    terms_notes: str = ""
    raw: dict[str, Any] = field(default_factory=dict, compare=False, repr=False)

    @property
    def usable(self) -> bool:
        return self.licence_check.status != "rejected"


def parse_manifest(data: dict[str, Any], origin: str = "<manifest>") -> Source:
    if not isinstance(data, dict):
        raise ManifestError(f"{origin}: manifest must be a mapping")
    missing = [f for f in REQUIRED_FIELDS if not data.get(f)]
    if missing:
        raise ManifestError(f"{origin}: missing required field(s): {', '.join(missing)}")
    check = data["licence_check"]
    if not isinstance(check, dict):
        raise ManifestError(f"{origin}: licence_check must be a mapping")
    for f in ("status", "method", "checked_on"):
        if not check.get(f):
            raise ManifestError(f"{origin}: licence_check.{f} is required")
    if check["status"] not in CHECK_STATUSES:
        raise ManifestError(f"{origin}: licence_check.status must be one of {CHECK_STATUSES}")
    used_for = data["used_for"]
    if isinstance(used_for, str):
        used_for = [used_for]
    return Source(
        id=str(data["id"]),
        name=str(data["name"]),
        provider=str(data["provider"]),
        homepage=str(data["homepage"]),
        licence=str(data["licence"]),
        attribution=str(data["attribution"]).strip(),
        licence_check=LicenceCheck(
            status=check["status"],
            method=str(check["method"]),
            checked_on=str(check["checked_on"]),
            notes=str(check.get("notes", "")).strip(),
        ),
        used_for=tuple(str(u) for u in used_for),
        licence_url=str(data.get("licence_url", "")),
        data_url=str(data.get("data_url", "")),
        terms_notes=str(data.get("terms_notes", "")).strip(),
        raw=data,
    )


def load_manifests(directory: Path = SOURCES_DIR) -> dict[str, Source]:
    sources: dict[str, Source] = {}
    for path in sorted(directory.glob("*.yaml")):
        with path.open(encoding="utf-8") as fh:
            src = parse_manifest(yaml.safe_load(fh), origin=path.name)
        if src.id != path.stem:
            raise ManifestError(f"{path.name}: id '{src.id}' must match the file name")
        if src.id in sources:
            raise ManifestError(f"duplicate source id {src.id}")
        sources[src.id] = src
    return sources


def require_sources(ids: list[str] | tuple[str, ...], sources: dict[str, Source]) -> list[Source]:
    """Return the manifests for ``ids``; raise if any is missing or rejected."""
    out = []
    for sid in ids:
        if sid not in sources:
            raise ManifestError(f"no source manifest for '{sid}' — add pipeline/sources/{sid}.yaml first")
        src = sources[sid]
        if not src.usable:
            raise ManifestError(f"source '{sid}' was rejected in its licence check and must not be used")
        out.append(src)
    return out
