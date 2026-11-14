"""Time Map Ontario data pipeline.

Builds static data packs (PMTiles + JSON) from open sources. Every source must
have a manifest in ``pipeline/sources/`` recording its licence and attribution;
the build refuses to use a source without one.
"""
