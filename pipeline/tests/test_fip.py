from tmo_pipeline.fip import grid_step, sheet_label


def test_sheet_label():
    assert sheet_label("[Insurance plan of the city of Hamilton, Ontario, Canada] : [sheet 04]") == "sheet-04"
    assert sheet_label("[Insurance plan of the city of Hamilton, Ontario, Canada] : [sheet] 47") == "sheet-47"
    assert sheet_label("[...] : [key plan, volume 1, sheet 3]") == "sheet-03" or sheet_label("[...] : [key plan, volume 1, sheet 3]") == "key-plan"
    assert sheet_label("[...] : [key to Symbols]") == "key-symbols"


def test_grid_step():
    assert grid_step(1800) == 100
    assert grid_step(6000) == 500
