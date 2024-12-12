
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
        
        this.gridResX = 1296*3;
        this.gridResY = 654*3;
        this.pointCount = this.gridResX * this.gridResY;
        
        this.lonRange = [-180, 180]; 
        this.latRange = [-90, 90];
        
        this.createShaders();
        this.createPoints();
        
        this.colorRamps = {
            0.0: '#3288bd',
            0.1: '#66c2a5',
            0.2: '#abdda4', 
            0.3: '#e6f598',
            0.4: '#fee08b',
            0.5: '#fdae61',
            0.6: '#f46d43',
            1.0: '#d53e4f'  
        };
        this.setColorRamp(this.colorRamps);
    }

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
            
            void main() {
                // Convert position to lat/lon
                float lon = (a_pos.x * 360.0) - 180.0;
                float lat = 90.0 - (a_pos.y * 180.0);  // Corrected latitude calculation
                
                // Create normalized coordinates
                vec2 position = vec2(
                    lon / 180.0,
                    lat / 90.0  // Linear mapping for latitude
                );
                
                // Apply zoom and offset
                vec2 zoomedPos = position * u_zoom + u_offset;
                
                // Get wind data using original texture coordinates
                vec2 texCoords = vec2(a_pos.x, a_pos.y);
                vec2 velocity = mix(u_wind_min, u_wind_max, texture2D(u_wind, texCoords).rg);
                float speed = length(velocity) / length(u_wind_max);
                
                vec2 ramp_pos = vec2(
                    fract(16.0 * speed),
                    floor(16.0 * speed) / 16.0  
                );
                vec4 color = texture2D(u_color_ramp, ramp_pos);
                v_color = vec4(color.rgb, color.a * u_opacity);
                
                gl_Position = vec4(zoomedPos, 0, 1);
                gl_PointSize = 4.0 * u_zoom;
            }
        `;

        const fragmentSource = `
            precision highp float;
            varying vec4 v_color;
            
            void main() {
                gl_FragColor = v_color;
            }
        `;
        
        this.program = createProgram(this.gl, vertexSource, fragmentSource);
    }

    createPoints() {
        const points = new Float32Array(this.pointCount * 2);
        
        for (let i = 0; i < this.gridResY; i++) {
            for (let j = 0; j < this.gridResX; j++) {
                const idx = (i * this.gridResX + j) * 2;
                points[idx] = j / (this.gridResX - 1);
                points[idx + 1] = i / (this.gridResY - 1); 
            }
        }
        
        this.posBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.posBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, points, this.gl.STATIC_DRAW);
    }

    syncWithLeafletBounds(map) {
        const bounds = map.getBounds();
        const west = bounds.getWest();
        const east = bounds.getEast();
        const north = bounds.getNorth();
        const south = bounds.getSouth();
    
        const centerLat = (north + south) / 2;
        const centerLon = (west + east) / 2;
    
        // Calculate zoom based on longitude span
        const lonSpan = Math.abs(east - west);
        const zoom = 360 / lonSpan;
    
        this.mapBounds = {
            north: north,
            south: south,
            east: east,
            west: west,
            centerLat: centerLat,
            centerLon: centerLon
        };
    
        // Update transform parameters
        this.zoom = zoom;
        this.offsetX = centerLon / 180;
        this.offsetY = centerLat / 90;
    
        this.draw();
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

    getColorRamp() {
        return this.colorRamps;
    }

    getMaxWindSpeed() {
        if (!this.windData) return 0;
        const maxU = Math.max(Math.abs(this.windData.uMin), Math.abs(this.windData.uMax));
        const maxV = Math.max(Math.abs(this.windData.vMin), Math.abs(this.windData.vMax));
        return Math.sqrt(maxU * maxU + maxV * maxV);
    }

    setWind(windData) {
        this.windData = windData;
        this.windTexture = createTexture(this.gl, this.gl.LINEAR, windData.image);
    }

    setZoom(zoom, offsetX, offsetY) {
        this.zoom = zoom;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
    }

    setOpacity(opacity) {
        this.opacity = opacity;
    }

    getBounds() {
        return this.mapBounds || {
            north: 90,
            south: -90,
            east: 180,
            west: -180,
            center: {
                lat: 0,
                lon: 0
            }
        };
    }

    
    // In WindGL class, replace the screenToLatLon method with:

    screenToLatLon(screenX, screenY) {
        const rect = this.gl.canvas.getBoundingClientRect();
        
        // Convert screen coordinates to NDC
        const ndcX = (screenX - rect.left) / rect.width * 2 - 1;
        const ndcY = 1 - (screenY - rect.top) / rect.height * 2;
    
        const bounds = this.getBounds();
    
        // Calculate lon linearly
        const lonRange = bounds.east - bounds.west;
        const lon = bounds.west + (ndcX + 1) * lonRange / 2;
    
        // Calculate lat using Mercator projection
        function latToMercatorY(lat) {
            return Math.log(Math.tan((90 + lat) * Math.PI / 360)) / Math.PI;
        }
    
        function mercatorYToLat(y) {
            return 360 * Math.atan(Math.exp(y * Math.PI)) / Math.PI - 90;
        }
    
        const northMercY = latToMercatorY(bounds.north);
        const southMercY = latToMercatorY(bounds.south);
        const mercRange = northMercY - southMercY;
        
        // Interpolate in Mercator space
        const normalizedY = (1 - ndcY) / 2;
        const mercY = northMercY - normalizedY * mercRange;
        const lat = mercatorYToLat(mercY);
    
        return {
            lat: lat,
            lon: lon
        };
    }
    
    // Update convertToTexCoords accordingly
    convertToTexCoords(latLon) {
        function latToMercatorY(lat) {
            return Math.log(Math.tan((90 + lat) * Math.PI / 360)) / Math.PI;
        }
    
        const mercY = latToMercatorY(latLon.lat);
        
        return {
            x: (latLon.lon + 180) / 360,
            y: (mercY + 1) / 2  // Normalize mercator Y to [0,1]
        };
    }
    

    getWindAtPoint(latLon) {
        if (!this.windData || !this.windData.image) return null;
    
        const texCoords = this.convertToTexCoords(latLon);
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

    calculateWindSpeed(u, v) {
        return Math.sqrt(u * u + v * v);
    }

    calculateWindDirection(u, v) {
        let direction = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
        return direction;
    }

    draw() {
        const gl = this.gl;
        
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);
        
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
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
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
            gl.viewport(0, 0, canvas.width, canvas.height);
        }
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

    interpolateWindComponent(pixelValue, min, max) {
        return min + (pixelValue / 255) * (max - min);
    }
}

// Make WindGL available globally
window.WindGL = WindGL;