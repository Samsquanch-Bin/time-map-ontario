from tmo_pipeline.config import REPO_DIR
from tmo_pipeline.manifests import load_manifests
from tmo_pipeline.sources_md import render


def test_sources_md_is_up_to_date():
    """SOURCES.md must match the manifests (run: python -m tmo_pipeline sources-md)."""
    assert (REPO_DIR / "SOURCES.md").read_text() == render(load_manifests())


def test_every_source_listed():
    text = render(load_manifests())
    for sid in load_manifests():
        assert f"(`{sid}`)" in text
