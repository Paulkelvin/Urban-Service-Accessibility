"""
Convert GeoPackage files to GeoJSON for web map dashboard.
All data is reprojected to EPSG:4326 (WGS84) for web mapping.
Original data is NOT modified.
"""

import geopandas as gpd
import os
import json

# Base paths
BASE_DIR = r"c:\Users\paulo\Documents\Toheeb\Urban_Service_Processed"
OUTPUT_DIR = os.path.join(BASE_DIR, "dashboard", "data")

# Define source files and output names
layers = {
    "admin_boundary": "Ijebu_Ode__admin_level_ogun_state_nigeria_UTM.gpkg",
    "schools_buffer": "schools_buffer.gpkg",
    "health_buffer": "health_buffer.gpkg",
    "all_services": "all_services_dissolved.gpkg",
    "service_gap": "service_gap.gpkg",
    "buildings_served": "buildings_served.gpkg",
    "buildings_unserved": "buildings_unserved.gpkg",
    "roads": "Ijebu_Ode_Road_UTM_FIXED.gpkg",
    "schools": "Ijebu_Ode_Schools_UTM_FIXED.gpkg",
    "health_centers": "Ijebu_Ode_Health_Center_UTM_FIXED.gpkg"
}

# Statistics to collect
stats = {}

print("Converting GeoPackage files to GeoJSON...")
print("=" * 60)

for name, filename in layers.items():
    filepath = os.path.join(BASE_DIR, filename)
    output_path = os.path.join(OUTPUT_DIR, f"{name}.geojson")
    
    try:
        print(f"\nProcessing: {name}")
        gdf = gpd.read_file(filepath)
        
        # Store original CRS info
        original_crs = gdf.crs
        print(f"  Original CRS: {original_crs}")
        print(f"  Features: {len(gdf)}")
        
        # Calculate area statistics for polygons
        if gdf.geometry.iloc[0].geom_type in ['Polygon', 'MultiPolygon']:
            # Calculate area in original CRS (meters)
            gdf['area_sqm'] = gdf.geometry.area
            total_area = gdf['area_sqm'].sum()
            stats[name] = {
                "feature_count": len(gdf),
                "total_area_sqm": total_area,
                "total_area_sqkm": total_area / 1_000_000
            }
            print(f"  Total Area: {total_area / 1_000_000:.2f} sq km")
        else:
            stats[name] = {
                "feature_count": len(gdf)
            }
        
        # Reproject to WGS84 for web mapping
        gdf_wgs84 = gdf.to_crs("EPSG:4326")
        
        # Simplify geometry slightly for performance (tolerance in degrees)
        # Skip simplification for points and buildings (keep detail)
        if name not in ['schools', 'health_centers', 'buildings_served', 'buildings_unserved']:
            gdf_wgs84['geometry'] = gdf_wgs84.geometry.simplify(0.0001, preserve_topology=True)
        
        # Save to GeoJSON
        gdf_wgs84.to_file(output_path, driver="GeoJSON")
        print(f"  Saved: {output_path}")
        
    except Exception as e:
        print(f"  ERROR: {e}")

# Calculate coverage statistics
print("\n" + "=" * 60)
print("Calculating coverage statistics...")

if 'admin_boundary' in stats and 'all_services' in stats:
    admin_area = stats['admin_boundary']['total_area_sqm']
    service_area = stats['all_services']['total_area_sqm']
    gap_area = stats.get('service_gap', {}).get('total_area_sqm', 0)
    
    coverage_pct = (service_area / admin_area) * 100 if admin_area > 0 else 0
    gap_pct = (gap_area / admin_area) * 100 if admin_area > 0 else 0
    
    stats['summary'] = {
        "admin_area_sqkm": admin_area / 1_000_000,
        "service_coverage_sqkm": service_area / 1_000_000,
        "service_gap_sqkm": gap_area / 1_000_000,
        "coverage_percentage": coverage_pct,
        "gap_percentage": gap_pct,
        "buildings_served_count": stats.get('buildings_served', {}).get('feature_count', 0),
        "buildings_unserved_count": stats.get('buildings_unserved', {}).get('feature_count', 0),
        "schools_count": stats.get('schools', {}).get('feature_count', 0),
        "health_centers_count": stats.get('health_centers', {}).get('feature_count', 0)
    }
    
    # Calculate building coverage percentage
    total_buildings = stats['summary']['buildings_served_count'] + stats['summary']['buildings_unserved_count']
    if total_buildings > 0:
        stats['summary']['building_coverage_pct'] = (stats['summary']['buildings_served_count'] / total_buildings) * 100

# Save statistics
stats_path = os.path.join(OUTPUT_DIR, "statistics.json")
with open(stats_path, 'w') as f:
    json.dump(stats, f, indent=2)
print(f"\nStatistics saved to: {stats_path}")

print("\n" + "=" * 60)
print("Conversion complete!")
print(f"\nSummary:")
print(f"  Total Admin Area: {stats.get('summary', {}).get('admin_area_sqkm', 0):.2f} sq km")
print(f"  Service Coverage: {stats.get('summary', {}).get('coverage_percentage', 0):.1f}%")
print(f"  Service Gap: {stats.get('summary', {}).get('gap_percentage', 0):.1f}%")
print(f"  Buildings Served: {stats.get('summary', {}).get('buildings_served_count', 0):,}")
print(f"  Buildings Unserved: {stats.get('summary', {}).get('buildings_unserved_count', 0):,}")
