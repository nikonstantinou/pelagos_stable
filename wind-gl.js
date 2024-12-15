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
        this.gridResY = 720*5;
        this.pointCount = this.gridResX * this.gridResY;
        
        // Longitude and latitude ranges
        this.lonRange = [-180, 180]; 
        this.latRange = [-90, 90];
        
        this.createShaders();
        this.createPoints();
        
        // Default color ramp
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
        
        const float PI = 3.14159265359;
        
        void main() {
            // Use position directly for texture coordinates
            vec2 texCoords = vec2(a_pos.x, 1.0 - a_pos.y);
            
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
            
            // Position with wrapping support
            vec2 position = a_pos * 2.0 - 1.0;
            float lon = position.x * 180.0;
            float lat = position.y * 90.0;
            
            // Apply Mercator projection
            float y = 2.0 * log(tan(PI * 0.25 + lat * PI / 360.0)) / PI;
            float x = lon / 180.0;
            
            // Apply zoom and offset
            vec2 mercPos = vec2(x, y) * u_zoom + u_offset;
            
            gl_Position = vec4(mercPos, 0, 1);
            
            // Scale point size based on latitude and zoom
            float latScale = cos(lat * PI / 180.0);
            gl_PointSize = max(1.0, 4.0 * u_zoom * latScale);
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
                
                // Normalize coordinates to 0-1 range
                points[idx] = j / (this.gridResX - 1);
                points[idx + 1] = i / (this.gridResY - 1); 
            }
        }
        
        this.posBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.posBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, points, this.gl.STATIC_DRAW);
    }

    syncWithLeafletBounds(map) {
        // Get Leaflet's bounds
        const bounds = map.getBounds();
        const west = bounds.getWest();
        const east = bounds.getEast();
        const north = bounds.getNorth();
        const south = bounds.getSouth();
    
        // Handle wraparound for longitude
        let adjustedEast = east;
        let adjustedWest = west;
        
        // If crossing the 180th meridian
        if (east < west) {
            adjustedEast = east + 360;
        }

        // Calculate spans separately for longitude and latitude
        const lonSpan = Math.abs(adjustedEast - adjustedWest);
        const latSpan = Math.abs(north - south);
        
        // Calculate zoom based on the larger span to ensure full coverage
        // Use separate zoom factors for latitude and longitude
        const lonZoom = 360 / lonSpan;
        const latZoom = 180 / latSpan;
        
        // Use the smaller zoom to ensure both dimensions are fully visible
        const zoom = Math.min(lonZoom, latZoom);

        // Calculate center points
        const centerLon = (adjustedWest + adjustedEast) / 2;
        const centerLat = (north + south) / 2;

        // Calculate normalized offsets with latitude correction
        const offsetX = -centerLon / 180;
        const offsetY = -centerLat / 90;

        // Update the wind visualization
        this.setZoom(zoom, offsetX, offsetY);
        this.draw();
    }

    setZoom(zoom, offsetX, offsetY) {
        this.zoom = zoom;
        this.offsetX = offsetX;
        this.offsetY = offsetY;

        // Calculate the visible area in degrees
        const lonHalfSpan = 180 / zoom;
        const latHalfSpan = 90 / zoom;

        // Calculate bounds with proper latitude handling
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

    

    getBounds() {
        return {
            ...this.mapBounds,
            center: {
                lat: (this.mapBounds.north + this.mapBounds.south) / 2,
                lon: (this.mapBounds.east + this.mapBounds.west) / 2
            }
        };
    }
        
    
    setOpacity(opacity) {
        this.opacity = opacity;
    }

    convertToTexCoords(latLon) {
        return {
            x: (latLon.lon + 180) / 360,
            y: 1 - (latLon.lat + 90) / 180 
        };
    }

    // In the WindGL class, modify the getWindAtPoint method:

    getWindAtPoint(latLon) {
        if (!this.windData || !this.windData.image) return null;
    
        // Convert from negative coordinates to texture coordinates
        const texCoords = {
            x: (latLon.lon + 180) / 360,
            // ANAPODOS ANEMOS!!!!!
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


    interpolateWindComponent(pixelValue, min, max) {
        return min + (pixelValue / 255) * (max - min);
    }

    calculateWindSpeed(u, v) {
        return Math.sqrt(u * u + v * v);
    }

    calculateWindDirection(u, v) {
        let direction = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
        return direction;
    }

    

    screenToLatLon(screenX, screenY) {
        const rect = this.gl.canvas.getBoundingClientRect();
        
        // Convert screen coordinates to Normalized Device Coordinates (NDC)
        const ndcX = (screenX - rect.left) / rect.width * 2 - 1;
        const ndcY = -1 * (1 - (screenY - rect.top) / rect.height * 2);
    
        // Apply inverse of zoom and offset
        const mapX = (ndcX + this.offsetX) / this.zoom;
        const mapY = (ndcY + this.offsetY) / this.zoom;
    
        // Convert NDC to negative longitude
        const lon = -mapX * 180;
    
        // Convert y coordinate from Mercator projection to latitude
        // First convert y to a value between -π and π
        const mercatorY = mapY * Math.PI;
        
        // Then convert Mercator y to latitude in radians using the inverse Mercator formula
        // lat = 2 * arctan(e^y) - π/2
        const latRad = 2 * Math.atan(Math.exp(mercatorY)) - Math.PI/2;
        
        // Convert latitude to degrees and make it negative
        const lat = -(latRad * 180 / Math.PI);
    
        return { lat, lon };
    }
    
    // Add these helper methods for testing and validation:

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
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
            gl.viewport(0, 0, canvas.width, canvas.height);
        }
    }
}

window.WindGL = WindGL;