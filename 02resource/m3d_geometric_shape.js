//
// m3d_geometric_shape.js
// Create vertices and indices data of a few geometric primitives
//
//  
//


import MeshAttributes from "./m3d_mesh_attribute.js";

export default (function() {
    "use strict";

    function GeometricShape() {
        this.vertices   = null;
        this.indices    = null;
        this.attributes = null;
        this.indexType  = null;
        this.primitive  = null;
    };

    // transform the geometry by 4x4 matrix
    GeometricShape.prototype.transform = function(matrix) {
        if (!this.attributes) {
            return;
        }

        var numFloats = this.attributes.values[0].stride / 4;
        var hasNormal = this.attributes.hasNormal;
        var out = [0, 0, 0, 0];
        var v = [0, 0, 0];

        // FIXME: We don't use normal matrix.
        if (hasNormal) {
            modelo3d.debug("suppose no scaling in transform.");
        }

        for (var i = 0, len = this.vertices.length; i < len; i += numFloats) {
            v[0] = this.vertices[i];
            v[1] = this.vertices[i + 1];
            v[2] = this.vertices[i + 2];
            
            vec3.transformMat4(out, v, matrix);

            this.vertices[i] = out[0];
            this.vertices[i + 1] = out[1];
            this.vertices[i + 2] = out[2];

            if (hasNormal) {
                v[0] = this.vertices[i + 3];
                v[1] = this.vertices[i + 4];
                v[2] = this.vertices[i + 5];
                v[3] = 0;

                vec4.transformMat4(out, v, matrix);

                vec3.normalize(out, out);

                this.vertices[i + 3] = out[0];
                this.vertices[i + 4] = out[1];
                this.vertices[i + 5] = out[2];
            }
        }
    };

    // rotate by z, then by y, and by x finally
    GeometricShape.prototype.rotate = function(x, y, z) {
        var matrix = mat4.create();
        var tmp = mat4.create();
        mat4.rotateZ(matrix, tmp, z);
        mat4.rotateY(tmp, matrix, y);
        mat4.rotateX(matrix, tmp, x);
        this.transform(matrix);
    };
    GeometricShape.prototype.translate = function(x, y, z) {
        var matrix = mat4.create();
        mat4.fromTranslation(matrix, [x, y, z]);
        this.transform(matrix);
    };
    GeometricShape.prototype.scale = function(x, y, z) {
        var matrix = mat4.create();
        mat4.fromScaling(matrix, [x, y, z]);
        this.transform(matrix);
    };

    GeometricShape.prototype.merge = function(a, b) {
        if (a.attributes.values[0].stride !== b.attributes.values[0].stride) {

            return;
        }

        var vertices = new Float32Array(a.vertices.length + b.vertices.length);
        var i, j;
        for (i = 0; i < a.vertices.length; i++) {
            vertices[i] = a.vertices[i];
        }
        for (i = 0, j = a.vertices.length; i < b.vertices.length; i++, j++) {
            vertices[j] = b.vertices[i];
        }
        var indices = new Uint16Array(a.indices.length + b.indices.length);
        for (i = 0; i < a.indices.length; i++) {
            indices[i] = a.indices[i];
        }
        var numVertices = a.vertices.length / (a.attributes.values[0].stride / 4);
        for (i = 0, j = a.indices.length; i < b.indices.length; i++, j++) {
            indices[j] = b.indices[i] + numVertices;
        }

        this.vertices   = vertices;
        this.indices    = indices;
        this.attributes = a.attributes;
        this.indexType  = gl.UNSIGNED_SHORT;
    };
    
    GeometricShape.prototype.createWiredCube = function() {
        var vertices = new Float32Array(8 * 3);
        var indices  = new Uint8Array(12 * 2);

        vertices[0] = -1.0; vertices[1] = -1.0; vertices[2] = -1.0; 
        vertices[3] =  1.0; vertices[4] = -1.0; vertices[5] = -1.0; 
        vertices[6] =  1.0; vertices[7] =  1.0; vertices[8] = -1.0; 
        vertices[9] =  -1.0; vertices[10] =  1.0; vertices[11] = -1.0; 
        vertices[12] =  -1.0; vertices[13] = -1.0; vertices[14] = 1.0; 
        vertices[15] =  1.0; vertices[16] =  -1.0; vertices[17] = 1.0; 
        vertices[18] =  1.0; vertices[19] =  1.0; vertices[20] = 1.0; 
        vertices[21] =  -1.0; vertices[22] =  1.0; vertices[23] = 1.0; 

        indices[0] = 0; indices[1] = 1;
        indices[2] = 1; indices[3] = 2;
        indices[4] = 2; indices[5] = 3;
        indices[6] = 3; indices[7] = 0;

        indices[8] = 0; indices[9] = 4;
        indices[10] = 1; indices[11] = 5;
        indices[12] = 2; indices[13] = 6;
        indices[14] = 3; indices[15] = 7;

        indices[16] = 4; indices[17] = 5;
        indices[18] = 5; indices[19] = 6;
        indices[20] = 6; indices[21] = 7;
        indices[22] = 7; indices[23] = 4;


        this.vertices   = vertices;
        this.indices    = indices;

        this.indexType = gl.UNSIGNED_BYTE;

        this.primitive = gl.LINES;
        
        this.attributes = new MeshAttributes();
        this.attributes.builtin(gl.FLOAT);
    }; 

    GeometricShape.prototype.createSolidCube = function() {
        var vertices = new Float32Array(6 * 4 * 6);
        var indices = new Uint8Array(6 * 2 * 3);
        
        var voff;
        var ioff;
        // -x
        voff = 0;
        ioff = 0;
        vertices[voff + 0] = -1.0;  vertices[voff + 1] = -1.0;  vertices[voff + 2] = -1.0;
        vertices[voff + 3] = -1.0;  vertices[voff + 4] = 0.0;   vertices[voff + 5] = 0.0;
        
        vertices[voff + 6] = -1.0;  vertices[voff + 7] =  1.0;  vertices[voff + 8] = -1.0;
        vertices[voff + 9] = -1.0;  vertices[voff + 10] = 0.0;  vertices[voff + 11] = 0.0;
        
        vertices[voff + 12] = -1.0; vertices[voff + 13] = -1.0; vertices[voff + 14] = 1.0;
        vertices[voff + 15] = -1.0; vertices[voff + 16] = 0.0;  vertices[voff + 17] = 0.0;
        
        vertices[voff + 18] = -1.0; vertices[voff + 19] = 1.0;  vertices[voff + 20] = 1.0;
        vertices[voff + 21] = -1.0; vertices[voff + 22] = 0.0;  vertices[voff + 23] = 0.0;

        indices[ioff + 0] = 0; indices[ioff + 1] = 2; indices[ioff + 2] = 1;
        indices[ioff + 3] = 1; indices[ioff + 4] = 2; indices[ioff + 5] = 3;
                
        // +x
        voff += 24;
        ioff += 6;
        vertices[voff + 0] = 1.0;  vertices[voff + 1] = -1.0;  vertices[voff + 2] = -1.0;
        vertices[voff + 3] = 1.0;  vertices[voff + 4] = 0.0;   vertices[voff + 5] = 0.0;
        
        vertices[voff + 6] = 1.0;  vertices[voff + 7] =  1.0;  vertices[voff + 8] = -1.0;
        vertices[voff + 9] = 1.0;  vertices[voff + 10] = 0.0;  vertices[voff + 11] = 0.0;
        
        vertices[voff + 12] = 1.0; vertices[voff + 13] = -1.0; vertices[voff + 14] = 1.0;
        vertices[voff + 15] = 1.0; vertices[voff + 16] = 0.0;  vertices[voff + 17] = 0.0;
        
        vertices[voff + 18] = 1.0; vertices[voff + 19] = 1.0;  vertices[voff + 20] = 1.0;
        vertices[voff + 21] = 1.0; vertices[voff + 22] = 0.0;  vertices[voff + 23] = 0.0;

        indices[ioff + 0] = 4; indices[ioff + 1] = 5; indices[ioff + 2] = 6;
        indices[ioff + 3] = 5; indices[ioff + 4] = 7; indices[ioff + 5] = 6;
        
        // -y
        voff += 24;
        ioff += 6;
        vertices[voff + 0] = -1.0;  vertices[voff + 1] = -1.0;  vertices[voff + 2] = -1.0;
        vertices[voff + 3] = 0.0;   vertices[voff + 4] = -1.0;  vertices[voff + 5] = 0.0;
        
        vertices[voff + 6] = 1.0;   vertices[voff + 7] = -1.0;  vertices[voff + 8] = -1.0;
        vertices[voff + 9] = 0.0;   vertices[voff + 10] = -1.0; vertices[voff + 11] = 0.0;
        
        vertices[voff + 12] = -1.0; vertices[voff + 13] = -1.0; vertices[voff + 14] = 1.0;
        vertices[voff + 15] = 0.0;  vertices[voff + 16] = -1.0; vertices[voff + 17] = 0.0;
        
        vertices[voff + 18] = 1.0;  vertices[voff + 19] = -1.0; vertices[voff + 20] = 1.0;
        vertices[voff + 21] = 0.0;  vertices[voff + 22] = -1.0; vertices[voff + 23] = 0.0;

        indices[ioff + 0] = 8;  indices[ioff + 1] = 9;  indices[ioff + 2] = 11;
        indices[ioff + 3] = 11; indices[ioff + 4] = 10; indices[ioff + 5] = 8;
        
        // +y
        voff += 24;
        ioff += 6;
        vertices[voff + 0] = -1.0;  vertices[voff + 1] = 1.0;  vertices[voff + 2] = -1.0;
        vertices[voff + 3] = 0.0;   vertices[voff + 4] = 1.0;  vertices[voff + 5] = 0.0;
        
        vertices[voff + 6] = 1.0;   vertices[voff + 7] = 1.0;  vertices[voff + 8] = -1.0;
        vertices[voff + 9] = 0.0;   vertices[voff + 10] = 1.0; vertices[voff + 11] = 0.0;
        
        vertices[voff + 12] = -1.0; vertices[voff + 13] = 1.0; vertices[voff + 14] = 1.0;
        vertices[voff + 15] = 0.0;  vertices[voff + 16] = 1.0; vertices[voff + 17] = 0.0;
        
        vertices[voff + 18] = 1.0;  vertices[voff + 19] = 1.0; vertices[voff + 20] = 1.0;
        vertices[voff + 21] = 0.0;  vertices[voff + 22] = 1.0; vertices[voff + 23] = 0.0;

        indices[ioff + 0] = 12; indices[ioff + 1] = 14; indices[ioff + 2] = 13;
        indices[ioff + 3] = 13; indices[ioff + 4] = 14; indices[ioff + 5] = 15;
        
        // -z
        voff += 24;
        ioff += 6;
        vertices[voff + 0] = -1.0;  vertices[voff + 1] = -1.0; vertices[voff + 2] = -1.0;
        vertices[voff + 3] = 0.0;   vertices[voff + 4] = 0.0;  vertices[voff + 5] = -1.0;
        
        vertices[voff + 6] = 1.0;   vertices[voff + 7] = -1.0; vertices[voff + 8] = -1.0;
        vertices[voff + 9] = 0.0;   vertices[voff + 10] = 0.0; vertices[voff + 11] = -1.0;
        
        vertices[voff + 12] = -1.0; vertices[voff + 13] = 1.0; vertices[voff + 14] = -1.0;
        vertices[voff + 15] = 0.0;  vertices[voff + 16] = 0.0; vertices[voff + 17] = -1.0;
        
        vertices[voff + 18] = 1.0;  vertices[voff + 19] = 1.0; vertices[voff + 20] = -1.0;
        vertices[voff + 21] = 0.0;  vertices[voff + 22] = 0.0; vertices[voff + 23] = -1.0;

        indices[ioff + 0] = 16; indices[ioff + 1] = 19; indices[ioff + 2] = 17;
        indices[ioff + 3] = 19; indices[ioff + 4] = 16; indices[ioff + 5] = 18;

        // +z
        voff += 24;
        ioff += 6;
        vertices[voff + 0] = -1.0;  vertices[voff + 1] = -1.0; vertices[voff + 2] = 1.0;
        vertices[voff + 3] = 0.0;   vertices[voff + 4] = 0.0;  vertices[voff + 5] = 1.0;
        
        vertices[voff + 6] = 1.0;   vertices[voff + 7] = -1.0; vertices[voff + 8] = 1.0;
        vertices[voff + 9] = 0.0;   vertices[voff + 10] = 0.0; vertices[voff + 11] = 1.0;
        
        vertices[voff + 12] = -1.0; vertices[voff + 13] = 1.0; vertices[voff + 14] = 1.0;
        vertices[voff + 15] = 0.0;  vertices[voff + 16] = 0.0; vertices[voff + 17] = 1.0;
        
        vertices[voff + 18] = 1.0;  vertices[voff + 19] = 1.0; vertices[voff + 20] = 1.0;
        vertices[voff + 21] = 0.0;  vertices[voff + 22] = 0.0; vertices[voff + 23] = 1.0;

        indices[ioff + 0] = 20; indices[ioff + 1] = 21; indices[ioff + 2] = 23;
        indices[ioff + 3] = 23; indices[ioff + 4] = 22; indices[ioff + 5] = 20;

        this.vertices   = vertices;
        this.indices    = indices;
        
        this.primitive = gl.TRIANGLES;

        this.attributes = new MeshAttributes();
        this.attributes.builtin(gl.FLOAT, gl.FLOAT);

        this.indexType = gl.UNSIGNED_BYTE;
    };

    GeometricShape.prototype.createQuad = function() {
        var vertices = new Float32Array(20);
        var indices = new Uint8Array(6);

        vertices[0] = -1.0; vertices[1] = -1.0;  vertices[2] = 0.0; 
        vertices[3] = 0.0; vertices[4] = 0.0;

        vertices[5] = 1.0; vertices[6] = -1.0; vertices[7] = 0.0; 
        vertices[8] = 1.0; vertices[9] = 0.0;

        vertices[10] = 1.0; vertices[11] = 1.0; vertices[12] = 0.0; 
        vertices[13] = 1.0; vertices[14] = 1.0;

        vertices[15] = -1.0; vertices[16] = 1.0; vertices[17] = 0.0; 
        vertices[18] = 0.0; vertices[19] = 1.0;

        indices[0] = 0;
        indices[1] = 1;
        indices[2] = 2;
        indices[3] = 2;
        indices[4] = 3;
        indices[5] = 0;

        this.vertices   = vertices;
        this.indices    = indices;
        
        this.primitive = gl.TRIANGLES;

        this.attributes = new MeshAttributes();
        this.attributes.builtin(gl.FLOAT, null, gl.FLOAT, null);

        this.indexType = gl.UNSIGNED_BYTE; 
    };
    
    GeometricShape.prototype.createSolidQuad = function() {
        var vertices = new Float32Array(12);
        var indices = new Uint8Array(6);

        vertices[0] = -1.0; vertices[1] = -1.0;  vertices[2] = 0.0; 
        vertices[3] = 1.0; vertices[4] = -1.0; vertices[5] = 0.0; 
        vertices[6] = 1.0; vertices[7] = 1.0; vertices[8] = 0.0; 
        vertices[9] = -1.0; vertices[10] = 1.0; vertices[11] = 0.0; 

        indices[0] = 0;
        indices[1] = 1;
        indices[2] = 2;
        indices[3] = 2;
        indices[4] = 3;
        indices[5] = 0;

        this.vertices   = vertices;
        this.indices    = indices;
        
        this.primitive = gl.TRIANGLES;

        this.attributes = new MeshAttributes();
        this.attributes.builtin(gl.FLOAT);

        this.indexType = gl.UNSIGNED_BYTE; 
    };

    GeometricShape.prototype.createPoint = function() {
        var vertices = new Float32Array(10);
        var indices = new Uint8Array(1);

        vertices[0] = 0; vertices[1] = 0; vertices[2] = 0;
        vertices[3] = 0; vertices[4] = 0; vertices[5] = 1; 
        vertices[6] = 0; vertices[7] = 0; vertices[8] = 0; vertices[9] = 0; 

        indices[0] = 0;

        this.vertices   = vertices;
        this.indices    = indices;
        
        this.primitive = gl.POINTS;

        this.attributes = new MeshAttributes();
        this.attributes.builtin(gl.FLOAT, gl.FLOAT, null, gl.FLOAT);

        this.indexType = gl.UNSIGNED_BYTE; 
    }; 

    GeometricShape.prototype.createSphere = function(ringNumber, segmentNumber) {
        var vertices = new Float32Array((ringNumber + 1) * (segmentNumber + 1) * 8);
        var indices = new Uint16Array(6 * ringNumber * (segmentNumber + 1));

        var n = new Float32Array(3);
    
        var deltaRingAngle = Math.PI / ringNumber;
        var deltaSegAngle = 2.0 * Math.PI / segmentNumber;

        var iIndex = 0;
        var vIndex = 0;
        var index = 0;
    
        for (var ring = 0; ring <= ringNumber; ++ring) {
            var r0 = Math.sin(ring * deltaRingAngle);
            var z0 = Math.cos(ring * deltaRingAngle);

            // Generate the group of segments for the current ring
            for (var seg = 0; seg <= segmentNumber; ++seg) {
                var x0 = r0 * Math.cos(seg * deltaSegAngle);
                var y0 = r0 * Math.sin(seg * deltaSegAngle);

                // Add one vertex to the strip which makes up the sphere
            
                // Position.
                vertices[index++] = x0;
                vertices[index++] = y0;
                vertices[index++] = z0;

                // Normal
                n[0] = x0;
                n[1] = y0;
                n[2] = z0;
                vec3.normalize(n, n);
                vertices[index++] = n[0];
                vertices[index++] = n[1];
                vertices[index++] = n[2];
            
                // texture coordinate
                vertices[index++] = seg / segmentNumber;
                vertices[index++] = ring / ringNumber;

                if (ring !== ringNumber) {
                    // each vertex (except the last) has six indices pointing to it
                    indices[iIndex++] = vIndex + segmentNumber + 1;
                    indices[iIndex++] = vIndex;               
                    indices[iIndex++] = vIndex + segmentNumber;
                    indices[iIndex++] = vIndex + segmentNumber + 1;
                    indices[iIndex++] = vIndex + 1;
                    indices[iIndex++] = vIndex;

                    vIndex++;
                }
            }
        }
        
        this.vertices   = vertices;
        this.indices    = indices;
        
        this.attributes = new MeshAttributes();
        this.attributes.builtin(gl.FLOAT, gl.FLOAT, gl.FLOAT);
        
        this.primitive = gl.TRIANGLES;

        this.indexType = gl.UNSIGNED_SHORT;
    };
    
    GeometricShape.prototype.createLine = function() {
        var vertices = new Float32Array(6);
        var indices = new Uint8Array(2);

        vertices[0] = -0.5; vertices[1] = 0; vertices[2] = 0;
        vertices[3] = 0.5; vertices[4] = 0; vertices[5] = 0;

        indices[0] = 0;
        indices[1] = 1;

        this.vertices   = vertices;
        this.indices    = indices;

        this.attributes = new MeshAttributes();
        this.attributes.builtin(gl.FLOAT);

        this.primitive = gl.LINES;

        this.indexType  = gl.UNSIGNED_BYTE;
    };

    GeometricShape.prototype.createTorus = function(majorRadius, minorRadius, majorSegments, minorSegments) {
        var PI2 = Math.PI * 2;

        var vertices = new Float32Array(minorSegments * majorSegments * 8);
        var indices = new Uint16Array(minorSegments * majorSegments * 2 * 3);

        var index = 0;
        var center = [0, 0];
        var vertex = [0, 0, 0];
        var normal = [0, 0, 0];
        var i, j;
        for (j = 0; j < minorSegments; j++) {
            for (i = 0; i < majorSegments; i++) {
                var u = i / majorSegments * PI2;
                var v = j / minorSegments * PI2;

                center[0] = majorRadius * Math.cos(u);
                center[1] = majorRadius * Math.sin(u);

                vertex[0] = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u);
                vertex[1] = (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u),
                vertex[2] = minorRadius * Math.sin(v);

                vec3.subtract(normal, vertex, center);
                vec3.normalize(normal, normal);
                
                vertices[index + 0] = vertex[0];
                vertices[index + 1] = vertex[1];
                vertices[index + 2] = vertex[2];

                vertices[index + 3] = normal[0];
                vertices[index + 4] = normal[1];
                vertices[index + 5] = normal[2];
                
                vertices[index + 6] = i / majorRadius;
                vertices[index + 7] = j / minorRadius;

                index += 8;
            }
        }

        index = 0;
        for (j = 0; j < minorSegments; j++) {
            for (i = 0; i < majorSegments; i++) {

                var i0 = (i + 1) % majorSegments;
                var j0 = (j + 1) % minorSegments;

                var a = majorSegments * j + i;
                var b = majorSegments * j + i0;
                var c = majorSegments * j0 + i;
                var d = majorSegments * j0 + i0;

                indices[index] = a;
                indices[index + 1] = c;
                indices[index + 2] = b;
                
                indices[index + 3] = c;
                indices[index + 4] = d;
                indices[index + 5] = b;

                index += 6;
            }
        }

        this.vertices   = vertices;
        this.indices    = indices;

        this.attributes = new MeshAttributes();
        this.attributes.builtin(gl.FLOAT, gl.FLOAT, gl.FLOAT);

        this.primitive = gl.TRIANGLES;

        this.indexType = gl.UNSIGNED_SHORT;
    };

    GeometricShape.prototype.createCone = function(radius, height, segments) {
        var PI2 = Math.PI * 2;

        var vertices = new Float32Array(segments * 6 * 3 + 6);
        var indices = new Uint16Array(segments * 9);

        var index = 0;
        var normal = [0, 0, 0];
        var nr = radius * height * height / (radius * radius + height * height);
        var nh = radius * radius * height / (radius * radius + height * height);
        var j;
        for (j = 0; j < segments; j++) {
            var u = j / segments * PI2;

            var cosU = Math.cos(u);
            var sinU = Math.sin(u);

            vertices[index]     = radius * cosU;
            vertices[index + 1] = radius * sinU;
            vertices[index + 2] = 0;

            normal[0] = nr * cosU;
            normal[1] = nr * sinU;
            normal[2] = nh;

            vec3.normalize(normal, normal);

            vertices[index + 3] = normal[0];
            vertices[index + 4] = normal[1];
            vertices[index + 5] = normal[2];

            index += 6;

            vertices[index]     = 0;
            vertices[index + 1] = 0;
            vertices[index + 2] = height;
            
            vertices[index + 3] = normal[0];
            vertices[index + 4] = normal[1];
            vertices[index + 5] = normal[2];
            
            index += 6;
            
            vertices[index]     = 0;
            vertices[index + 1] = 0;
            vertices[index + 2] = height;
            
            vertices[index + 3] = 0;
            vertices[index + 4] = 0;
            vertices[index + 5] = -1;
            
            index += 6;
        }

        vertices[index + 0] = 0;
        vertices[index + 1] = 0;
        vertices[index + 2] = 0;

        index = 0;
        for (j = 0; j < segments; j++) {
            var j0 = (j + 1) % segments;

            indices[index] = j * 3 + 1;
            indices[index + 1] = j * 3;
            indices[index + 2] = j0 * 3;
            
            indices[index + 3] = j0 * 3;
            indices[index + 4] = j0 * 3 + 1;
            indices[index + 5] = j * 3 + 1;

            index += 6;
        }
        
        for (j = 0; j < segments; j++) {
            var j0 = (j + 1) % segments;
            indices[index] = segments * 3;
            indices[index + 1] = j0 * 3 + 2;
            indices[index + 2] = j * 3 + 2;

            index += 3;
        }
        
        this.vertices   = vertices;
        this.indices    = indices;

        this.attributes = new MeshAttributes();
        this.attributes.builtin(gl.FLOAT, gl.FLOAT);

        this.primitive = gl.TRIANGLES;

        this.indexType = gl.UNSIGNED_SHORT;
    };
    
    GeometricShape.prototype.createCylinder = function(radius, height, segments) {
        var PI2 = Math.PI * 2;

        var vertices = new Float32Array(segments * 6 * 4 + 6);
        var indices = new Uint16Array(segments * 12);

        var index = 0;
        var j, j0;
        for (j = 0; j < segments; j++) {
            var u = j / segments * PI2;

            var cosU = Math.cos(u);
            var sinU = Math.sin(u);

            vertices[index]     = radius * cosU;
            vertices[index + 1] = radius * sinU;
            vertices[index + 2] = 0;

            vertices[index + 3] = cosU;
            vertices[index + 4] = sinU;
            vertices[index + 5] = 0;

            index += 6;

            vertices[index]     = radius * cosU;
            vertices[index + 1] = radius * sinU;
            vertices[index + 2] = height;
            
            vertices[index + 3] = cosU;
            vertices[index + 4] = sinU;
            vertices[index + 5] = 0;
            
            index += 6;
            
            vertices[index]     = radius * cosU;
            vertices[index + 1] = radius * sinU;
            vertices[index + 2] = 0;

            vertices[index + 3] = 0;
            vertices[index + 4] = 0;
            vertices[index + 5] = -1;

            index += 6;

            vertices[index]     = radius * cosU;
            vertices[index + 1] = radius * sinU;
            vertices[index + 2] = height;
            
            vertices[index + 3] = 0;
            vertices[index + 4] = 0;
            vertices[index + 5] = 1;
            
            index += 6;
        }

        vertices[index + 0] = 0;
        vertices[index + 1] = 0;
        vertices[index + 2] = 0;
        
        vertices[index + 3] = 0;
        vertices[index + 4] = 0;
        vertices[index + 5] = height;

        index = 0;
        for (j = 0; j < segments; j++) {
            j0 = (j + 1) % segments;

            indices[index] = j * 4 + 1;
            indices[index + 1] = j * 4;
            indices[index + 2] = j0 * 4;
            
            indices[index + 3] = j0 * 4;
            indices[index + 4] = j0 * 4 + 1;
            indices[index + 5] = j * 4 + 1;

            index += 6;
        }
        
        for (j = 0; j < segments; j++) {
            j0 = (j + 1) % segments;
            indices[index] = segments * 4;
            indices[index + 1] = j0 * 4 + 2;
            indices[index + 2] = j * 4 + 2;
            
            indices[index] = segments * 4 + 1;
            indices[index + 1] = j0 * 4 + 3;
            indices[index + 2] = j * 4 + 3;

            index += 6;
        }
        
        this.vertices   = vertices;
        this.indices    = indices;

        this.attributes = new MeshAttributes();
        this.attributes.builtin(gl.FLOAT, gl.FLOAT);

        this.primitive = gl.TRIANGLES;

        this.indexType = gl.UNSIGNED_SHORT;
    };

    GeometricShape.prototype.createArrow = function(radius, height) {
        var c = new GeometricShape();    
        var t = new GeometricShape();

        c.createCylinder(radius * 0.6, height * 0.9, 8); // stem
        t.createCone(radius, height * 0.1, 8); // tip
        t.translate(0, 0, height * 0.9);

        // merge two primitives into one
        var r = new GeometricShape();    
        r.merge(c, t);

        this.vertices   = r.vertices;
        this.indices    = r.indices;
        this.attributes = r.attributes;
        this.indexType  = r.indexType;
        this.primitive = gl.TRIANGLES
    };

    return GeometricShape;
})();
    

