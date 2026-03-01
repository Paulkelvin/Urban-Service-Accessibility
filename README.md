# Urban Service Accessibility Dashboard - Ijebu-Ode, Nigeria

An interactive web map visualizing spatial accessibility to public services (schools and health centers) in Ijebu-Ode, Ogun State, Nigeria.

## Live Demo

[View Dashboard](https://urban-service-accessibility.netlify.app/)

## Features

- **Interactive Map Layers**
  - Administrative boundary
  - School and health center locations
  - Service coverage buffers (500m radius)
  - Service gap areas
  - Buildings served/unserved by public services
  - Road network

- **Heat-like Visualization**: Overlapping buffer zones create gradient effects showing service intensity

- **Real-time Statistics**
  - Total buildings: 57,003
  - Buildings served: 34,167 (59.94%)
  - Buildings unserved: 22,836 (40.06%)
  - Service coverage area: 29.31 km²
  - Service gap area: 163.16 km²

- **Interactive Features**
  - Toggle layers on/off
  - Click facilities for detailed information (name, staff, capacity)
  - Quick view presets (Full View, Schools Focus, Health Focus, Gap Analysis)
  - Responsive legend

## Data Sources

- Buildings, roads, and administrative boundaries from OpenStreetMap
- School and health center locations from field survey/local government data
- Coordinate Reference System: UTM Zone 31N (EPSG:32631), converted to WGS84 for web display

## Technology Stack

- **Leaflet.js** - Interactive mapping
- **HTML5/CSS3** - Dashboard interface
- **GeoJSON** - Spatial data format
- **Python/GeoPandas** - Data conversion and processing

## Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/Paulkelvin/Urban-Service-Accessibility.git
   cd Urban-Service-Accessibility
   ```

2. Start a local server:
   ```bash
   python -m http.server 8080
   ```

3. Open `http://localhost:8080` in your browser

## Project Structure

```
├── index.html          # Main dashboard page
├── app.js              # Map logic and interactivity
├── data/
│   ├── admin_boundary.geojson
│   ├── schools.geojson
│   ├── health_centers.geojson
│   ├── schools_buffer.geojson
│   ├── health_buffer.geojson
│   ├── buildings_served.geojson
│   ├── buildings_unserved.geojson
│   ├── service_gap.geojson
│   ├── roads.geojson
│   └── statistics.json
└── convert_to_geojson.py  # Data conversion script
```

## Methodology

1. **Buffer Analysis**: 500m service areas created around each school and health center
2. **Spatial Join**: Buildings classified as served (within buffer) or unserved (outside buffer)
3. **Gap Analysis**: Areas within administrative boundary but outside service coverage identified as gaps

## Author

Created for urban planning and public service accessibility analysis in Ijebu-Ode, Ogun State, Nigeria.

## License

MIT License
