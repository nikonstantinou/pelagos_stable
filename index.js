console.log("Script is running");
class ParticleSystem {
    constructor(canvas, windGL) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        this.windGL = windGL;
        this.particles = [];
        
        // Default parameters
        this.numParticles = 3900;
        this.particleSize = 1.1;
        this.speedFactor = 0.3;
        this.fadeOpacity = 0.96;
        this.particleColor = 'white';
        this.dropRate = 0.003;
        this.dropRateBump = 0.01;
        
        this.running = false;
        this.frameCount = 0;
        this.lastUpdate = 0;
        this.updateInterval = 1000 / 60; // 60 FPS default
        
        this.resize();
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const pixelRatio = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * pixelRatio;
        this.canvas.height = rect.height * pixelRatio;
        this.ctx.scale(pixelRatio, pixelRatio);
    }

    initParticles() {
        // Clear existing particles
        this.particles = [];
    
        // Get current map bounds from Leaflet
        const bounds = this.windGL.map.getBounds();
        const southWest = bounds.getSouthWest();
        const northEast = bounds.getNorthEast();
    
        // Determine boundaries for particle generation
        const minLat = Math.max(southWest.lat, -85);
        const maxLat = Math.min(northEast.lat, 85);
        const minLon = southWest.lng;
        const maxLon = northEast.lng;
    
        console.group('Particle Initialization');
        console.log('Map Bounds:', {
            minLat, maxLat, 
            minLon, maxLon,
            totalBounds: `${minLat} to ${maxLat}, ${minLon} to ${maxLon}`
        });
    
        // Create particles within the current map view
        for (let i = 0; i < this.numParticles; i++) {
            // Generate random lat/lon within current map bounds
            const lat = minLat + Math.random() * (maxLat - minLat);
            const lon = minLon + Math.random() * (maxLon - minLon);
    
            // Convert lat/lon to canvas coordinates
            const point = this.windGL.map.latLngToContainerPoint([lat, lon]);
    
            // Create particle with initial position in current map view
            const particle = {
                x: point.x,
                y: point.y,
                age: 0
            };
    
            this.particles.push(particle);
        }
    
        console.log('Total Particles Generated:', this.particles.length);
        console.groupEnd();
    }
    
    moveParticle(particle) {
        // Ensure the map and windGL are available
        if (!this.windGL.map) return false;
    
        // Convert canvas coordinates to lat/lon
        const latLon = this.canvasToLatLng(particle.x, particle.y);
        if (!latLon) return false;
    
        // Get wind data for this location
        const windData = this.windGL.getWindAtLatLon(latLon.lat, latLon.lng);
        if (!windData) return false;
    
        // Apply wind speed and direction
        const dx = windData.u * this.speedFactor;
        const dy = -windData.v * this.speedFactor;
    
        // Update particle position
        particle.x += dx;
        particle.y += dy;
    
        // Check if particle is still within canvas bounds
        const bounds = this.canvas.getBoundingClientRect();
        return particle.x >= 0 && particle.x <= bounds.width &&
               particle.y >= 0 && particle.y <= bounds.height;
    }
    
    canvasToLatLng(x, y) {
        const map = this.windGL.map;
        if (!map) return null;
    
        try {
            const point = map.containerPointToLatLng([x, y]);
            return {
                lat: point.lat,
                lng: point.lng
            };
        } catch (error) {
            console.error('Error converting canvas to lat/lon:', error);
            return null;
        }
    }

    createParticle(opt = {}) {
        return {
            x: opt.x || Math.random() * this.canvas.width,
            y: opt.y || Math.random() * this.canvas.height,
            age: 0
        };
    }

    

    draw() {
        const now = performance.now();
        if (now - this.lastUpdate < this.updateInterval) {
            if (this.running) {
                requestAnimationFrame(() => this.draw());
            }
            return;
        }
        this.lastUpdate = now;
    
        // Semi-transparent fade effect
        this.ctx.fillStyle = `rgba(0, 0, 0, ${1 - this.fadeOpacity})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
        // Draw particles
        this.ctx.fillStyle = this.particleColor;
        
        this.particles.forEach((particle, i) => {
            // More aggressive particle regeneration with probabilistic approach
            if (!this.moveParticle(particle) || 
                Math.random() < this.dropRate || 
                (Math.random() < this.dropRateBump && this.windGL.getWindAtLatLon)) {
                
                // Generate a new particle with more randomness
                const bounds = this.canvas.getBoundingClientRect();
                const map = this.windGL.map;
                
                // Try to generate a point within map bounds
                try {
                    const mapBounds = map.getBounds();
                    const southWest = mapBounds.getSouthWest();
                    const northEast = mapBounds.getNorthEast();
                    
                    // Random lat/lon within map bounds
                    const lat = southWest.lat + Math.random() * (northEast.lat - southWest.lat);
                    const lon = southWest.lng + Math.random() * (northEast.lng - southWest.lng);
                    
                    // Convert to canvas point
                    const point = map.latLngToContainerPoint([lat, lon]);
                    
                    this.particles[i] = {
                        x: point.x,
                        y: point.y,
                        age: 0
                    };
                } catch (error) {
                    // Fallback to random canvas regeneration
                    this.particles[i] = this.createParticle();
                }
            }
            
            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, this.particleSize, 0, Math.PI * 2);
            this.ctx.fill();
        });
    
        if (this.running) {
            requestAnimationFrame(() => this.draw());
        }
    }


    start() {
        if (!this.running) {
            this.running = true;
            this.initParticles();
            this.draw();
        }
    }

    stop() {
        this.running = false;
    }

    updateSize() {
        this.resize();
        if (this.running) {
            this.initParticles();
        }
    }
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the map
    const map = L.map('map-container', {
        center: [0, 0],
        noWrap: true,   
        zoom: 3,  
        maxBounds: [[-90, -180], [90, 180]], 
        maxBoundsViscosity: 1.0,   
        zoomControl: true,
        attributionControl: false,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: false
    });

    map.setMaxBounds([
        [-85.051129, -180], // Southwest coordinates
        [85.051129, 180]    // Northeast coordinates
    ]);

    // Add country borders layer
    var cbLayer = L.tileLayer.wms('https://geoportale.lamma.rete.toscana.it/geowebcache/service/wms?', {
        layers: 'confini_mondiali_stati',
        transparent: true,
        styles: 'confini_white',
        SRS: 'EPSG%3A900913',
        maxZoom: 18,
        minZoom: 1,
        version: '1.1.1',
        format: 'image/png',
        maxBounds: [[-90, -180], [90, 180]], 
        opacity: 1.0,
        className: 'wms-layer'
    }).addTo(map);

    // CartoDB_VoyagerOnlyLabels wms tiles
    var CartoDB_VoyagerOnlyLabels = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
        minZoom: 4
    }).addTo(map);

   

   /*
    // Custom logo control
    L.Control.Logo = L.Control.extend({
        onAdd: function(map) {
        var container = L.DomUtil.create('div', 'logo-control');
        var img = L.DomUtil.create('img', '', container);
        img.src = 'images/pelagos-logo.png'; // Replace with the path to your logo image
        img.alt = 'Logo';
        return container;
        },
    
        onRemove: function(map) {}
    });
    
    // Add logo control to the map
        var logoControl = new L.Control.Logo();
        map.addControl(logoControl);

    */

    

    // Add these functions to your code

    function testProjections() {
        // Test coordinates (lat/lon pairs)
        const testPoints = [
            { lat: 0, lon: 0 },
            { lat: 45, lon: -90 },
            { lat: -45, lon: 90 },
            { lat: 60, lon: 180 },
            { lat: -60, lon: -180 }
        ];
        
        console.log("=== Projection Test Results ===");
        
        // Test WindGL projection
        console.log("\nWindGL Mercator Projection Test:");
        testPoints.forEach(point => {
            // Convert to Mercator Y coordinate
            const mercY = latToMercator(point.lat);
            // Convert back to latitude
            const recoveredLat = mercatorToLat(mercY);
            
            console.log(`Original lat: ${point.lat.toFixed(4)}`);
            console.log(`Mercator Y: ${mercY.toFixed(4)}`);
            console.log(`Recovered lat: ${recoveredLat.toFixed(4)}`);
            console.log(`Difference: ${Math.abs(point.lat - recoveredLat).toFixed(6)}`);
            console.log("---");
        });
        
        // Test particle system projection through Leaflet
        if (window.particles && window.particles.windGL && window.particles.windGL.map) {
            console.log("\nParticle System (Leaflet) Projection Test:");
            testPoints.forEach(point => {
                const map = window.particles.windGL.map;
                // Convert lat/lon to pixel coordinates
                const pixelPoint = map.latLngToContainerPoint([point.lat, point.lon]);
                // Convert back to lat/lon
                const recoveredPoint = map.containerPointToLatLng(pixelPoint);
                
                console.log(`Original: ${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`);
                console.log(`Pixel coords: ${pixelPoint.x.toFixed(1)}, ${pixelPoint.y.toFixed(1)}`);
                console.log(`Recovered: ${recoveredPoint.lat.toFixed(4)}, ${recoveredPoint.lng.toFixed(4)}`);
                console.log(`Difference: ${Math.abs(point.lat - recoveredPoint.lat).toFixed(6)}, ${Math.abs(point.lon - recoveredPoint.lng).toFixed(6)}`);
                console.log("---");
            });
        }
    }

    // Corrected Mercator projection functions
    function latToMercator(lat) {
        // Convert latitude to radians
        const phi = lat * Math.PI / 180;
        // Mercator projection formula
        return Math.log(Math.tan(Math.PI / 4 + phi / 2));
    }

    function mercatorToLat(y) {
        // Inverse Mercator projection formula
        return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
    }

    // Add this line at the end of your initialization code:
    setTimeout(testProjections, 2000); // Wait for map to be fully initialized

    const infoDisplay = document.createElement('div');
    infoDisplay.id = 'info-display';
    infoDisplay.style.cssText = `
        position: absolute;
        bottom: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        z-index: 1000;
        max-width: 400px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    document.getElementById('container').appendChild(infoDisplay);

    // Initialize WebGL wind visualization
    const canvas = document.getElementById('canvas');
    const windInfo = document.getElementById('wind-info');
    const latElement = document.getElementById('lat');
    const lonElement = document.getElementById('lon');
    const speedElement = document.getElementById('speed');
    const directionElement = document.getElementById('direction');

    // Initialize state variables
    let lastCursorPosition = null;
    let zoom = 2.1;
    let offsetX = 0.0;
    let offsetY = 0.0;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    const pxRatio = Math.max(Math.floor(window.devicePixelRatio) || 1, 2);

    // Initialize WebGL
    const gl = canvas.getContext('webgl', {antialiasing: false});
    if (!gl) {
        console.error('WebGL not supported');
        document.getElementById('loading').innerHTML = 'WebGL not supported';
        return;
    }

    // Create wind instance
    const wind = window.wind = new WindGL(gl);
    wind.setMap(map);
    wind.setZoom(zoom, offsetX, offsetY);
    wind.setOpacity(1.0);
    wind.draw();

    // Initialize particles
    const particlesCanvas = document.getElementById('streamlines-canvas');
    const particles = new ParticleSystem(particlesCanvas, wind);

    // Set initial particle properties
    particles.numParticles = 3500;  // More particles
    particles.particleSize = 1.1;   // Slightly larger particles
    particles.speedFactor = 0.05;    // Good default speed
    particles.fadeOpacity = 0.96;   // Good fade effect
    particles.particleColor = '#ffffff';  // White particles
    // Define the wind files mapping
    const windFiles = {
        '20241231_00': '20241231_00_wind_0p25_20241231_00_run_f_000',
        '20241231_03': '20241231_03_wind_0p25_20241231_00_run_f_003',
        '20241231_06': '20241231_06_wind_0p25_20241231_00_run_f_006',
        '20241231_09': '20241231_09_wind_0p25_20241231_00_run_f_009',
        '20241231_12': '20241231_12_wind_0p25_20241231_00_run_f_012',
        '20241231_15': '20241231_15_wind_0p25_20241231_00_run_f_015',
        '20241231_18': '20241231_18_wind_0p25_20241231_00_run_f_018',
        '20241231_21': '20241231_21_wind_0p25_20241231_00_run_f_021',
        '20250101_00': '20250101_00_wind_0p25_20241231_00_run_f_024',
        '20250101_03': '20250101_03_wind_0p25_20241231_00_run_f_027',
        '20250101_06': '20250101_06_wind_0p25_20241231_00_run_f_030',
        '20250101_09': '20250101_09_wind_0p25_20241231_00_run_f_033',
        '20250101_12': '20250101_12_wind_0p25_20241231_00_run_f_036',
        '20250101_15': '20250101_15_wind_0p25_20241231_00_run_f_039',
        '20250101_18': '20250101_18_wind_0p25_20241231_00_run_f_042',
        '20250101_21': '20250101_21_wind_0p25_20241231_00_run_f_045',
        '20250102_00': '20250102_00_wind_0p25_20241231_00_run_f_048',
        '20250102_03': '20250102_03_wind_0p25_20241231_00_run_f_051',
        '20250102_06': '20250102_06_wind_0p25_20241231_00_run_f_054',
        '20250102_09': '20250102_09_wind_0p25_20241231_00_run_f_057',
        '20250102_12': '20250102_12_wind_0p25_20241231_00_run_f_060',
        '20250102_15': '20250102_15_wind_0p25_20241231_00_run_f_063',
        '20250102_18': '20250102_18_wind_0p25_20241231_00_run_f_066',
        '20250102_21': '20250102_21_wind_0p25_20241231_00_run_f_069',
        '20250103_00': '20250103_00_wind_0p25_20241231_00_run_f_072',
        '20250103_03': '20250103_03_wind_0p25_20241231_00_run_f_075',
        '20250103_06': '20250103_06_wind_0p25_20241231_00_run_f_078',
        '20250103_09': '20250103_09_wind_0p25_20241231_00_run_f_081',
        '20250103_12': '20250103_12_wind_0p25_20241231_00_run_f_084',
        '20250103_15': '20250103_15_wind_0p25_20241231_00_run_f_087',
        '20250103_18': '20250103_18_wind_0p25_20241231_00_run_f_090',
        '20250103_21': '20250103_21_wind_0p25_20241231_00_run_f_093',
        '20250104_00': '20250104_00_wind_0p25_20241231_00_run_f_096',
        '20250104_03': '20250104_03_wind_0p25_20241231_00_run_f_099',
        '20250104_06': '20250104_06_wind_0p25_20241231_00_run_f_102',
        '20250104_09': '20250104_09_wind_0p25_20241231_00_run_f_105',
        '20250104_12': '20250104_12_wind_0p25_20241231_00_run_f_108',
        '20250104_15': '20250104_15_wind_0p25_20241231_00_run_f_111',
        '20250104_18': '20250104_18_wind_0p25_20241231_00_run_f_114',
        '20250104_21': '20250104_21_wind_0p25_20241231_00_run_f_117',
        '20250105_00': '20250105_00_wind_0p25_20241231_00_run_f_120',
        '20250105_03': '20250105_03_wind_0p25_20241231_00_run_f_123',
        '20250105_06': '20250105_06_wind_0p25_20241231_00_run_f_126',
        '20250105_09': '20250105_09_wind_0p25_20241231_00_run_f_129',
        '20250105_12': '20250105_12_wind_0p25_20241231_00_run_f_132',
        '20250105_15': '20250105_15_wind_0p25_20241231_00_run_f_135',
        '20250105_18': '20250105_18_wind_0p25_20241231_00_run_f_138',
        '20250105_21': '20250105_21_wind_0p25_20241231_00_run_f_141',
        '20250106_00': '20250106_00_wind_0p25_20241231_00_run_f_144',
        '20250106_03': '20250106_03_wind_0p25_20241231_00_run_f_147',
        '20250106_06': '20250106_06_wind_0p25_20241231_00_run_f_150',
        '20250106_09': '20250106_09_wind_0p25_20241231_00_run_f_153',
        '20250106_12': '20250106_12_wind_0p25_20241231_00_run_f_156',
        '20250106_15': '20250106_15_wind_0p25_20241231_00_run_f_159',
        '20250106_18': '20250106_18_wind_0p25_20241231_00_run_f_162',
        '20250106_21': '20250106_21_wind_0p25_20241231_00_run_f_165',
        '20250107_00': '20250107_00_wind_0p25_20241231_00_run_f_168',
        '20250107_03': '20250107_03_wind_0p25_20241231_00_run_f_171',
        '20250107_06': '20250107_06_wind_0p25_20241231_00_run_f_174',
        '20250107_09': '20250107_09_wind_0p25_20241231_00_run_f_177',
        '20250107_12': '20250107_12_wind_0p25_20241231_00_run_f_180',
        '20250107_15': '20250107_15_wind_0p25_20241231_00_run_f_183',
        '20250107_18': '20250107_18_wind_0p25_20241231_00_run_f_186',
        '20250107_21': '20250107_21_wind_0p25_20241231_00_run_f_189',
        '20250108_00': '20250108_00_wind_0p25_20241231_00_run_f_192',
        '20250108_03': '20250108_03_wind_0p25_20241231_00_run_f_195',
        '20250108_06': '20250108_06_wind_0p25_20241231_00_run_f_198',
        '20250108_09': '20250108_09_wind_0p25_20241231_00_run_f_201',
        '20250108_12': '20250108_12_wind_0p25_20241231_00_run_f_204',
        '20250108_15': '20250108_15_wind_0p25_20241231_00_run_f_207',
        '20250108_18': '20250108_18_wind_0p25_20241231_00_run_f_210',
        '20250108_21': '20250108_21_wind_0p25_20241231_00_run_f_213',
        '20250109_00': '20250109_00_wind_0p25_20241231_00_run_f_216',
        '20250109_03': '20250109_03_wind_0p25_20241231_00_run_f_219',
        '20250109_06': '20250109_06_wind_0p25_20241231_00_run_f_222',
        '20250109_09': '20250109_09_wind_0p25_20241231_00_run_f_225',
        '20250109_12': '20250109_12_wind_0p25_20241231_00_run_f_228',
        '20250109_15': '20250109_15_wind_0p25_20241231_00_run_f_231',
        '20250109_18': '20250109_18_wind_0p25_20241231_00_run_f_234',
        '20250109_21': '20250109_21_wind_0p25_20241231_00_run_f_237',
        '20250110_00': '20250110_00_wind_0p25_20241231_00_run_f_240'
    };

    function formatBounds(bounds) {
        return `N: ${bounds.north?.toFixed(5) || bounds._northEast?.lat.toFixed(5)}° | 
                S: ${bounds.south?.toFixed(5) || bounds._southWest?.lat.toFixed(5)}° | 
                E: ${bounds.east?.toFixed(5) || bounds._northEast?.lng.toFixed(5)}° | 
                W: ${bounds.west?.toFixed(5) || bounds._southWest?.lng.toFixed(5)}°`;
    }

    function updateWindDisplay(clientX, clientY) {
        if (wind && wind.windData) {
            const leafletPoint = map.containerPointToLatLng([clientX, clientY]);
            const canvasCoords = wind.screenToLatLon(clientX, clientY);
            
            const canvasBounds = wind.getBounds();
            const leafletBounds = map.getBounds();
            const leafletCenter = map.getCenter();
            const canvasCenter = canvasBounds._center;
            
            const windData = wind.getWindAtPoint({
                lat: leafletPoint.lat,
                lon: leafletPoint.lng
            });
            
            if (windData) {
                const speed = wind.calculateWindSpeed(windData.u, windData.v);
                const direction = wind.calculateWindDirection(windData.u, windData.v);
                
                infoDisplay.innerHTML = `
                    
                    <div style="border-bottom: 1px solid rgba(255,255,255,0.3); margin-bottom: 8px; padding-bottom: 8px;">
                        <strong>Mouse Position (Leaflet):</strong><br>
                        Lat: ${leafletPoint.lat.toFixed(5)}° | Lon: ${leafletPoint.lng.toFixed(5)}°
                    </div>
                    <div style="border-bottom: 1px solid rgba(255,255,255,0.3); margin-bottom: 8px; padding-bottom: 8px;">
                        <strong>Wind Data:</strong><br>
                        Speed: ${(speed * 1.94384).toFixed(1)} kt<br>
                        Direction: ${direction.toFixed(0)}°<br>
                        Forecast time: ${meta['forecast time']}
                    </div>
                    <div>
                        <strong>Zoom Levels:</strong><br>
                        Map zoom: ${map.getZoom().toFixed(2)}<br>
                        Canvas zoom: ${wind.zoom.toFixed(2)}
                    </div>
                    
                `;
            }
        }
    }

    // Map event handlers
    map.on('move', function() {
        wind.syncWithLeafletBounds(map);
    });

    map.on('moveend', function() {
        meta['map zoom'] = map.getZoom();
        zoomController.updateDisplay();
        wind.updateBoundsFromLeaflet();
    });

    // Mouse event handlers
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        lastCursorPosition = {
            clientX: e.clientX,
            clientY: e.clientY
        };
        
        updateWindDisplay(e.clientX, e.clientY);

        if (isDragging) {
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            
            const center = map.getCenter();
            const containerHeight = map.getContainer().clientHeight;
            
            // Convert current latitude to Mercator
            const currentMercatorLat = toMercatorLatitude(center.lat);
            
            // Calculate change in Mercator coordinates
            const mercatorLatChange = (dy / containerHeight) * (180 / wind.zoom);
            const newMercatorLat = currentMercatorLat + mercatorLatChange;

            
            // Convert back from Mercator to regular latitude
            const newLat = fromMercatorLatitude(newMercatorLat);
            
            // Ensure latitude stays within valid Mercator range
            const clampedLat = Math.max(-85.051129, Math.min(85.051129, newLat));
            
            // Calculate new longitude
            const newLng = center.lng - (dx / map.getContainer().clientWidth) * 360;
            
            map.setView([clampedLat, newLng], map.getZoom(), {
                animate: false,
                duration: 0
            });
            
            lastX = e.clientX;
            lastY = e.clientY;
            
            // Force immediate synchronization
            wind.syncWithLeafletBounds(map);
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            // Final synchronization after drag ends
            wind.updateBoundsFromLeaflet();
        }
    });

    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
    });

    // Mercator projection helper functions
    function toMercatorLatitude(lat) {
        const latRad = lat * Math.PI / 180;
        return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    }
    
    function fromMercatorLatitude(mercatorY) {
        return (2 * Math.atan(Math.exp(mercatorY)) - Math.PI / 2) * 180 / Math.PI;
    }

    // GUI setup
    const gui = new dat.GUI({ width: 300 });
    const meta = {
        'forecast time': '20241231_00',
        'retina resolution': false,
        'map zoom': 3,
        'opacity': 1.0,
        'canvas opacity': 1.0,
        'wms opacity': 1.0,
        'reset view': function() {
            map.setView([0, 0], 2);
            meta['map zoom'] = 2;
            wind.setOpacity(1.0);
            cbLayer.setOpacity(1.0);
            meta['opacity'] = 1.0;
            meta['wms opacity'] = 1.0;
            zoomController.updateDisplay();
            opacityController.updateDisplay();
            wmsOpacityController.updateDisplay();
            wind.syncWithLeafletBounds(map);
        },
        'toggle animation': false
    };

    // GUI controls
    const timeControl = gui.add(meta, 'forecast time', Object.keys(windFiles));
    timeControl.onFinishChange(updateWind);

    if (pxRatio !== 1) {
        const retinaControl = gui.add(meta, 'retina resolution');
        retinaControl.onFinishChange(updateRetina);
    }

    const zoomController = gui.add(meta, 'map zoom', 1, 8).step(0.1);
    zoomController.onChange((value) => {
        map.setZoom(value);
    });

    const opacityController = gui.add(meta, 'opacity', 0, 1).step(0.00001);
    opacityController.onChange((value) => {
        wind.setOpacity(value);
        wind.draw();
    });

    gui.add(meta, 'reset view');
    

    const wmsFolder = gui.addFolder('WMS Layer Controls');
    const wmsOpacityController = wmsFolder.add(meta, 'wms opacity', 0, 1).step(0.00001);
    wmsOpacityController.onChange((value) => {
        cbLayer.setOpacity(value);
    });
    // Time slider controls
    const timeSlider = document.getElementById('timeSlider');
    const timeLabel = document.getElementById('timeLabel');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const prevTimeBtn = document.getElementById('prevTimeBtn');
    const nextTimeBtn = document.getElementById('nextTimeBtn');
    const speedBtn = document.getElementById('speedBtn');

    let isPlaying = false;
    let animationFrame;
    let lastTime = 0;
    let frameInterval = 1000; // Default 1 second interval
    let speedMultiplier = 1;

    // Convert windFiles keys to array for easier navigation
    const timeSteps = Object.keys(windFiles);
    timeSlider.max = timeSteps.length - 1;

    function updateTimeLabel(index) {
        const time = timeSteps[index];
        const date = new Date(time.substring(0, 4) + '-' + 
                            time.substring(4, 6) + '-' + 
                            time.substring(6, 8) + 'T' + 
                            time.substring(9, 11) + ':00:00Z');
        
        // Format the date and time
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        
        // Create the formatted string: MM/DD/YYYY, HH:00
        timeLabel.textContent = `${month}/${day}/${year}, ${hours}:00`;
    }

    // Initialize slider and label
    updateTimeLabel(0);

    // Slider event listener
    timeSlider.addEventListener('input', function() {
        const index = parseInt(this.value);
        updateTimeLabel(index);
        updateWind(timeSteps[index]);
    });

    // Play/Pause button
    playPauseBtn.addEventListener('click', function() {
        isPlaying = !isPlaying;
        this.textContent = isPlaying ? 'Pause' : 'Play';
        if (isPlaying) {
            startAnimation();
        } else {
            stopAnimation();
        }
    });

    // Previous/Next buttons
    prevTimeBtn.addEventListener('click', function() {
        const currentIndex = parseInt(timeSlider.value);
        if (currentIndex > 0) {
            timeSlider.value = currentIndex - 1;
            updateTimeLabel(currentIndex - 1);
            updateWind(timeSteps[currentIndex - 1]);
        }
    });

    nextTimeBtn.addEventListener('click', function() {
        const currentIndex = parseInt(timeSlider.value);
        if (currentIndex < timeSteps.length - 1) {
            timeSlider.value = currentIndex + 1;
            updateTimeLabel(currentIndex + 1);
            updateWind(timeSteps[currentIndex + 1]);
        }
    });

    // Speed button
    speedBtn.addEventListener('click', function() {
        const speeds = [1, 2, 4, 8];
        speedMultiplier = speeds[(speeds.indexOf(speedMultiplier) + 1) % speeds.length];
        this.textContent = speedMultiplier + 'x';
        frameInterval = 1000 / speedMultiplier;
    });

    // Replace your existing animation functions with these:
    function startAnimation() {
        lastTime = performance.now();
        animate();
    }

    function stopAnimation() {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
    }

    function animate() {
        if (!isPlaying) return;
        
        const currentTime = performance.now();
        if (currentTime - lastTime >= frameInterval) {
            const currentIndex = parseInt(timeSlider.value);
            const nextIndex = (currentIndex + 1) % timeSteps.length;
            
            timeSlider.value = nextIndex;
            updateTimeLabel(nextIndex);
            updateWind(timeSteps[nextIndex]);
            
            // Stop at the end unless speed is set
            if (nextIndex === 0 && speedMultiplier === 1) {
                isPlaying = false;
                playPauseBtn.textContent = 'Play';
                return;
            }
            
            lastTime = currentTime;
        }
        animationFrame = requestAnimationFrame(animate);
    }
    
    function updateWind(forecastTime) {
    const windFileName = windFiles[forecastTime];
    const metadataPath = 'wind/' + windFileName + '_metadata.json';
    const imagePath = 'wind/' + windFileName + '.png';

    fetch(metadataPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(windData => {
            const windImage = new Image();
            windImage.crossOrigin = 'anonymous';
            windData.image = windImage;
            windImage.src = imagePath;
            
            windImage.onerror = function() {
                console.error('Failed to load wind image:', imagePath);
                document.getElementById('loading').innerHTML = `Error loading wind image: ${imagePath}`;
            };

            windImage.onload = function() {
                // Update wind visualization
                wind.setWind(windData);
                wind.setOpacity(meta['opacity']);
                wind.syncWithLeafletBounds(map);
                
                // Ensure particles are updated
                if (particles && particles.windGL) {
                    // Stop current particle animation
                    particles.stop();

                    // Clear temporary canvas to force recreation
                    particles.windGL._tempCanvas = null;
                    particles.windGL._tempCtx = null;
                    particles.windGL._imageData = null;

                    // Update wind data for particles
                    particles.windGL.setWind(windData);

                    // Reinitialize particles with new wind field
                    particles.initParticles();

                    // Restart particles if they were previously running or show is enabled
                    if (meta.particles.show) {
                        particles.start();
                    }
                }
                
                // Update metadata and UI
                meta['forecast time'] = forecastTime;
                
                // Check and update wind display if cursor position exists
                if (lastCursorPosition) {
                    updateWindDisplay(lastCursorPosition.clientX, lastCursorPosition.clientY);
                }

                document.getElementById('loading').style.display = 'none';
            };
        })
        .catch(error => {
            console.error('Detailed Fetch Error:', error);
            document.getElementById('loading').innerHTML = `Detailed Error: ${error.message}`;
        });
        console.groupEnd(); // Wind Update Debug
    }
    
    // Add a global error handler to catch any unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled Promise Rejection:', event.reason);
    });

    // Add Particle Controls to GUI
    const particleFolder = gui.addFolder('Particle Controls');

    meta['particles'] = {
        show: true,
        count: 5000,
        size: 1.1,
        speed: 0.3,
        fadeOpacity: 0,
        color: '#ffffff',
        fps: 60
    };

    particleFolder.add(meta.particles, 'show').onChange(value => {
        if (value) {
            particles.start();
        } else {
            particles.stop();
        }
    });

    particleFolder.add(meta.particles, 'count', 1000, 10000).step(100).onChange(value => {
        particles.numParticles = value;
        particles.initParticles();
    });

    particleFolder.add(meta.particles, 'size', 0.5, 3).step(0.1).onChange(value => {
        particles.particleSize = value;
    });

    particleFolder.add(meta.particles, 'speed', 0.1, 1.0).step(0.1).onChange(value => {
        particles.speedFactor = value;
    });

    particleFolder.add(meta.particles, 'fadeOpacity', 0.9, 0.99).step(0.01).onChange(value => {
        particles.fadeOpacity = value;
    });

    particleFolder.addColor(meta.particles, 'color').onChange(value => {
        particles.particleColor = value;
    });

    particleFolder.add(meta.particles, 'fps', 30, 60).step(5).onChange(value => {
        particles.updateInterval = 1000 / value;
    });
    
    function updateRetina() {
        const ratio = meta['retina resolution'] ? 2 : 1;
        canvas.width = canvas.clientWidth * ratio;
        canvas.height = canvas.clientHeight * ratio;
        gl.viewport(0, 0, canvas.width, canvas.height);
        wind.draw();
    }

    function updateCanvasSize() {
        const container = document.getElementById('container');
        const windowWidth = container.clientWidth;
        const windowHeight = container.clientHeight;
        
        canvas.width = windowWidth * pxRatio;
        canvas.height = windowHeight * pxRatio;
        canvas.style.width = windowWidth + 'px';
        canvas.style.height = windowHeight + 'px';
        
        const mapContainer = document.getElementById('map-container');
        mapContainer.style.width = windowWidth + 'px';
        mapContainer.style.height = windowHeight + 'px';
        
        map.invalidateSize(false);
        gl.viewport(0, 0, canvas.width, canvas.height);
        
        if (wind && wind.windData) {
            wind.updateSize();
            wind.syncWithLeafletBounds(map);
        }
    }

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            updateCanvasSize();
            if (particles) {
                particles.stop();
                particles.updateSize();
                particles.start();
            }
            if (lastCursorPosition) {
                updateWindDisplay(lastCursorPosition.clientX, lastCursorPosition.clientY);
            }
        }, 100);
    });

    

    function createWindScale() {
        const windScaleDiv = document.querySelector('.wind-scale');
        const gradientEl = windScaleDiv.querySelector('.wind-scale-gradient');
        const labelsEl = windScaleDiv.querySelector('.wind-scale-labels');
        
        /*
        const colorStops = [
            { stop: 0.0, color: '#3288bd', knots: 0 },
            { stop: 0.5, color: '#66c2a5', knots: 10 },
            { stop: 0.1, color: '#abdda4', knots: 20 },
            { stop: 0.15, color: '#e6f598', knots: 30 },
            { stop: 0.2, color: '#fee08b', knots: 40 },
            { stop: 0.3, color: '#fdae61', knots: 50 },
            { stop: 0.4, color: '#f46d43', knots: 60 },
            { stop: 0.45, color: '#d53e4f', knots: 65 },
            { stop: 1.0, color: '#7d44a5', knots: 70 }
        ];
        */
        
       
        
        const colorStops = [
            { stop: 0.0, color: 'rgb(118,133,223)', speed: 0 },    // Brighter blue
            { stop: 0.02, color: 'rgb(67,117,199)', speed: 1 },    // More saturated blue
            { stop: 0.06, color: 'rgb(84,178,209)', speed: 3 },    // Brighter cyan
            { stop: 0.1, color: 'rgb(87,171,143)', speed: 5 },     // More vibrant teal
            { stop: 0.14, color: 'rgb(93,205,93)', speed: 7 },     // Brighter green
            { stop: 0.18, color: 'rgb(63,199,63)', speed: 9 },     // More saturated green
            { stop: 0.22, color: 'rgb(207,197,81)', speed: 11 },   // Brighter yellow
            { stop: 0.26, color: 'rgb(199,147,58)', speed: 13 },   // More saturated orange
            { stop: 0.3, color: 'rgb(201,118,92)', speed: 15 },    // Brighter orange-red
            { stop: 0.34, color: 'rgb(169,58,78)', speed: 17 },    // More saturated red
            { stop: 0.38, color: 'rgb(215,80,156)', speed: 19 },   // Brighter magenta
            { stop: 0.42, color: 'rgb(147,74,187)', speed: 21 },   // More saturated purple
            { stop: 0.48, color: 'rgb(129,107,223)', speed: 24 },  // Brighter purple-blue
            { stop: 0.54, color: 'rgb(78,125,181)', speed: 27 },   // More saturated blue
            { stop: 0.58, color: 'rgb(102,174,192)', speed: 29 },  // Brighter cyan
            { stop: 0.72, color: 'rgb(155,78,225)', speed: 36 },   // More vibrant purple
            { stop: 0.92, color: 'rgb(255,235,235)', speed: 46 },  // Almost white
            { stop: 1.0, color: 'rgb(168,168,168)', speed: 104 }   // Brighter gray
        ];
       
       
       
        
       /*
        const colorStops = [
            { stop: 0.0, color: 'rgb(64,89,191)', speed: 0 },
            { stop: 0.05, color: 'rgb(71,142,196)', speed: 5 },
            { stop: 0.1, color: 'rgb(76,195,188)', speed: 10 },
            { stop: 0.15, color: 'rgb(86,205,99)', speed: 15 },
            { stop: 0.2, color: 'rgb(148,223,87)', speed: 20 },
            { stop: 0.3, color: 'rgb(205,225,97)', speed: 30 },
            { stop: 0.4, color: 'rgb(248,207,87)', speed: 40 },
            { stop: 0.5, color: 'rgb(252,174,75)', speed: 50 },
            { stop: 0.6, color: 'rgb(245,132,66)', speed: 60 },
            { stop: 0.7, color: 'rgb(235,89,95)', speed: 70 },
            { stop: 0.8, color: 'rgb(222,67,130)', speed: 80 },
            { stop: 0.9, color: 'rgb(178,67,175)', speed: 90 },
            { stop: 1.0, color: 'rgb(156,67,205)', speed: 100 }
        ];
        */
    
        const gradientString = `linear-gradient(to top, ${
            colorStops.map(({stop, color}) => `${color} ${stop * 100}%`).join(', ')
        })`;
    
        gradientEl.style.background = gradientString;
        labelsEl.innerHTML = colorStops
            .slice()
            .reverse()
            .map(({knots}) => `<div class="scale-label">${knots} kt</div>`)
            .join('');
    }
    
    setTimeout(createWindScale, 1000);
    createWindScale();

    // Initial setup
    updateCanvasSize();
    wind.syncWithLeafletBounds(map);
    updateWind('20241231_00');
});