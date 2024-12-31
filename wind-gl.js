// WebGL utility functions
function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
    }

    const wrapper = {program: program};

    const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < numAttributes; i++) {
        const attribute = gl.getActiveAttrib(program, i);
        wrapper[attribute.name] = gl.getAttribLocation(program, attribute.name);
    }

    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
        const uniform = gl.getActiveUniform(program, i);
        wrapper[uniform.name] = gl.getUniformLocation(program, uniform.name);
    }

    return wrapper;
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }

    return shader;
}

function createTexture(gl, filter, data, width, height) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);

    if (data instanceof Uint8Array) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
    }

    return texture;
}

function bindTexture(gl, texture, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
}

class WindGL {
    constructor(gl) {
        this.gl = gl;
        
        // Use single world resolution
        this.gridResX = 1440*2;
        this.gridResY = 720*2;
        this.pointCount = this.gridResX * this.gridResY;
        
        // Longitude and latitude ranges
        this.lonRange = [-180, 180]; 
        this.latRange = [-85.051129, 85.051129];
        
        this.createShaders();
        this.createPoints();

      /*  
        this.colorRamps = {
            0.0: '#3288bd',
            0.5: '#66c2a5',
            0.1: '#abdda4', 
            0.15: '#e6f598',
            0.2: '#fee08b',
            0.3: '#fdae61',  
            0.4: '#f46d43',
            0.45: '#d53e4f',  // Moved red color to 0.7
            1.0: '#7d44a5'   // Moved purple color to 1.0
        };
        this.setColorRamp(this.colorRamps);
    }
        
          */



     
    this.colorRamps = {
        0.0: 'rgb(118,133,223)',    // 0 m/s - Brighter blue
        0.02: 'rgb(67,117,199)',    // 1 m/s - More saturated blue
        0.06: 'rgb(84,178,209)',    // 3 m/s - Brighter cyan
        0.1: 'rgb(87,171,143)',     // 5 m/s - More vibrant teal
        0.16: 'rgb(93,205,93)',     // 7 m/s - Brighter green
        0.20: 'rgb(63,199,63)',     // 9 m/s - More saturated green
        0.24: 'rgb(207,197,81)',    // 11 m/s - Brighter yellow
        0.30: 'rgb(199,147,58)',    // 13 m/s - More saturated orange
        0.32: 'rgb(201,118,92)',     // 15 m/s - Brighter orange-red
        0.38: 'rgb(169,58,78)',     // 17 m/s - More saturated red
        0.40: 'rgb(215,80,156)',    // 19 m/s - Brighter magenta
        0.44: 'rgb(147,74,187)',    // 21 m/s - More saturated purple
        0.52: 'rgb(129,107,223)',   // 24 m/s - Brighter purple-blue
        0.56: 'rgb(78,125,181)',    // 27 m/s - More saturated blue
        0.64: 'rgb(102,174,192)',   // 29 m/s - Brighter cyan
        0.70: 'rgb(155,78,225)',    // 36 m/s - More vibrant purple
        0.92: 'rgb(255,235,235)',   // 46 m/s - Almost white
        1.0: 'rgb(168,168,168)'     // 104 m/s - Brighter gray
    };
    this.setColorRamp(this.colorRamps);
    }
 
   /*
    this.colorRamps = {
        0.0: 'rgb(64,89,191)',     // Deep blue
        0.05: 'rgb(71,142,196)',   // Light blue
        0.1: 'rgb(76,195,188)',    // Cyan
        0.15: 'rgb(86,205,99)',    // Light green
        0.2: 'rgb(148,223,87)',    // Lime green
        0.3: 'rgb(205,225,97)',    // Yellow-green
        0.4: 'rgb(248,207,87)',    // Yellow
        0.5: 'rgb(252,174,75)',    // Orange
        0.6: 'rgb(245,132,66)',    // Light red
        0.7: 'rgb(235,89,95)',     // Red
        0.8: 'rgb(222,67,130)',    // Pink-red
        0.9: 'rgb(178,67,175)',    // Purple
        1.0: 'rgb(156,67,205)'     // Deep purple
    };
        this.setColorRamp(this.colorRamps);
    }
    */

    createShaders() {
        const vertexSource = `
        precision highp float;
        
        attribute vec2 a_pos;
        uniform vec2 u_wind_min;
        uniform vec2 u_wind_max;
        uniform sampler2D u_wind;
        uniform sampler2D u_color_ramp;
        uniform float u_zoom;
        uniform vec2 u_offset;
        uniform float u_opacity;
        
        varying vec4 v_color;
        
        const float PI = 3.14159265359;
        
        float projectLat(float lat) {
            float sina = sin(lat * PI / 180.0);
            float y = log((1.0 + sina) / (1.0 - sina));
            return y/PI ;
        }
        
        void main() {
            // Use position directly for texture coordinates
            vec2 texCoords = vec2(a_pos.x, a_pos.y);
            
            // Get wind data from texture
            vec2 velocity = mix(u_wind_min, u_wind_max, texture2D(u_wind, texCoords).rg);
            float speed = length(velocity) / length(u_wind_max);
            
            // Color based on wind speed 
            vec2 ramp_pos = vec2(
                fract(16.0 * speed),
                floor(16.0 * speed) / 16.0  
            );
            vec4 color = texture2D(u_color_ramp, ramp_pos);
            v_color = vec4(color.rgb, color.a * u_opacity);
            
            // Convert from texture coordinates to longitude/latitude
            float lon = mix(-180.0, 180.0, a_pos.x);
            float lat = mix(90.0, -90.0, a_pos.y);
            
            // Apply Mercator projection
            float x = lon / 180.0 + 0.5;
            float y = projectLat(lat) + 0.5;
            
            // Transform to clip space with zoom and offset
            vec2 position = vec2(
                ((x + u_offset.x) - 0.5) * u_zoom,
                ((y + u_offset.y) - 0.5) * u_zoom
            );
            
            gl_Position = vec4(position, 0, 1);
            
              // Enhanced point size scaling based on latitude and zoom
            float latScale = 2.0*cos(lat * PI / 180.0);
            float baseSize = 2.0;  // Reduced base size for finer points
            float zoomFactor = 1.5; // Adjusted zoom multiplier
            gl_PointSize = max(baseSize, baseSize * u_zoom * latScale * zoomFactor);
        }`;

        const fragmentSource = `
            precision highp float;
            varying vec4 v_color;
            
            void main() {
                gl_FragColor = v_color;
            }
        `;
        
        this.program = createProgram(this.gl, vertexSource, fragmentSource);
    }
    // Add this to your WindGL class in wind-gl.js

    getWindAtLatLon(lat, lon) {
        if (!this.windData || !this.windData.image) return null;
    
        // Convert lat/lon to texture coordinates
        const x = (lon + 180) / 360;
        const y = (90 - lat) / 180;
    
        // Get pixel coordinates in the wind texture
        const width = this.windData.image.width;
        const height = this.windData.image.height;
        const px = Math.floor(x * width);
        const py = Math.floor(y * height);
    
        if (px < 0 || px >= width || py < 0 || py >= height) return null;
    
        // Create temporary canvas if not exists
        if (!this._tempCanvas) {
            this._tempCanvas = document.createElement('canvas');
            this._tempCtx = this._tempCanvas.getContext('2d', { willReadFrequently: true });
            this._tempCanvas.width = width;
            this._tempCanvas.height = height;
            // Draw the image once
            this._tempCtx.drawImage(this.windData.image, 0, 0);
            // Store the image data
            this._imageData = this._tempCtx.getImageData(0, 0, width, height).data;
        }
    
        // Get wind data from stored image data
        const i = (py * width + px) * 4;
        const u = this.windData.uMin + (this._imageData[i] / 255) * (this.windData.uMax - this.windData.uMin);
        const v = this.windData.vMin + (this._imageData[i + 1] / 255) * (this.windData.vMax - this.windData.vMin);
    
        return { u, v };
    }
    
    // Method to get wind data at any point
    getWindAtPoint(point) {
        if (!this.windData || !this.map) return null;
        return this.getWindAtLatLon(point.lat, point.lng);
    }

    // Method to get bounds
    getBounds() {
        if (!this.map) return null;
        return this.map.getBounds();
    }

    // Method to convert screen coordinates to lat/lon
    screenToLatLon(x, y) {
        if (!this.map) return null;
        const point = this.map.containerPointToLatLng([x, y]);
        return {
            lat: point.lat,
            lng: point.lng
        };
    }
    createPoints() {
        const points = new Float32Array(this.pointCount * 2);
        
        for (let i = 0; i < this.gridResY; i++) {
            for (let j = 0; j < this.gridResX; j++) {
                const idx = (i * this.gridResX + j) * 2;
                
                // Normalize coordinates to 0-1 range
                points[idx] = j / (this.gridResX - 1);
                points[idx + 1] = (this.gridResY - 1 - i) / (this.gridResY - 1);  // Invert Y coordinate
            }
        }
        
        this.posBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.posBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, points, this.gl.STATIC_DRAW);
    }

    syncWithLeafletBounds(map) {
        // Get Leaflet's bounds
        const bounds = map.getBounds();
        const center = map.getCenter();
        
        // Store the map bounds
        this.mapBounds = {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
            center: {
                lat: center.lat,
                lon: center.lng
            }
        };
    
        // Calculate zoom and offsets
        const width = this.mapBounds.east - this.mapBounds.west;
        const height = this.mapBounds.north - this.mapBounds.south;
        
        // Adjust zoom calculation to account for container aspect ratio
        const containerAspectRatio = this.gl.canvas.width / this.gl.canvas.height;
        const boundsAspectRatio = Math.abs(width / height);
        
        let zoom;
        if (containerAspectRatio > boundsAspectRatio) {
            zoom = 180 / height;
        } else {
            zoom = 360 / Math.abs(width);
        }
        
        // Update wind visualization parameters
        this.zoom = zoom;
        this.offsetX = -this.mapBounds.center.lon / 180;
        this.offsetY = -2*Math.log(Math.tan((90+this.mapBounds.center.lat) * Math.PI / 360)) / Math.PI;
        
        // Force redraw
        this.draw();
    }

    updateSize() {
        const canvas = this.gl.canvas;
        const gl = this.gl;
        
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        
        const ratio = window.devicePixelRatio || 1;
        
        const width = Math.floor(displayWidth * ratio);
        const height = Math.floor(displayHeight * ratio);
        
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            gl.viewport(0, 0, width, height);
        }
        
        this.pointSize = Math.max(1, Math.ceil(width / this.gridResX));
        this.draw();
    }

    getBounds() {
        if (!this.mapBounds) return null;
        
        return {
            _northEast: { lat: this.mapBounds.north, lng: this.mapBounds.east },
            _southWest: { lat: this.mapBounds.south, lng: this.mapBounds.west },
            _center: { lat: this.mapBounds.center.lat, lng: this.mapBounds.center.lon }
        };
    }

    areBoundsSynchronized() {
        if (!this.map || !this.mapBounds) return false;
        
        const leafletBounds = this.map.getBounds();
        const tolerance = 0.00001;
        
        return Math.abs(this.mapBounds.north - leafletBounds.getNorth()) < tolerance &&
               Math.abs(this.mapBounds.south - leafletBounds.getSouth()) < tolerance &&
               Math.abs(this.mapBounds.east - leafletBounds.getEast()) < tolerance &&
               Math.abs(this.mapBounds.west - leafletBounds.getWest()) < tolerance;
    }

    setMap(map) {
        this.map = map;
        if (map) {
            this.syncWithLeafletBounds(map);
        }
    }

    setZoom(zoom, offsetX, offsetY) {
        this.zoom = zoom;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        
        const lonHalfSpan = 180 / zoom;
        const latHalfSpan = 90 / zoom;
        
        this.mapBounds = {
            north: Math.min(90, 90 - (this.offsetY * 90 - latHalfSpan)),
            south: Math.max(-90, -90 - (this.offsetY * 90 + latHalfSpan)),
            east: Math.min(180, 180 - (this.offsetX * 180 - lonHalfSpan)),
            west: Math.max(-180, -180 - (this.offsetX * 180 + lonHalfSpan))
        };
    }

    setColorRamp(colors) {
        this.colorRamps = colors;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 256;
        canvas.height = 1;
        
        const gradient = ctx.createLinearGradient(0, 0, 256, 0);
        for (const stop in colors) {
            gradient.addColorStop(+stop, colors[stop]);
        }
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 1);
        
        this.colorRampTexture = createTexture(
            this.gl,
            this.gl.LINEAR,
            new Uint8Array(ctx.getImageData(0, 0, 256, 1).data),
            16,
            16
        );
    }

    setWind(windData) {
        this.windData = windData;
        this.windTexture = createTexture(this.gl, this.gl.LINEAR, windData.image);
    }

    setOpacity(opacity) {
        this.opacity = opacity;
    }

    getWindAtPoint(latLon) {
        if (!this.windData || !this.windData.image) return null;
    
        const texCoords = {
            x: (latLon.lon + 180) / 360,
            y: 1 - ((latLon.lat + 90) / 180)
        };
    
        const width = this.windData.image.width;
        const height = this.windData.image.height;
        const x = Math.floor(texCoords.x * width);
        const y = Math.floor(texCoords.y * height);
    
        if (x < 0 || x >= width || y < 0 || y >= height) return null;
    
        if (!this._tempCanvas) {
            this._tempCanvas = document.createElement('canvas');
            this._tempCtx = this._tempCanvas.getContext('2d', { willReadFrequently: true });
            this._tempCanvas.width = width;
            this._tempCanvas.height = height;
        }
    
        this._tempCtx.drawImage(this.windData.image, 0, 0);
        const pixel = this._tempCtx.getImageData(x, y, 1, 1).data;
    
        const u = this.windData.uMin + (this.windData.uMax - this.windData.uMin) * (pixel[0] / 255);
        const v = this.windData.vMin + (this.windData.vMax - this.windData.vMin) * (pixel[1] / 255);
    
        return {
            u,
            v,
            pixel: [pixel[0], pixel[1], pixel[2]]
        };
    }

    screenToLatLon(screenX, screenY) {
        const rect = this.gl.canvas.getBoundingClientRect();
        
        // Convert screen position to container point
        const containerPoint = L.point(
            screenX - rect.left,
            screenY - rect.top
        );
        
        // Get the map instance
        if (!this.map) {
            console.error('Map instance not available');
            return null;
        }
        
        // Use Leaflet's containerPointToLatLng to get coordinates
        const latLng = this.map.containerPointToLatLng(containerPoint);
        
        return {
            lat: latLng.lat,
            lon: latLng.lng
        };
    }

    calculateWindSpeed(u, v) {
        return Math.sqrt(u * u + v * v);
    }

    calculateWindDirection(u, v) {
        let direction = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
        return direction;
    }

    validateLatLon(lat, lon) {
        console.log('Validating coordinates:', { lat, lon });
        const isValidLat = lat >= -90 && lat <= 90;
        const isValidLon = lon >= -180 && lon <= 180;
        if (!isValidLat || !isValidLon) {
            console.warn('Invalid coordinates:', {
                lat: { value: lat, valid: isValidLat },
                lon: { value: lon, valid: isValidLon }
            });
        }
        return isValidLat && isValidLon;
    }

    testCoordinate(screenX, screenY) {
        const result = this.screenToLatLon(screenX, screenY);
        console.log('Test coordinate conversion:', {
            screen: { x: screenX, y: screenY },
            result: result,
            valid: this.validateLatLon(result.lat, result.lon)
        });
        return result;
    }

    draw() {
        const gl = this.gl;
        
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);
        
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // Only proceed with drawing if we have wind data
        if (this.windData) {
            gl.useProgram(this.program.program);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
            gl.enableVertexAttribArray(this.program.a_pos);
            gl.vertexAttribPointer(this.program.a_pos, 2, gl.FLOAT, false, 0, 0);
            
            bindTexture(gl, this.windTexture, 0);
            bindTexture(gl, this.colorRampTexture, 1);
            
            gl.uniform1i(this.program.u_wind, 0);
            gl.uniform1i(this.program.u_color_ramp, 1);
            gl.uniform2f(this.program.u_wind_min, this.windData.uMin, this.windData.vMin);
            gl.uniform2f(this.program.u_wind_max, this.windData.uMax, this.windData.vMax);
            gl.uniform1f(this.program.u_zoom, this.zoom);
            gl.uniform2f(this.program.u_offset, this.offsetX, this.offsetY);
            gl.uniform1f(this.program.u_opacity, this.opacity);
            
            gl.drawArrays(gl.POINTS, 0, this.pointCount);
        }
    }

    resize() {
        const gl = this.gl;
        const canvas = gl.canvas;
        const ratio = window.devicePixelRatio || 1;
        
        const displayWidth = Math.floor(canvas.clientWidth * ratio);
        const displayHeight = Math.floor(canvas.clientHeight * ratio);
    
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
            gl.viewport(0, 0, canvas.width, canvas.height);
            
            // Update internal state if needed
            if (this.map) {
                this.syncWithLeafletBounds(this.map);
            }
        }
    }

    // Method to update bounds after pan/drag
    updateBoundsFromLeaflet() {
        if (this.map) {
            this.syncWithLeafletBounds(this.map);
        }
    }

    getColorRamp() {
        return this.colorRamps;
    }

    getMaxWindSpeed() {
        if (!this.windData) return 0;
        const maxU = Math.max(Math.abs(this.windData.uMin), Math.abs(this.windData.uMax));
        const maxV = Math.max(Math.abs(this.windData.vMin), Math.abs(this.windData.vMax));
        return Math.sqrt(maxU * maxU + maxV * maxV);
    }
}

window.WindGL = WindGL;