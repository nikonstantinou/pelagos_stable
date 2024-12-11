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
        styles: 'confini',
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
        0: '2016112000',
        6: '2016112006',
        12: '2016112012',
        18: '2016112018',
        24: '2016112100',
        30: '2016112106',
        36: '2016112112',
        42: '2016112118',
        48: '2016112200'
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

    // Initial wind update
    updateWind(0);

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

    canvas.addEventListener('mousemove', (e) => {
        if (wind && wind.windData) {
            const windLatLon = wind.screenToLatLon(e.clientX, e.clientY);
            const windData = wind.getWindAtPoint(windLatLon);
            let speed = 0;
            let direction = 0;
            if (windData) {
                speed = wind.calculateWindSpeed(windData.u, windData.v);
                direction = wind.calculateWindDirection(windData.u, windData.v);
            }

            const point = map.containerPointToLatLng([e.clientX, e.clientY]);
            const nwBounds = map.getBounds().getNorthWest();
            const seBounds = map.getBounds().getSouthEast();
            const mapCenter = map.getCenter();
            
            const canvasBounds = wind.getBounds();
            const canvasCenter = {
                lat: (canvasBounds.north + canvasBounds.south) / 2,
                lon: (canvasBounds.east + canvasBounds.west) / 2
            };
            
            const rect = canvas.getBoundingClientRect();
            const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            infoDisplay.innerHTML = `
                <div style="border-bottom: 1px solid rgba(255,255,255,0.3); margin-bottom: 8px; padding-bottom: 8px;">
                    <strong>Map Bounds:</strong><br>
                    N: ${nwBounds.lat.toFixed(5)}° | S: ${seBounds.lat.toFixed(5)}°<br>
                    E: ${seBounds.lng.toFixed(5)}° | W: ${nwBounds.lng.toFixed(5)}°<br>
                    Center: ${mapCenter.lat.toFixed(3)}°, ${mapCenter.lng.toFixed(3)}°<br>
                    Zoom: ${map.getZoom().toFixed(1)}
                </div>
                <div style="border-bottom: 1px solid rgba(255,255,255,0.3); margin-bottom: 8px; padding-bottom: 8px;">
                    <strong>Wind View Bounds:</strong><br>
                    N: ${canvasBounds.north.toFixed(5)}° | S: ${canvasBounds.south.toFixed(5)}°<br>
                    E: ${canvasBounds.east.toFixed(5)}° | W: ${canvasBounds.west.toFixed(5)}°<br>
                    Center: ${canvasCenter.lat.toFixed(3)}°, ${canvasCenter.lon.toFixed(3)}°
                </div>
                <div>
                    <strong>Wind Data:</strong><br>
                    Speed: ${(speed * 1.94384).toFixed(1)} kt<br>
                    Direction: ${direction.toFixed(0)}°
                </div>
            `;
        }

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

    // Prevent context menu
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // GUI setup
    const gui = new dat.GUI({ width: 300 });
    const meta = {
        '2016-11-20+h': 0,
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
    const timeControl = gui.add(meta, '2016-11-20+h', 0, 48, 6);
    timeControl.onFinishChange(updateWind);

    if (pxRatio !== 1) {
        const retinaControl = gui.add(meta, 'retina resolution');
        retinaControl.onFinishChange(updateRetina);
    }

    // Add zoom controller
    const zoomController = gui.add(meta, 'map zoom', 1, 8).step(0.1);
    zoomController.onChange((value) => {
        map.setZoom(value);
    });

    // WMS controls folder
    const wmsFolder = gui.addFolder('WMS Layer Controls');
    const wmsOpacityController = wmsFolder.add(meta, 'wms opacity', 0, 1).step(0.00001);
    wmsOpacityController.onChange((value) => {
        cbLayer.setOpacity(value);
    });

    // Wind opacity control
    const opacityController = gui.add(meta, 'opacity', 0, 1).step(0.00001);
    opacityController.onChange((value) => {
        wind.setOpacity(value);
        wind.draw();
    });

    // Reset view button
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
            let hour = meta['2016-11-20+h'];
            hour = (hour + 6) % 54;
            meta['2016-11-20+h'] = hour;
            timeControl.updateDisplay();
            updateWind(hour);
            lastTime = currentTime;
        }
        animationFrame = requestAnimationFrame(animate);
    }

    function updateWind(name) {
        document.getElementById('loading').style.display = 'block';
        
        fetch('wind/' + windFiles[name] + '.json')
            .then(response => response.json())
            .then(windData => {
                const windImage = new Image();
                windImage.crossOrigin = 'anonymous';
                windData.image = windImage;
                windImage.src = 'wind/' + windFiles[name] + '.png';
                
                windImage.onload = function() {
                    windData.image = windImage;
                    wind.setWind(windData);
                    wind.setOpacity(meta['opacity']);
                    wind.syncWithLeafletBounds(map);
                    document.getElementById('loading').style.display = 'none';
                };
            })
            .catch(error => {
                console.error('Error:', error);
                document.getElementById('loading').innerHTML = `Error: ${error.message}`;
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

    // Handle window resizing
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
        function msToKnots(ms) {
            return (ms * 1.94384).toFixed(1);
        }
    
        const gradientEl = document.querySelector('.wind-scale-gradient');
        
        const colorStops = [
            { stop: 0.0, color: '#3288bd' },
            { stop: 0.1, color: '#66c2a5' },
            { stop: 0.2, color: '#abdda4' },
            { stop: 0.3, color: '#e6f598' },
            { stop: 0.4, color: '#fee08b' },
            { stop: 0.5, color: '#fdae61' },
            { stop: 0.6, color: '#f46d43' },
            { stop: 1.0, color: '#d53e4f' }
        ];
    
        const gradientString = `linear-gradient(to top, ${
            colorStops.map(({stop, color}) => `${color} ${stop * 100}%`).join(', ')
        })`;
    
        gradientEl.style.background = gradientString;
    
        function updateWindScaleLabels() {
            const maxSpeed = wind.getMaxWindSpeed();
            const labelsEl = document.querySelector('.wind-scale-labels');
            
            labelsEl.innerHTML = colorStops
                .slice()
                .reverse()
                .map(({stop}) => {
                    const speed = msToKnots(maxSpeed * stop);
                    return `<div class="scale-label">${speed} kt</div>`;
                })
                .join('');
        }
    
        const originalSetWind = wind.setWind.bind(wind);
        wind.setWind = function(windData) {
            originalSetWind(windData);
            updateWindScaleLabels();
        };
    }

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
    
        const referencePoints = [
            { lat: 80, lon: 45}
        ];
    
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

    function testWindAtPoint(lat, lon) {
        if (wind && wind.windData) {
            console.log('Testing wind at:', { lat, lon });
            const windData = wind.getWindAtPoint({ lat, lon });
            if (windData) {
                const speed = wind.calculateWindSpeed(windData.u, windData.v);
                const direction = wind.calculateWindDirection(windData.u, windData.v);
                console.log('Test Results:', {
                    components: { u: windData.u, v: windData.v },
                    speed: speed,
                    direction: direction,
                    pixel: windData.pixel
                });
            }
        }
    }

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