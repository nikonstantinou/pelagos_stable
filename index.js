console.log("Script is running");

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

   

    // Create custom logo control
    // Custom logo control
    L.Control.Logo = L.Control.extend({
        onAdd: function(map) {
        var container = L.DomUtil.create('div', 'logo-control');
        var img = L.DomUtil.create('img', '', container);
        img.src = 'path/to/your/logo.png'; // Replace with the path to your logo image
        img.alt = 'Logo';
        return container;
        },
    
        onRemove: function(map) {}
    });
    
    // Add logo control to the map
        var logoControl = new L.Control.Logo();
        map.addControl(logoControl);

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

    // Define the wind files mapping
    const windFiles = {
        '20241221_06': '20241221_06_wind_0p25_20241221_06_run_f_000',
        '20241221_09': '20241221_09_wind_0p25_20241221_06_run_f_003',
        '20241221_12': '20241221_12_wind_0p25_20241221_06_run_f_006',
        '20241221_15': '20241221_15_wind_0p25_20241221_06_run_f_009',
        '20241221_18': '20241221_18_wind_0p25_20241221_06_run_f_012',
        '20241221_21': '20241221_21_wind_0p25_20241221_06_run_f_015',
        '20241222_00': '20241222_00_wind_0p25_20241221_06_run_f_018',
        '20241222_03': '20241222_03_wind_0p25_20241221_06_run_f_021',
        '20241222_06': '20241222_06_wind_0p25_20241221_06_run_f_024',
        '20241222_09': '20241222_09_wind_0p25_20241221_06_run_f_027',
        '20241222_12': '20241222_12_wind_0p25_20241221_06_run_f_030',
        '20241222_15': '20241222_15_wind_0p25_20241221_06_run_f_033',
        '20241222_18': '20241222_18_wind_0p25_20241221_06_run_f_036',
        '20241222_21': '20241222_21_wind_0p25_20241221_06_run_f_039',
        '20241223_00': '20241223_00_wind_0p25_20241221_06_run_f_042',
        '20241223_03': '20241223_03_wind_0p25_20241221_06_run_f_045',
        '20241223_06': '20241223_06_wind_0p25_20241221_06_run_f_048',
        '20241223_09': '20241223_09_wind_0p25_20241221_06_run_f_051',
        '20241223_12': '20241223_12_wind_0p25_20241221_06_run_f_054',
        '20241223_15': '20241223_15_wind_0p25_20241221_06_run_f_057',
        '20241223_18': '20241223_18_wind_0p25_20241221_06_run_f_060',
        '20241223_21': '20241223_21_wind_0p25_20241221_06_run_f_063',
        '20241224_00': '20241224_00_wind_0p25_20241221_06_run_f_066',
        '20241224_03': '20241224_03_wind_0p25_20241221_06_run_f_069',
        '20241224_06': '20241224_06_wind_0p25_20241221_06_run_f_072',
        '20241224_09': '20241224_09_wind_0p25_20241221_06_run_f_075',
        '20241224_12': '20241224_12_wind_0p25_20241221_06_run_f_078',
        '20241224_15': '20241224_15_wind_0p25_20241221_06_run_f_081',
        '20241224_18': '20241224_18_wind_0p25_20241221_06_run_f_084',
        '20241224_21': '20241224_21_wind_0p25_20241221_06_run_f_087',
        '20241225_00': '20241225_00_wind_0p25_20241221_06_run_f_090',
        '20241225_03': '20241225_03_wind_0p25_20241221_06_run_f_093',
        '20241225_06': '20241225_06_wind_0p25_20241221_06_run_f_096',
        '20241225_09': '20241225_09_wind_0p25_20241221_06_run_f_099',
        '20241225_12': '20241225_12_wind_0p25_20241221_06_run_f_102',
        '20241225_15': '20241225_15_wind_0p25_20241221_06_run_f_105',
        '20241225_18': '20241225_18_wind_0p25_20241221_06_run_f_108',
        '20241225_21': '20241225_21_wind_0p25_20241221_06_run_f_111',
        '20241226_00': '20241226_00_wind_0p25_20241221_06_run_f_114',
        '20241226_03': '20241226_03_wind_0p25_20241221_06_run_f_117',
        '20241226_06': '20241226_06_wind_0p25_20241221_06_run_f_120',
        '20241226_09': '20241226_09_wind_0p25_20241221_06_run_f_123',
        '20241226_12': '20241226_12_wind_0p25_20241221_06_run_f_126',
        '20241226_15': '20241226_15_wind_0p25_20241221_06_run_f_129',
        '20241226_18': '20241226_18_wind_0p25_20241221_06_run_f_132',
        '20241226_21': '20241226_21_wind_0p25_20241221_06_run_f_135',
        '20241227_00': '20241227_00_wind_0p25_20241221_06_run_f_138',
        '20241227_03': '20241227_03_wind_0p25_20241221_06_run_f_141',
        '20241227_06': '20241227_06_wind_0p25_20241221_06_run_f_144',
        '20241227_09': '20241227_09_wind_0p25_20241221_06_run_f_147',
        '20241227_12': '20241227_12_wind_0p25_20241221_06_run_f_150',
        '20241227_15': '20241227_15_wind_0p25_20241221_06_run_f_153',
        '20241227_18': '20241227_18_wind_0p25_20241221_06_run_f_156',
        '20241227_21': '20241227_21_wind_0p25_20241221_06_run_f_159',
        '20241228_00': '20241228_00_wind_0p25_20241221_06_run_f_162',
        '20241228_03': '20241228_03_wind_0p25_20241221_06_run_f_165',
        '20241228_06': '20241228_06_wind_0p25_20241221_06_run_f_168',
        '20241228_09': '20241228_09_wind_0p25_20241221_06_run_f_171',
        '20241228_12': '20241228_12_wind_0p25_20241221_06_run_f_174',
        '20241228_15': '20241228_15_wind_0p25_20241221_06_run_f_177',
        '20241228_18': '20241228_18_wind_0p25_20241221_06_run_f_180',
        '20241228_21': '20241228_21_wind_0p25_20241221_06_run_f_183',
        '20241229_00': '20241229_00_wind_0p25_20241221_06_run_f_186',
        '20241229_03': '20241229_03_wind_0p25_20241221_06_run_f_189',
        '20241229_06': '20241229_06_wind_0p25_20241221_06_run_f_192',
        '20241229_09': '20241229_09_wind_0p25_20241221_06_run_f_195',
        '20241229_12': '20241229_12_wind_0p25_20241221_06_run_f_198',
        '20241229_15': '20241229_15_wind_0p25_20241221_06_run_f_201',
        '20241229_18': '20241229_18_wind_0p25_20241221_06_run_f_204',
        '20241229_21': '20241229_21_wind_0p25_20241221_06_run_f_207',
        '20241230_00': '20241230_00_wind_0p25_20241221_06_run_f_210',
        '20241230_03': '20241230_03_wind_0p25_20241221_06_run_f_213',
        '20241230_06': '20241230_06_wind_0p25_20241221_06_run_f_216',
        '20241230_09': '20241230_09_wind_0p25_20241221_06_run_f_219',
        '20241230_12': '20241230_12_wind_0p25_20241221_06_run_f_222',
        '20241230_15': '20241230_15_wind_0p25_20241221_06_run_f_225',
        '20241230_18': '20241230_18_wind_0p25_20241221_06_run_f_228',
        '20241230_21': '20241230_21_wind_0p25_20241221_06_run_f_231',
        '20241231_00': '20241231_00_wind_0p25_20241221_06_run_f_234',
        '20241231_03': '20241231_03_wind_0p25_20241221_06_run_f_237',
        '20241231_06': '20241231_06_wind_0p25_20241221_06_run_f_240'
        
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
        return (Math.log(Math.tan(Math.PI / 4 + latRad / 2)) * 180 / Math.PI);
    }

    function fromMercatorLatitude(mercatorLat) {
        const mercatorLatRad = mercatorLat * Math.PI / 180;
        return (2 * Math.atan(Math.exp(mercatorLatRad)) - Math.PI / 2) * 180 / Math.PI;
    }

    // GUI setup
    const gui = new dat.GUI({ width: 300 });
    const meta = {
        'forecast time': '20241221_06',
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

    // Update time label function
    function updateTimeLabel(index) {
        const time = timeSteps[index];
        const date = new Date(time.substring(0, 4) + '-' + 
                            time.substring(4, 6) + '-' + 
                            time.substring(6, 8) + 'T' + 
                            time.substring(9, 11) + ':00:00Z');
        timeLabel.textContent = date.toLocaleString();
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
                    windData.image = windImage;
                    wind.setWind(windData);
                    wind.setOpacity(meta['opacity']);
                    wind.syncWithLeafletBounds(map);
                    
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
    }

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
            if (lastCursorPosition) {
                updateWindDisplay(lastCursorPosition.clientX, lastCursorPosition.clientY);
            }
        }, 100);
    });

    function createWindScale() {
        const windScaleDiv = document.querySelector('.wind-scale');
        const gradientEl = windScaleDiv.querySelector('.wind-scale-gradient');
        const labelsEl = windScaleDiv.querySelector('.wind-scale-labels');
        
        
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
        
        
        /*
        const colorStops = [
            { stop: 0.0, color: 'rgb(98,113,183)', speed: 0 },
            { stop: 0.02, color: 'rgb(57,97,159)', speed: 1 },
            { stop: 0.06, color: 'rgb(74,148,169)', speed: 3 },
            { stop: 0.1, color: 'rgb(77,141,123)', speed: 5 },
            { stop: 0.14, color: 'rgb(83,165,83)', speed: 7 },
            { stop: 0.18, color: 'rgb(53,159,53)', speed: 9 },
            { stop: 0.22, color: 'rgb(167,157,81)', speed: 11 },
            { stop: 0.26, color: 'rgb(159,127,58)', speed: 13 },
            { stop: 0.3, color: 'rgb(161,108,92)', speed: 15 },
            { stop: 0.34, color: 'rgb(129,58,78)', speed: 17 },
            { stop: 0.38, color: 'rgb(175,80,136)', speed: 19 },
            { stop: 0.42, color: 'rgb(117,74,147)', speed: 21 },
            { stop: 0.48, color: 'rgb(109,97,163)', speed: 24 },
            { stop: 0.54, color: 'rgb(68,105,141)', speed: 27 },
            { stop: 0.58, color: 'rgb(92,144,152)', speed: 29 },
            { stop: 0.72, color: 'rgb(125,68,165)', speed: 36 },
            { stop: 0.92, color: 'rgb(231,215,215)', speed: 46 },
            { stop: 1.0, color: 'rgb(128,128,128)', speed: 104 }
        ];
        */
        
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
    updateWind('20241221_06');
});