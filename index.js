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
        minZoom: 3
    }).addTo(map);

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
    const windFiles = {'20241220_12': '20241220_12_wind_0p25_20241220_12_run_f_000',
'20241220_15': '20241220_15_wind_0p25_20241220_12_run_f_003',
'20241220_18': '20241220_18_wind_0p25_20241220_12_run_f_006',
'20241220_21': '20241220_21_wind_0p25_20241220_12_run_f_009',
'20241221_00': '20241221_00_wind_0p25_20241220_12_run_f_012',
'20241221_03': '20241221_03_wind_0p25_20241220_12_run_f_015',
'20241221_06': '20241221_06_wind_0p25_20241220_12_run_f_018',
'20241221_09': '20241221_09_wind_0p25_20241220_12_run_f_021',
'20241221_12': '20241221_12_wind_0p25_20241220_12_run_f_024',
'20241221_15': '20241221_15_wind_0p25_20241220_15_run_f_027',
'20241221_18': '20241221_18_wind_0p25_20241220_12_run_f_030',
'20241221_21': '20241221_21_wind_0p25_20241220_12_run_f_033',
'20241222_00': '20241222_00_wind_0p25_20241220_12_run_f_036',
'20241222_03': '20241222_03_wind_0p25_20241220_12_run_f_039',
'20241222_06': '20241222_06_wind_0p25_20241220_12_run_f_042',
'20241222_09': '20241222_09_wind_0p25_20241220_12_run_f_045',
'20241222_12': '20241222_12_wind_0p25_20241220_12_run_f_048',
'20241222_15': '20241222_15_wind_0p25_20241220_12_run_f_051',
'20241222_18': '20241222_18_wind_0p25_20241220_12_run_f_054',
'20241222_21': '20241222_21_wind_0p25_20241220_12_run_f_057',
'20241223_00': '20241223_00_wind_0p25_20241220_12_run_f_060',
'20241223_03': '20241223_03_wind_0p25_20241220_12_run_f_063',
'20241223_06': '20241223_06_wind_0p25_20241220_12_run_f_066',
'20241223_09': '20241223_09_wind_0p25_20241220_12_run_f_069',
'20241223_12': '20241223_12_wind_0p25_20241220_12_run_f_072'

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
        'forecast time': '20241220_12',
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

    // Animation controls
    const animationControl = gui.add(meta, 'toggle animation');
    let animationFrame;
    let lastTime = 0;
    const frameInterval = 500;

    animationControl.onChange((value) => {
        if (value) {
            startAnimation();
        } else {
            stopAnimation();
        }
    });

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
        const currentTime = performance.now();
        if (currentTime - lastTime >= frameInterval) {
            const windFileKeys = Object.keys(windFiles);
            const currentIndex = windFileKeys.indexOf(meta['forecast time']);
            const nextIndex = (currentIndex + 1) % windFileKeys.length;
            const nextForecastTime = windFileKeys[nextIndex];
    
            meta['forecast time'] = nextForecastTime;
            timeControl.updateDisplay();
            updateWind(nextForecastTime);
            lastTime = currentTime;
        }
        animationFrame = requestAnimationFrame(animate);
    }

    function updateWind(forecastTime) {
        const windFileName = windFiles[forecastTime];
        const metadataPath = 'wind_updated/' + windFileName + '_metadata.json';
        const imagePath = 'wind_updated/' + windFileName + '.png';
    
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
            { stop: 0.1, color: '#66c2a5', knots: 10 },
            { stop: 0.2, color: '#abdda4', knots: 20 },
            { stop: 0.3, color: '#e6f598', knots: 30 },
            { stop: 0.4, color: '#fee08b', knots: 40 },
            { stop: 0.5, color: '#fdae61', knots: 50 },
            { stop: 0.6, color: '#f46d43', knots: 60 },
            { stop: 1.0, color: '#d53e4f', knots: 70 }
        ];
    
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
    updateWind('20241220_12');
});