console.log("Script is running");

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the map
    const map = L.map('map-container', {
        center: [0, 0],
        noWrap: true,   
        zoom: 2.1,  
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

    const infoDisplay = document.createElement('div');
    infoDisplay.id = 'info-display';
    infoDisplay.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
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
    let viewBounds = {
        left: -1,
        right: 1,
        top: -1,
        bottom: 1
    };
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
    wind.setZoom(zoom, offsetX, offsetY);
    wind.setOpacity(1.0);
    wind.draw();

    // Define the wind files mapping
    const windFiles = {
        '20241215_00': '20241215_00_wind_0p25_20241215_00_run_f_000',
        '20241215_03': '20241215_03_wind_0p25_20241215_00_run_f_003',
        '20241215_06': '20241215_06_wind_0p25_20241215_00_run_f_006',
        '20241215_09': '20241215_09_wind_0p25_20241215_00_run_f_009',
        '20241215_12': '20241215_12_wind_0p25_20241215_00_run_f_012',
        '20241215_15': '20241215_15_wind_0p25_20241215_00_run_f_015',
        '20241215_18': '20241215_18_wind_0p25_20241215_00_run_f_018',
        '20241215_21': '20241215_21_wind_0p25_20241215_00_run_f_021',
        '20241216_00': '20241216_00_wind_0p25_20241215_00_run_f_024',
        '20241216_03': '20241216_03_wind_0p25_20241215_00_run_f_027',
        '20241216_06': '20241216_06_wind_0p25_20241215_00_run_f_030',
        '20241216_09': '20241216_09_wind_0p25_20241215_00_run_f_033',
        '20241216_12': '20241216_12_wind_0p25_20241215_00_run_f_036',
        '20241216_15': '20241216_15_wind_0p25_20241215_00_run_f_039',
        '20241216_18': '20241216_18_wind_0p25_20241215_00_run_f_042',
        '20241216_21': '20241216_21_wind_0p25_20241215_00_run_f_045',
        '20241217_00': '20241217_00_wind_0p25_20241215_00_run_f_048',
        '20241217_03': '20241217_03_wind_0p25_20241215_00_run_f_051',
        '20241217_06': '20241217_06_wind_0p25_20241215_00_run_f_054',
        '20241217_09': '20241217_09_wind_0p25_20241215_00_run_f_057',
        '20241217_12': '20241217_12_wind_0p25_20241215_00_run_f_060',
        '20241217_15': '20241217_15_wind_0p25_20241215_00_run_f_063',
        '20241217_18': '20241217_18_wind_0p25_20241215_00_run_f_066',
        '20241217_21': '20241217_21_wind_0p25_20241215_00_run_f_069',
        '20241218_00': '20241218_00_wind_0p25_20241215_00_run_f_072',
        '20241218_03': '20241218_03_wind_0p25_20241215_00_run_f_075',
        '20241218_06': '20241218_06_wind_0p25_20241215_00_run_f_078',
        '20241218_09': '20241218_09_wind_0p25_20241215_00_run_f_081',
        '20241218_12': '20241218_12_wind_0p25_20241215_00_run_f_084',
        '20241218_15': '20241218_15_wind_0p25_20241215_00_run_f_087',
        '20241218_18': '20241218_18_wind_0p25_20241215_00_run_f_090',
        '20241218_21': '20241218_21_wind_0p25_20241215_00_run_f_093',
        '20241219_00': '20241219_00_wind_0p25_20241215_00_run_f_096',
        '20241219_03': '20241219_03_wind_0p25_20241215_00_run_f_099',
        '20241219_06': '20241219_06_wind_0p25_20241215_00_run_f_102',
        '20241219_09': '20241219_09_wind_0p25_20241215_00_run_f_105',
        '20241219_12': '20241219_12_wind_0p25_20241215_00_run_f_108',
        '20241219_15': '20241219_15_wind_0p25_20241215_00_run_f_111',
        '20241219_18': '20241219_18_wind_0p25_20241215_00_run_f_114',
        '20241219_21': '20241219_21_wind_0p25_20241215_00_run_f_117',
        '20241220_00': '20241220_00_wind_0p25_20241215_00_run_f_120',
        '20241220_03': '20241220_03_wind_0p25_20241215_00_run_f_123',
        '20241220_06': '20241220_06_wind_0p25_20241215_00_run_f_126',
        '20241220_09': '20241220_09_wind_0p25_20241215_00_run_f_129',
        '20241220_12': '20241220_12_wind_0p25_20241215_00_run_f_132',
        '20241220_15': '20241220_15_wind_0p25_20241215_00_run_f_135',
        '20241220_18': '20241220_18_wind_0p25_20241215_00_run_f_138',
        '20241220_21': '20241220_21_wind_0p25_20241215_00_run_f_141',
        '20241221_00': '20241221_00_wind_0p25_20241215_00_run_f_144',
        '20241221_03': '20241221_03_wind_0p25_20241215_00_run_f_147',
        '20241221_06': '20241221_06_wind_0p25_20241215_00_run_f_150',
        '20241221_09': '20241221_09_wind_0p25_20241215_00_run_f_153',
        '20241221_12': '20241221_12_wind_0p25_20241215_00_run_f_156',
        '20241221_15': '20241221_15_wind_0p25_20241215_00_run_f_159',
        '20241221_18': '20241221_18_wind_0p25_20241215_00_run_f_162',
        '20241221_21': '20241221_21_wind_0p25_20241215_00_run_f_165',
        '20241222_00': '20241222_00_wind_0p25_20241215_00_run_f_168',
        '20241222_03': '20241222_03_wind_0p25_20241215_00_run_f_171',
        '20241222_06': '20241222_06_wind_0p25_20241215_00_run_f_174',
        '20241222_09': '20241222_09_wind_0p25_20241215_00_run_f_177',
        '20241222_12': '20241222_12_wind_0p25_20241215_00_run_f_180',
        '20241222_15': '20241222_15_wind_0p25_20241215_00_run_f_183',
        '20241222_18': '20241222_18_wind_0p25_20241215_00_run_f_186',
        '20241222_21': '20241222_21_wind_0p25_20241215_00_run_f_189',
        '20241223_00': '20241223_00_wind_0p25_20241215_00_run_f_192',
        '20241223_03': '20241223_03_wind_0p25_20241215_00_run_f_195',
        '20241223_06': '20241223_06_wind_0p25_20241215_00_run_f_198',
        '20241223_09': '20241223_09_wind_0p25_20241215_00_run_f_201',
        '20241223_12': '20241223_12_wind_0p25_20241215_00_run_f_204',
        '20241223_15': '20241223_15_wind_0p25_20241215_00_run_f_207',
        '20241223_18': '20241223_18_wind_0p25_20241215_00_run_f_210',
        '20241223_21': '20241223_21_wind_0p25_20241215_00_run_f_213',
        '20241224_00': '20241224_00_wind_0p25_20241215_00_run_f_216',
        '20241224_03': '20241224_03_wind_0p25_20241215_00_run_f_219',
        '20241224_06': '20241224_06_wind_0p25_20241215_00_run_f_222',
        '20241224_09': '20241224_09_wind_0p25_20241215_00_run_f_225',
        '20241224_12': '20241224_12_wind_0p25_20241215_00_run_f_228',
        '20241224_15': '20241224_15_wind_0p25_20241215_00_run_f_231',
        '20241224_18': '20241224_18_wind_0p25_20241215_00_run_f_234',
        '20241224_21': '20241224_21_wind_0p25_20241215_00_run_f_237',
'20241225_00': '20241225_00_wind_0p25_20241215_00_run_f_240'
    };

    function calculateViewBounds(zoom, offsetX, offsetY) {
        const baseRange = 2;
        const scaledRange = baseRange / zoom;
        
        const left = -scaledRange/2 - offsetX/zoom;
        const right = scaledRange/2 - offsetX/zoom;
        const top = -scaledRange/2 - offsetY/zoom;
        const bottom = scaledRange/2 - offsetY/zoom;
        
        return {
            left: left.toFixed(3),
            right: right.toFixed(3),
            top: top.toFixed(3),
            bottom: bottom.toFixed(3)
        };
    }

    function updateWindDisplay(clientX, clientY) {
        if (wind && wind.windData) {
            const leafletPoint = map.containerPointToLatLng([clientX, clientY]);
            
            const windData = wind.getWindAtPoint({
                lat: leafletPoint.lat,
                lon: leafletPoint.lng
            });
            
            if (windData) {
                const speed = wind.calculateWindSpeed(windData.u, windData.v);
                const direction = wind.calculateWindDirection(windData.u, windData.v);
                
                infoDisplay.innerHTML = `
                    <div style="border-bottom: 1px solid rgba(255,255,255,0.3); margin-bottom: 8px; padding-bottom: 8px;">
                        <strong>Leaflet Coordinates:</strong><br>
                        Lat: ${leafletPoint.lat.toFixed(5)}° | Lon: ${leafletPoint.lng.toFixed(5)}°
                    </div>
                    <div>
                        <strong>Wind Data:</strong><br>
                        Speed: ${(speed * 1.94384).toFixed(1)} kt<br>
                        Direction: ${direction.toFixed(0)}°<br>
                        Forecast time: ${meta['forecast time']}
                    </div>
                `;
            }
        }
    }

    // Initial wind update
    updateWind('20241215_00');

    // Add map event listeners
    map.on('moveend', function() {
        meta['map zoom'] = map.getZoom();
        zoomController.updateDisplay();
        wind.syncWithLeafletBounds(map);
    });

    map.on('zoomend', function() {
        meta['map zoom'] = map.getZoom();
        zoomController.updateDisplay();
        wind.syncWithLeafletBounds(map);
    });

    // Mouse event handlers
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        }
    });

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
    }, { passive: false });

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
            const newLat = center.lat - (dy / map.getContainer().clientHeight) * 180;
            const newLng = center.lng + (dx / map.getContainer().clientWidth) * 360;
            
            map.setView([newLat, newLng], map.getZoom(), {animate: false});
            
            lastX = e.clientX;
            lastY = e.clientY;
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const delta = e.deltaY;
        const currentZoom = map.getZoom();
        let newZoom = currentZoom - (delta * 0.001);
        newZoom = Math.max(1, Math.min(8, newZoom));
        
        map.setZoom(newZoom);
        meta['map zoom'] = newZoom;
        zoomController.updateDisplay();
    });

    // GUI setup
    const gui = new dat.GUI({ width: 300 });
    const meta = {
        'forecast time': '20241215_00',
        'retina resolution': false,
        'map zoom': 2.1,
        'opacity': 1.0,
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

    const wmsFolder = gui.addFolder('WMS Layer Controls');
    const wmsOpacityController = wmsFolder.add(meta, 'wms opacity', 0, 1).step(0.00001);
    wmsOpacityController.onChange((value) => {
        cbLayer.setOpacity(value);
    });

    const opacityController = gui.add(meta, 'opacity', 0, 1).step(0.00001);
    opacityController.onChange((value) => {
        wind.setOpacity(value);
        wind.draw();
    });

    gui.add(meta, 'reset view');

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
        const ratio = meta['retina resolution'] ? pxRatio : 1;
        canvas.width = canvas.clientWidth * ratio;
        canvas.height = canvas.clientHeight * ratio;
        gl.viewport(0, 0, canvas.width, canvas.height);
        wind.draw();
    }

    function updateCanvasSize() {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        canvas.width = windowWidth * pxRatio;
        canvas.height = windowHeight * pxRatio;
        
        canvas.style.width = windowWidth + 'px';
        canvas.style.height = windowHeight + 'px';
        
        if (gl) {
            gl.viewport(0, 0, canvas.width, canvas.height);
        }
    }

    window.addEventListener('resize', () => {
        updateCanvasSize();
        if (wind && wind.windData) {
            wind.syncWithLeafletBounds(map);
        }
    });

    // Initial setup
    updateCanvasSize();
    wind.syncWithLeafletBounds(map);

    function createWindScale() {
        console.log('Creating wind scale...');
    
        // Check document and container
        console.log('Document:', document);
        const container = document.getElementById('container');
        console.log('Container:', container);
    
        // Find wind scale elements
        const windScaleDiv = document.querySelector('.wind-scale');
        const gradientEl = windScaleDiv ? windScaleDiv.querySelector('.wind-scale-gradient') : null;
        const labelsEl = windScaleDiv ? windScaleDiv.querySelector('.wind-scale-labels') : null;
    
        // Detailed logging
        console.log('Wind Scale Div:', windScaleDiv);
        console.log('Gradient Element:', gradientEl);
        console.log('Labels Element:', labelsEl);
    
        // Check if elements exist
        if (!windScaleDiv) {
            console.error('Wind scale div not found in the DOM!');
            return;
        }
        if (!gradientEl) {
            console.error('Gradient element not found!');
            return;
        }
        if (!labelsEl) {
            console.error('Labels element not found!');
            return;
        }
    
        // Rest of your existing function
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
    
        // Explicitly set labels
        labelsEl.innerHTML = colorStops
            .slice()
            .reverse()
            .map(({knots}) => {
                console.log(`Creating label for ${knots} kt`);
                return `<div class="scale-label">${knots} kt</div>`;
            })
            .join('');
    
        // Verify labels were added
        console.log('Labels innerHTML:', labelsEl.innerHTML);
    }
    
    // Force call with a slight delay
    setTimeout(createWindScale, 1000);
    createWindScale();

    function addCanvasReferencePoints() {
        const overlayCanvas = document.createElement('canvas');
        overlayCanvas.id = 'canvas-points-overlay';
        overlayCanvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: none;
            z-index: 999;
        `;
        document.getElementById('container').appendChild(overlayCanvas);
    
        const referencePoints = [];
    
        function updatePoints() {
            overlayCanvas.width = canvas.width;
            overlayCanvas.height = canvas.height;
            overlayCanvas.style.width = canvas.style.width;
            overlayCanvas.style.height = canvas.style.height;
    
            const ctx = overlayCanvas.getContext('2d');
            ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
            referencePoints.forEach(point => {
                const x = ((point.lon + 180) / 360) * overlayCanvas.width;
                const y = ((90 - point.lat) / 180) * overlayCanvas.height;
    
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, 2 * Math.PI);
                ctx.fillStyle = 'yellow';
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 12;
                ctx.fill();
                ctx.stroke();
    
                ctx.fillStyle = 'white';
                ctx.strokeStyle = 'black';
                ctx.font = '30px monospace';
                ctx.lineWidth = 2;
                const label = `${point.lat},${point.lon}`;
                ctx.strokeText(label, x + 6, y);
                ctx.fillText(label, x + 6, y);
            });
        }
    
        const originalDrawFunction = wind.draw;
        wind.draw = function() {
            originalDrawFunction.call(wind);
            updatePoints();
        };
    
        window.addEventListener('resize', updatePoints);
        updatePoints();
    }
    
    addCanvasReferencePoints();

    window.testWindAtPoint = testWindAtPoint;

    function analyzeWindPNG(imageData, windData) {
        const pixels = imageData.data;
        let minR = 255, maxR = 0, minG = 255, maxG = 0;
        
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            
            minR = Math.min(minR, r);
            maxR = Math.max(maxR, r);
            minG = Math.min(minG, g);
            maxG = Math.max(maxG, g);
        }
        
        const uFromRGB = {
            min: windData.uMin + (minR / 255) * (windData.uMax - windData.uMin),
            max: windData.uMin + (maxR / 255) * (windData.uMax - windData.uMin)
        };
        
        const vFromRGB = {
            min: windData.vMin + (minG / 255) * (windData.vMax - windData.vMin),
            max: windData.vMin + (maxG / 255) * (windData.vMax - windData.vMin)
        };
        
        return {
            raw: {
                r: { min: minR, max: maxR },
                g: { min: minG, max: maxG }
            },
            calculated: {
                u: uFromRGB,
                v: vFromRGB
            }
        };
    }
});