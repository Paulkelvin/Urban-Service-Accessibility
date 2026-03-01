"""
Optimize buildings GeoJSON files for web delivery.
- Keeps original polygon shapes (no centroid conversion)
- Simplifies geometries aggressively (removes redundant vertices)
- Rounds coordinates to 4 decimal places  (~11m, fine for building outlines at web zoom)
- Keeps only area_sqm property
- Minifies JSON output
Originals (.gpkg) are always re-read fresh.
"""

import geopandas as gpd
import json
import os
import shapely.geometry as sg

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
GPKG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

FILES = [
    ("Buildings_UTM_FIXED.gpkg",   "buildings_served.geojson",   "served"),
    ("Buildings_UTM_FIXED.gpkg",   "buildings_unserved.geojson", "unserved"),
]

BUILDINGS_SERVED_GPKG   = os.path.join(GPKG_DIR, "buildings_served.gpkg")
BUILDINGS_UNSERVED_GPKG = os.path.join(GPKG_DIR, "buildings_unserved.gpkg")

SIMPLIFY_TOLERANCE = 0.000001  # degrees (~0.1m) - imperceptible, only removes duplicate vertices
COORD_PRECISION    = 6         # decimal places (~0.1m) - sharp, accurate building outlines


def round_coord_list(coords, precision):
    if isinstance(coords[0], (int, float)):
        return [round(c, precision) for c in coords]
    return [round_coord_list(c, precision) for c in coords]


def round_geom(geom_dict, precision):
    g = dict(geom_dict)
    if "coordinates" in g:
        g["coordinates"] = round_coord_list(g["coordinates"], precision)
    return g


def optimize(gpkg_path, out_filename):
    out_path = os.path.join(DATA_DIR, out_filename)
    print(f"\nOptimizing: {out_filename}")

    gdf = gpd.read_file(gpkg_path)
    print(f"  Source features: {len(gdf):,}")

    # Area in UTM before reprojecting
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf["area_sqm"] = gdf.geometry.area.round(1)
        gdf = gdf.to_crs(epsg=4326)
    else:
        gdf_utm = gdf.to_crs(epsg=32631)
        gdf["area_sqm"] = gdf_utm.geometry.area.round(1)

    # Simplify polygons
    gdf["geometry"] = gdf.geometry.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)
    gdf = gdf[~gdf.geometry.is_empty & gdf.geometry.notna()]

    # Build minified GeoJSON
    features = []
    for _, row in gdf.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue
        geom_dict = round_geom(sg.mapping(geom), COORD_PRECISION)
        area = round(float(row["area_sqm"]), 1) if row.get("area_sqm") is not None else 0
        features.append({"type": "Feature", "geometry": geom_dict, "properties": {"area_sqm": area}})

    geojson = {"type": "FeatureCollection", "features": features}
    with open(out_path, "w") as f:
        json.dump(geojson, f, separators=(",", ":"))

    size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"  Output: {size_mb:.2f} MB  ({len(features):,} features)")


if __name__ == "__main__":
    optimize(BUILDINGS_SERVED_GPKG,   "buildings_served.geojson")
    optimize(BUILDINGS_UNSERVED_GPKG, "buildings_unserved.geojson")
    print("\nDone. Building layers are optimized polygons.")
