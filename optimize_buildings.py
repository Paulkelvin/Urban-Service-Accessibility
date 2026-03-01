"""
Optimize buildings GeoJSON files for web delivery.
- Converts building polygons to centroids (points) — drastically smaller files
- Rounds coordinates to 5 decimal places (~1m accuracy)
- Keeps only essential properties (area_sqm)
- Minifies JSON output
Originals (.gpkg) are untouched — re-run convert_to_geojson.py to restore polygons.
"""

import geopandas as gpd
import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

FILES = {
    "buildings_served.geojson": "buildings_served.geojson",
    "buildings_unserved.geojson": "buildings_unserved.geojson",
}

COORD_PRECISION = 5   # decimal places (~1m accuracy)


def optimize(filename):
    path = os.path.join(DATA_DIR, filename)
    print(f"\nProcessing: {filename}")

    gdf = gpd.read_file(path)
    original_size = os.path.getsize(path) / (1024 * 1024)
    original_count = len(gdf)
    print(f"  Features: {original_count:,}  |  Size: {original_size:.2f} MB")

    # 1. Reproject to WGS84 if needed
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    # 2. Calculate area_sqm before converting to centroids
    if "area_sqm" not in gdf.columns:
        gdf_utm = gdf.to_crs(epsg=32631)
        gdf["area_sqm"] = gdf_utm.geometry.area.round(1)
    
    # 3. Convert polygons to centroids (points) — massively reduces file size
    #    Use UTM for accurate centroid, then back to WGS84
    gdf_utm = gdf.to_crs(epsg=32631)
    gdf["geometry"] = gdf_utm.geometry.centroid
    gdf = gdf.set_crs(epsg=32631)
    gdf = gdf.to_crs(epsg=4326)

    # 4. Drop null geometries
    gdf = gdf[~gdf.geometry.is_empty & gdf.geometry.notna()]

    # 5. Build GeoJSON manually with rounded coordinates
    features = []
    for _, row in gdf.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue

        props = {}
        if "area_sqm" in gdf.columns and row.get("area_sqm") is not None:
            props["area_sqm"] = round(float(row["area_sqm"]), 1)

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [
                    round(geom.x, COORD_PRECISION),
                    round(geom.y, COORD_PRECISION)
                ]
            },
            "properties": props
        })

    geojson = {
        "type": "FeatureCollection",
        "features": features
    }

    # 6. Write minified JSON
    with open(path, "w") as f:
        json.dump(geojson, f, separators=(",", ":"))

    new_size = os.path.getsize(path) / (1024 * 1024)
    reduction = (1 - new_size / original_size) * 100
    print(f"  Done: {new_size:.2f} MB  |  Reduced by {reduction:.1f}%")


if __name__ == "__main__":
    # Re-read from original gpkg sources for clean output
    import subprocess, sys
    print("Re-generating from original .gpkg files first...")
    result = subprocess.run(
        [sys.executable, "convert_to_geojson.py"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("Warning: convert_to_geojson.py failed, optimizing current files instead")
        print(result.stderr[:500])

    for fname in FILES:
        optimize(fname)
    print("\nOptimization complete. Building layers are now point centroids.")

