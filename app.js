/**
 * Urban Service Accessibility Dashboard - Ijebu-Ode, Nigeria
 * Interactive Web Map Application
 * Professional Edition with Heat-like Buffers
 */

// ============================================
// Configuration & State
// ============================================

const CONFIG = {
    center: [6.8167, 3.9167],
    zoom: 13,
    minZoom: 11,
    maxZoom: 18,
    dataPath: 'data/'
};

// Layer state management
const layerState = {
    adminBoundary: { visible: true, layer: null, data: null, zIndex: 100 },
    serviceGap: { visible: false, layer: null, data: null, zIndex: 200 },
    healthBuffer: { visible: true, layer: null, data: null, zIndex: 300 },
    schoolsBuffer: { visible: true, layer: null, data: null, zIndex: 400 },
    roads: { visible: true, layer: null, data: null, zIndex: 500 },
    buildingsServed: { visible: false, layer: null, data: null, zIndex: 600 },
    buildingsUnserved: { visible: false, layer: null, data: null, zIndex: 700 },
    schools: { visible: true, layer: null, data: null, zIndex: 900 },
    healthCenters: { visible: true, layer: null, data: null, zIndex: 1000 }
};

// Statistics
let statistics = {};
let map;
let currentView = 'accessibility';

// ============================================
// Map Initialization
// ============================================

async function initMap() {
    map = L.map('map', {
        center: CONFIG.center,
        zoom: CONFIG.zoom,
        minZoom: CONFIG.minZoom,
        maxZoom: CONFIG.maxZoom,
        zoomControl: true,
        preferCanvas: true
    });

    // Light professional basemap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Add scale control
    L.control.scale({ position: 'bottomright', imperial: false }).addTo(map);

    await loadAllData();
    createAllLayers();
    switchView('accessibility');
    updateStatsDisplay();
    
    if (layerState.adminBoundary.layer) {
        map.fitBounds(layerState.adminBoundary.layer.getBounds(), { padding: [50, 50] });
    }
    
    document.getElementById('loadingOverlay').classList.add('hidden');
}

// ============================================
// Data Loading
// ============================================

async function loadAllData() {
    const files = {
        adminBoundary: 'admin_boundary.geojson',
        schoolsBuffer: 'schools_buffer.geojson',
        healthBuffer: 'health_buffer.geojson',
        serviceGap: 'service_gap.geojson',
        buildingsServed: 'buildings_served.geojson',
        buildingsUnserved: 'buildings_unserved.geojson',
        roads: 'roads.geojson',
        schools: 'schools.geojson',
        healthCenters: 'health_centers.geojson',
        statistics: 'statistics.json'
    };
    
    const loadPromises = Object.entries(files).map(async ([key, filename]) => {
        try {
            const response = await fetch(CONFIG.dataPath + filename);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            
            if (key === 'statistics') {
                statistics = data;
            } else if (layerState[key]) {
                layerState[key].data = data;
            }
        } catch (error) {
            console.error(`Failed to load ${filename}:`, error);
        }
    });
    
    await Promise.all(loadPromises);
}

// ============================================
// Layer Creation - Proper Z-Index Order
// ============================================

function createAllLayers() {
    // Create layers - Order matters for rendering
    createAdminBoundaryLayer();  // Bottom - no interactions block
    createServiceGapLayer();
    createHealthBufferLayer();   // Heat effect - no stroke
    createSchoolsBufferLayer();  // Heat effect - no stroke
    createRoadsLayer();
    createBuildingsServedLayer();
    createBuildingsUnservedLayer();
    createSchoolsLayer();        // Top - clickable points
    createHealthCentersLayer();  // Top - clickable points
}

// ============================================
// Admin Boundary - Non-blocking
// ============================================

function createAdminBoundaryLayer() {
    if (!layerState.adminBoundary.data) return;
    
    layerState.adminBoundary.layer = L.geoJSON(layerState.adminBoundary.data, {
        style: {
            color: '#8b5cf6',
            weight: 3,
            opacity: 0.8,
            fillColor: '#8b5cf6',
            fillOpacity: 0.03,
            dashArray: '10, 6',
            interactive: false  // IMPORTANT: Don't block clicks
        },
        interactive: false  // Layer level - don't capture events
    });
    
    if (layerState.adminBoundary.visible) {
        layerState.adminBoundary.layer.addTo(map);
    }
}

// ============================================
// Heat-like Buffer Layers (No Outlines)
// ============================================

function createSchoolsBufferLayer() {
    if (!layerState.schoolsBuffer.data) return;
    
    // Create multiple translucent layers for heat/gradient effect
    const layerGroup = L.layerGroup();
    
    // Outer glow - very transparent
    const outerGlow = L.geoJSON(layerState.schoolsBuffer.data, {
        style: {
            stroke: false,  // NO OUTLINE
            fillColor: '#3b82f6',
            fillOpacity: 0.15
        },
        interactive: false
    });
    
    // Middle layer
    const middleLayer = L.geoJSON(layerState.schoolsBuffer.data, {
        style: {
            stroke: false,
            fillColor: '#3b82f6',
            fillOpacity: 0.2
        },
        interactive: false
    });
    
    // Inner core - more opaque
    const innerCore = L.geoJSON(layerState.schoolsBuffer.data, {
        style: {
            stroke: false,
            fillColor: '#3b82f6',
            fillOpacity: 0.25
        },
        onEachFeature: (feature, layer) => {
            layer.bindPopup(createBufferPopup('school', 'Schools Service Area', {
                'Buffer Distance': '500 meters',
                'Coverage Area': formatNumber(statistics.schools_buffer?.total_area_sqkm || 0, 2) + ' km²',
                'Schools Covered': statistics.summary?.schools_count || 0
            }));
        }
    });
    
    layerGroup.addLayer(outerGlow);
    layerGroup.addLayer(middleLayer);
    layerGroup.addLayer(innerCore);
    
    layerState.schoolsBuffer.layer = layerGroup;
    
    if (layerState.schoolsBuffer.visible) {
        layerState.schoolsBuffer.layer.addTo(map);
    }
}

function createHealthBufferLayer() {
    if (!layerState.healthBuffer.data) return;
    
    const layerGroup = L.layerGroup();
    
    // Outer glow
    const outerGlow = L.geoJSON(layerState.healthBuffer.data, {
        style: {
            stroke: false,
            fillColor: '#10b981',
            fillOpacity: 0.12
        },
        interactive: false
    });
    
    // Middle layer
    const middleLayer = L.geoJSON(layerState.healthBuffer.data, {
        style: {
            stroke: false,
            fillColor: '#10b981',
            fillOpacity: 0.18
        },
        interactive: false
    });
    
    // Inner core
    const innerCore = L.geoJSON(layerState.healthBuffer.data, {
        style: {
            stroke: false,
            fillColor: '#10b981',
            fillOpacity: 0.25
        },
        onEachFeature: (feature, layer) => {
            layer.bindPopup(createBufferPopup('health', 'Health Service Area', {
                'Buffer Distance': '1,000 meters',
                'Coverage Area': formatNumber(statistics.health_buffer?.total_area_sqkm || 0, 2) + ' km²',
                'Health Centers': statistics.summary?.health_centers_count || 0
            }));
        }
    });
    
    layerGroup.addLayer(outerGlow);
    layerGroup.addLayer(middleLayer);
    layerGroup.addLayer(innerCore);
    
    layerState.healthBuffer.layer = layerGroup;
    
    if (layerState.healthBuffer.visible) {
        layerState.healthBuffer.layer.addTo(map);
    }
}

// ============================================
// Service Gap Layer
// ============================================

function createServiceGapLayer() {
    if (!layerState.serviceGap.data) return;
    
    layerState.serviceGap.layer = L.geoJSON(layerState.serviceGap.data, {
        style: {
            stroke: false,
            fillColor: '#ef4444',
            fillOpacity: 0.4
        },
        onEachFeature: (feature, layer) => {
            layer.bindPopup(createBufferPopup('gap', 'Underserved Area', {
                'Gap Area': formatNumber(statistics.summary?.service_gap_sqkm || 0, 2) + ' km²',
                'Percentage of Total': formatNumber(statistics.summary?.gap_percentage || 0, 1) + '%',
                'Status': 'Outside all service buffers'
            }));
            
            layer.on('mouseover', function() {
                this.setStyle({ fillOpacity: 0.6 });
            });
            layer.on('mouseout', function() {
                this.setStyle({ fillOpacity: 0.4 });
            });
        }
    });
    
    if (layerState.serviceGap.visible) {
        layerState.serviceGap.layer.addTo(map);
    }
}

// ============================================
// Building Layers
// ============================================

function createBuildingsServedLayer() {
    if (!layerState.buildingsServed.data) return;

    layerState.buildingsServed.layer = L.geoJSON(layerState.buildingsServed.data, {
        pointToLayer: (feature, latlng) => {
            return L.circleMarker(latlng, {
                radius: 3,
                color: '#0891b2',
                weight: 0,
                fillColor: '#06b6d4',
                fillOpacity: 0.8
            });
        },
        onEachFeature: (feature, layer) => {
            layer.bindPopup(createBuildingPopup('served', feature.properties));
            layer.on('mouseover', function() { this.setStyle({ radius: 5, fillOpacity: 1 }); });
            layer.on('mouseout',  function() { this.setStyle({ radius: 3, fillOpacity: 0.8 }); });
        }
    });

    if (layerState.buildingsServed.visible) {
        layerState.buildingsServed.layer.addTo(map);
    }
}

function createBuildingsUnservedLayer() {
    if (!layerState.buildingsUnserved.data) return;

    layerState.buildingsUnserved.layer = L.geoJSON(layerState.buildingsUnserved.data, {
        pointToLayer: (feature, latlng) => {
            return L.circleMarker(latlng, {
                radius: 3,
                color: '#ea580c',
                weight: 0,
                fillColor: '#f97316',
                fillOpacity: 0.8
            });
        },
        onEachFeature: (feature, layer) => {
            layer.bindPopup(createBuildingPopup('unserved', feature.properties));
            layer.on('mouseover', function() { this.setStyle({ radius: 5, fillOpacity: 1 }); });
            layer.on('mouseout',  function() { this.setStyle({ radius: 3, fillOpacity: 0.8 }); });
        }
    });

    if (layerState.buildingsUnserved.visible) {
        layerState.buildingsUnserved.layer.addTo(map);
    }
}

// ============================================
// Roads Layer
// ============================================

function createRoadsLayer() {
    if (!layerState.roads.data) return;
    
    layerState.roads.layer = L.geoJSON(layerState.roads.data, {
        style: (feature) => {
            const highway = feature.properties?.highway || '';
            let weight = 1;
            let color = '#94a3b8';
            
            if (highway === 'primary' || highway === 'trunk') {
                weight = 2.5;
                color = '#64748b';
            } else if (highway === 'secondary') {
                weight = 2;
                color = '#78716c';
            } else if (highway === 'tertiary') {
                weight = 1.5;
            }
            
            return {
                color: color,
                weight: weight,
                opacity: 0.6
            };
        },
        interactive: false  // Roads don't need popups
    });
    
    if (layerState.roads.visible) {
        layerState.roads.layer.addTo(map);
    }
}

// ============================================
// Point Layers - Schools & Health Centers
// ============================================

function createSchoolsLayer() {
    if (!layerState.schools.data) return;
    
    layerState.schools.layer = L.geoJSON(layerState.schools.data, {
        pointToLayer: (feature, latlng) => {
            return L.circleMarker(latlng, {
                radius: 8,
                fillColor: '#3b82f6',
                color: '#1d4ed8',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
            });
        },
        onEachFeature: (feature, layer) => {
            const props = feature.properties;
            layer.bindPopup(createSchoolPopup(props));
            addPointHover(layer, 8, '#3b82f6');
        }
    });
    
    if (layerState.schools.visible) {
        layerState.schools.layer.addTo(map);
    }
}

function createHealthCentersLayer() {
    if (!layerState.healthCenters.data) return;
    
    layerState.healthCenters.layer = L.geoJSON(layerState.healthCenters.data, {
        pointToLayer: (feature, latlng) => {
            return L.circleMarker(latlng, {
                radius: 10,
                fillColor: '#10b981',
                color: '#047857',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
            });
        },
        onEachFeature: (feature, layer) => {
            const props = feature.properties;
            layer.bindPopup(createHealthCenterPopup(props));
            addPointHover(layer, 10, '#10b981');
        }
    });
    
    if (layerState.healthCenters.visible) {
        layerState.healthCenters.layer.addTo(map);
    }
}

function addPointHover(layer, baseRadius, color) {
    layer.on('mouseover', function() {
        this.setRadius(baseRadius + 4);
        this.setStyle({ fillOpacity: 1, weight: 3 });
        this.bringToFront();
    });
    layer.on('mouseout', function() {
        this.setRadius(baseRadius);
        this.setStyle({ fillOpacity: 0.9, weight: 2 });
    });
}

// ============================================
// Popup Templates
// ============================================

function createSchoolPopup(props) {
    const name = props.name || 'Unknown School';
    const amenity = props.amenity || 'school';
    const hours = props.opening_hours || 'Not specified';
    const wheelchair = props.wheelchair === 'yes' ? 'Yes' : 'No';
    const minAge = props.min_age || 'N/A';
    
    return `
        <div class="popup-header school">
            <div class="popup-title">
                <i class="fas fa-graduation-cap"></i>
                ${capitalizeWords(name)}
            </div>
            <div class="popup-subtitle">Educational Facility</div>
        </div>
        <div class="popup-body">
            <div class="popup-row">
                <span class="popup-label">Type</span>
                <span class="popup-value">${capitalizeWords(amenity)}</span>
            </div>
            <div class="popup-row">
                <span class="popup-label">Hours</span>
                <span class="popup-value">${hours}</span>
            </div>
            <div class="popup-row">
                <span class="popup-label">Min Age</span>
                <span class="popup-value">${minAge}</span>
            </div>
            <div class="popup-row">
                <span class="popup-label">Wheelchair Access</span>
                <span class="popup-value">${wheelchair}</span>
            </div>
            <div class="popup-row">
                <span class="popup-label">Service Radius</span>
                <span class="popup-value">500m</span>
            </div>
            <span class="popup-badge served">Education Service Point</span>
        </div>
    `;
}

function createHealthCenterPopup(props) {
    const name = props.name || 'Unknown Health Center';
    const doctors = props.doctors != null ? props.doctors : 'N/A';
    const nurses = props.nurses != null ? props.nurses : 'N/A';
    const bedSpace = props.bed_space != null ? props.bed_space : 'N/A';
    const patients = props.no_ofpatie != null ? formatNumber(props.no_ofpatie, 0) : 'N/A';
    const paramedic = props.paramedic != null ? props.paramedic : 'N/A';
    
    return `
        <div class="popup-header health">
            <div class="popup-title">
                <i class="fas fa-hospital"></i>
                ${capitalizeWords(name)}
            </div>
            <div class="popup-subtitle">Healthcare Facility</div>
        </div>
        <div class="popup-body">
            <div class="popup-row">
                <span class="popup-label">Doctors</span>
                <span class="popup-value">${doctors}</span>
            </div>
            <div class="popup-row">
                <span class="popup-label">Nurses</span>
                <span class="popup-value">${nurses}</span>
            </div>
            <div class="popup-row">
                <span class="popup-label">Paramedics</span>
                <span class="popup-value">${paramedic}</span>
            </div>
            <div class="popup-row">
                <span class="popup-label">Bed Spaces</span>
                <span class="popup-value">${bedSpace}</span>
            </div>
            <div class="popup-row">
                <span class="popup-label">Patients Served</span>
                <span class="popup-value">${patients}</span>
            </div>
            <div class="popup-row">
                <span class="popup-label">Service Radius</span>
                <span class="popup-value">1,000m</span>
            </div>
            <span class="popup-badge served">Healthcare Service Point</span>
        </div>
    `;
}

function createBuildingPopup(type, props) {
    const area = props.area_sqm ? formatNumber(props.area_sqm, 1) + ' m²' : 'Unknown';
    const headerClass = type === 'served' ? 'served' : 'unserved';
    const statusText = type === 'served' ? 'Within Service Area' : 'Outside Service Area';
    const badgeClass = type === 'served' ? 'served' : 'unserved';
    const badgeText = type === 'served' ? 'Has Service Access' : 'Needs Service Access';
    const icon = type === 'served' ? 'fa-check-circle' : 'fa-times-circle';
    
    return `
        <div class="popup-header ${headerClass}">
            <div class="popup-title">
                <i class="fas ${icon}"></i>
                Building
            </div>
            <div class="popup-subtitle">${statusText}</div>
        </div>
        <div class="popup-body">
            <div class="popup-row">
                <span class="popup-label">Footprint Area</span>
                <span class="popup-value">${area}</span>
            </div>
            <div class="popup-row">
                <span class="popup-label">Service Status</span>
                <span class="popup-value">${type === 'served' ? 'Served' : 'Unserved'}</span>
            </div>
            <span class="popup-badge ${badgeClass}">${badgeText}</span>
        </div>
    `;
}

function createBufferPopup(type, title, data) {
    const headerClass = type;
    const icons = {
        school: 'fa-graduation-cap',
        health: 'fa-hospital',
        gap: 'fa-exclamation-triangle'
    };
    
    let rowsHtml = '';
    for (const [label, value] of Object.entries(data)) {
        rowsHtml += `
            <div class="popup-row">
                <span class="popup-label">${label}</span>
                <span class="popup-value">${value}</span>
            </div>
        `;
    }
    
    const badgeClass = type === 'gap' ? 'unserved' : 'served';
    const badgeText = type === 'gap' ? 'Priority for Development' : 'Service Coverage Zone';
    
    return `
        <div class="popup-header ${headerClass}">
            <div class="popup-title">
                <i class="fas ${icons[type]}"></i>
                ${title}
            </div>
        </div>
        <div class="popup-body">
            ${rowsHtml}
            <span class="popup-badge ${badgeClass}">${badgeText}</span>
        </div>
    `;
}

// ============================================
// Layer Toggle Functions
// ============================================

function toggleLayer(layerName) {
    const state = layerState[layerName];
    if (!state || !state.layer) return;
    
    state.visible = !state.visible;
    
    if (state.visible) {
        state.layer.addTo(map);
        // Bring points to front
        if (layerState.schools.layer && layerState.schools.visible) {
            layerState.schools.layer.bringToFront();
        }
        if (layerState.healthCenters.layer && layerState.healthCenters.visible) {
            layerState.healthCenters.layer.bringToFront();
        }
    } else {
        map.removeLayer(state.layer);
    }
    
    updateLayerUI(layerName, state.visible);
}

function setLayerVisibility(layerName, visible) {
    const state = layerState[layerName];
    if (!state || !state.layer) return;
    
    state.visible = visible;
    
    if (visible) {
        if (!map.hasLayer(state.layer)) {
            state.layer.addTo(map);
        }
    } else {
        if (map.hasLayer(state.layer)) {
            map.removeLayer(state.layer);
        }
    }
    
    updateLayerUI(layerName, visible);
}

function updateLayerUI(layerName, visible) {
    const layerItem = document.querySelector(`[data-layer="${layerName}"]`);
    if (layerItem) {
        if (visible) {
            layerItem.classList.add('active');
        } else {
            layerItem.classList.remove('active');
        }
    }
}

// ============================================
// View Switching
// ============================================

function switchView(viewName) {
    currentView = viewName;
    
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');
    
    const viewConfigs = {
        accessibility: {
            adminBoundary: true,
            schoolsBuffer: true,
            healthBuffer: true,
            serviceGap: false,
            buildingsServed: false,
            buildingsUnserved: false,
            roads: true,
            schools: true,
            healthCenters: true
        },
        gaps: {
            adminBoundary: true,
            schoolsBuffer: false,
            healthBuffer: false,
            serviceGap: true,
            buildingsServed: false,
            buildingsUnserved: false,
            roads: true,
            schools: true,
            healthCenters: true
        },
        buildings: {
            adminBoundary: true,
            schoolsBuffer: false,
            healthBuffer: false,
            serviceGap: false,
            buildingsServed: true,
            buildingsUnserved: true,
            roads: true,
            schools: true,
            healthCenters: true
        },
        all: {
            adminBoundary: true,
            schoolsBuffer: true,
            healthBuffer: true,
            serviceGap: true,
            buildingsServed: true,
            buildingsUnserved: true,
            roads: true,
            schools: true,
            healthCenters: true
        }
    };
    
    const config = viewConfigs[viewName];
    if (config) {
        Object.entries(config).forEach(([layer, visible]) => {
            setLayerVisibility(layer, visible);
        });
        
        // Always bring points to front
        setTimeout(() => {
            if (layerState.schools.layer && layerState.schools.visible) {
                layerState.schools.layer.bringToFront();
            }
            if (layerState.healthCenters.layer && layerState.healthCenters.visible) {
                layerState.healthCenters.layer.bringToFront();
            }
        }, 100);
    }
}

// ============================================
// Statistics Display
// ============================================

function updateStatsDisplay() {
    const summary = statistics.summary || {};
    
    // Use values from service_summary.csv
    const areaCoverage = 15.39;  // From CSV
    const buildingCoverage = 59.94;  // From CSV
    const totalBuildings = 57003;  // From CSV
    
    // Header stats
    document.getElementById('headerCoverage').textContent = areaCoverage.toFixed(1) + '%';
    document.getElementById('headerBuildingCoverage').textContent = buildingCoverage.toFixed(1) + '%';
    document.getElementById('headerFacilities').textContent = 
        (summary.schools_count || 0) + (summary.health_centers_count || 0);
    document.getElementById('headerUnserved').textContent = 
        formatCompact(summary.buildings_unserved_count || 0);
    
    // Coverage bars
    document.getElementById('areaCoveragePct').textContent = areaCoverage.toFixed(1) + '%';
    document.getElementById('areaCoverageBar').style.width = areaCoverage + '%';
    
    document.getElementById('buildingCoveragePct').textContent = buildingCoverage.toFixed(1) + '%';
    document.getElementById('buildingCoverageBar').style.width = buildingCoverage + '%';
    
    // Facility stats
    document.getElementById('statSchools').textContent = summary.schools_count || 57;
    document.getElementById('statHealth').textContent = summary.health_centers_count || 17;
    
    // Building stats
    document.getElementById('statServed').textContent = formatCompact(summary.buildings_served_count || 34167);
    document.getElementById('statUnserved').textContent = formatCompact(summary.buildings_unserved_count || 22836);
    document.getElementById('statTotalBuildings').textContent = formatNumber(totalBuildings, 0);
    
    // Area stats
    document.getElementById('statAdminArea').textContent = formatNumber(summary.admin_area_sqkm || 190.5, 1);
    document.getElementById('statCoverageArea').textContent = formatNumber(summary.service_coverage_sqkm || 29.31, 1);
    document.getElementById('statGapArea').textContent = formatNumber(summary.service_gap_sqkm || 163.16, 1);
    
    // Layer counts
    document.getElementById('layerCountServed').textContent = formatCompact(summary.buildings_served_count || 34167) + ' buildings';
    document.getElementById('layerCountUnserved').textContent = formatCompact(summary.buildings_unserved_count || 22836) + ' buildings';
    document.getElementById('layerCountSchools').textContent = (summary.schools_count || 57) + ' points';
    document.getElementById('layerCountHealth').textContent = (summary.health_centers_count || 17) + ' points';
}

// ============================================
// UI Functions
// ============================================

function toggleLayerPanel() {
    const panel = document.getElementById('layerPanel');
    const icon = document.getElementById('layerPanelIcon');
    
    panel.classList.toggle('collapsed');
    
    if (panel.classList.contains('collapsed')) {
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    } else {
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    }
}

// ============================================
// Utility Functions
// ============================================

function formatNumber(num, decimals = 0) {
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatCompact(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function capitalizeWords(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', initMap);
