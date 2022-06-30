//
// m3d_mesh.js
// The mesh wrapper
//
//  

import MeshAttributes from "./m3d_mesh_attribute.js";
import GeometricShape from "./m3d_geometric_shape.js";

export default (function() {
    "use strict";

    function Mesh(name, resourceManager) {
        // private:
        this._name       = name;
        this._vao        = null;  
        this._vbo        = null;
        this._ibo        = null;
        this._primitive  = 4;     // by default it is triangle  
        this._attributes = null;
        this._manager    = resourceManager; 
        this._type       = gl.UNSIGNED_INT;
        this._vboBase   = 0;
        this._iboBase   = 0;
        this._shared    = false;
        
        // public:
        this.ready      = false;
        this.length     = 0;
        this.bytes     = 0;
        this.indexSize  = 2;
    };

    Mesh.prototype.destroy = function() {
        if (this.ready) {
            if (!this._shared) {
                gl.deleteBuffer(this._vbo);
                this._vbo = false;
                delete this._vbo;

                gl.deleteBuffer(this._ibo);
                this._ibo = false;
                delete this._ibo;
            }


            if (this._vao) {
                gl.deleteVertexArray(this.vao);
                this._vao = false;
                delete this._vao;
            }
        
            this.ready = false;

            var err;
            if ((err = gl.getError()) !== gl.NO_ERROR) {
                console.log("GL error in mesh.destroy(): " + err);
            }
        }

        if (this._manager) {
            delete this._manager._meshes[this._name];
            this._manager = null;
        }
        
        //modelo3d.debug("mesh %s is destroyed.", this._name);
    }; 

    // The vertex buffer and index buffer are shared with many meshes. 
    // Note that when buffer is destroyed, these shared meshes should be destroy explicitly. Otherwise, 
    // it will generate rendering errors.
    Mesh.prototype.createShared = function(primitive, attributes, vertices, indices, type, vertexBuffer, indexBuffer) {
        if (this.ready) {
            return;
        }
        
        this._primitive  = primitive;
        this._attributes = attributes;
    
        this.bytes = (vertices.byteLength + indices.byteLength);
        
        this._type = type || gl.UNSIGNED_SHORT;
        if (this._type === gl.UNSIGNED_BYTE) {
            this.length = indices.byteLength;
            this.indexSize = 1;
        } else if (this._type === gl.UNSIGNED_INT) {
            this.length = indices.byteLength / 4;
            this.indexSize = 4;
        } else {
            this.length = indices.byteLength / 2;
            this.indexSize = 2;
        }

        this._vbo = vertexBuffer.buffer;
        this._ibo = indexBuffer.buffer;

        if ((gl.isWebGL2 || gl.vaoExtension)) {
            this._vao = gl.createVertexArray();
            gl.bindVertexArray(this._vao);
            this._attributes.bind(this._vbo);
            gl.bindVertexArray(null);
        }
        
        this._shared = true;

        this._iboBase = indices.byteOffset;
        this._vboBase = vertices.byteOffset;

        this.ready = (vertexBuffer.ready && indexBuffer.ready);
    };
    
    Mesh.prototype.create = function(primitive, attributes, vertices, indices, type) {
        if (this.ready) {
            return;
        }
        
        this._vbo = gl.createBuffer();
        this._ibo = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        this._primitive  = primitive;
        this._attributes = attributes;
    
        if ((gl.isWebGL2 || gl.vaoExtension)) {
            this._vao = gl.createVertexArray();
            gl.bindVertexArray(this._vao);
            this._attributes.bind(this._vbo);
            gl.bindVertexArray(null);
        }

        this.bytes = (vertices.byteLength + indices.byteLength);
        
        this._type = type || gl.UNSIGNED_SHORT;
        if (this._type === gl.UNSIGNED_BYTE) {
            this.length = indices.byteLength;
            this.indexSize = 1;
        } else if (this._type === gl.UNSIGNED_INT) {
            this.length = indices.byteLength / 4;
            this.indexSize = 4;
        } else {
            this.length = indices.byteLength / 2;
            this.indexSize = 2;
        }

        if (gl.getError() === gl.NO_ERROR) {
            this.ready = true;
        
            //modelo3d.debug("mesh %s is created.", this._name);
        } else {
            // It is very likely out of memory.
            // Clean at the exist.
            gl.deleteBuffer(this._vbo);
            gl.deleteBuffer(this._ibo);
            if (this._vao) {
                gl.deleteVertexArray(this._vao);
            }
        }
    };
    
    Mesh.prototype.createWiredCube = function() {
        if (this.ready) {
            return;
        }
        
        var g = new GeometricShape();
        g.createWiredCube();

        this.create(g.primitive, g.attributes, g.vertices, g.indices, g.indexType);
    }; 

    Mesh.prototype.createArrow = function(g, radius, height) {
        if (this.ready) {
            return;
        }
        if (!g) {
            var g = new GeometricShape();
            g.createArrow(radius, height);
        }
        this.create(g.primitive, g.attributes, g.vertices, g.indices, g.indexType);
    }; 

    Mesh.prototype.createSolidCube = function() {
        if (this.ready) {
            return;
        }

        var g = new GeometricShape();
        g.createSolidCube();
        this.create(g.primitive, g.attributes, g.vertices, g.indices, g.indexType);
    };

    Mesh.prototype.createQuad = function() {
        if (this.ready) {
            return;
        }

        var g = new GeometricShape();
        g.createQuad();
        this.create(g.primitive, g.attributes, g.vertices, g.indices, g.indexType);
    }; 

    Mesh.prototype.createSolidQuad = function() {
        if (this.ready) {
            return;
        }

        var g = new GeometricShape();
        g.createSolidQuad();
        this.create(g.primitive, g.attributes, g.vertices, g.indices, g.indexType);
    }; 
    
    Mesh.prototype.createPoint = function() {
        if (this.ready) {
            return;
        }

        var g = new GeometricShape();
        g.createPoint();
        this.create(g.primitive, g.attributes, g.vertices, g.indices, g.indexType);
    }; 
    
    // ring number is the number of slices in y direction.
    // segmentNumber is the number of slices in longitude direction.
    Mesh.prototype.createSphere = function(ringNumber, segmentNumber) {
        if (this.ready) {
            return;
        }

        var g = new GeometricShape();
        g.createSphere(ringNumber, segmentNumber);
        this.create(g.primitive, g.attributes, g.vertices, g.indices, g.indexType);
    };

    Mesh.prototype.createLine = function() {
        if (this.ready) {
            return;
        }

        var g = new GeometricShape();
        g.createLine();
        this.create(g.primitive, g.attributes, g.vertices, g.indices, g.indexType);
    }; 

    Mesh.prototype.createTorus = function(majorRadius, minorRadius, majorSegments, minorSegments) {
        if (this.ready) {
            return;
        }

        var g = new GeometricShape();
        g.createTorus(majorRadius, minorRadius, majorSegments, minorSegments);
        this.create(g.primitive, g.attributes, g.vertices, g.indices, g.indexType);
    };

    Mesh.prototype.render = function() {
        gl.drawElements(this._primitive, this.length, this._type, this._iboBase);
    };
    
    Mesh.prototype.renderSub = function(offset, count) {
        gl.drawElements(this._primitive, count, this._type, offset + this._iboBase);
    };

    Mesh.prototype.renderInstanced = function(instanceCount) {
        gl.drawElementsInstanced(this._primitive, this.length, this._type, this._iboBase, instanceCount);
    };

    Mesh.prototype.use = function() {
        if (!this.ready) {
            console.error("mesh " + this._name + " is not ready.");
            return ;
        }

        if (this._vao) {
            gl.bindVertexArray(this._vao);
        } else {
            this._attributes.bind(this._vbo);
        }
            
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
    };

    // FIXME: check if the parameter type is needed?
    Mesh.prototype.update = function(vertices, indices, type) {
        // We assume the attributes don't change.

        if (this.ready) {
            gl.deleteBuffer(this._vbo);
            gl.deleteBuffer(this._ibo);
            if (this._vao) {
                gl.deleteVertexArray(this._vao);
            }
            
            this._vbo = gl.createBuffer();
            this._ibo = gl.createBuffer();
            this._vboBase = 0;
            this._iboBase = 0;
            
            gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

            if ((gl.isWebGL2 || gl.vaoExtension)) {
                this._vao = gl.createVertexArray();
                gl.bindVertexArray(this._vao);
                this._attributes.bind(this._vbo);
                gl.bindVertexArray(null);
            }
            if (gl.getError() !== gl.NO_ERROR) {
                this.ready = false;
            } 
            
            this._type = type || gl.UNSIGNED_SHORT;

            if (this._type === gl.UNSIGNED_BYTE) {
                this.length = indices.byteLength;
            } else if (this._type === gl.UNSIGNED_SHORT) {
                this.length = indices.byteLength / 2;
            } else if (this._type === gl.UNSIGNED_INT) {
                this.length = indices.byteLength / 4;
            } 
        
            this.bytes = (vertices.byteLength + indices.byteLength);
        }
    }; 

    Mesh.prototype.isTriangle = function() {
        return this._primitive >= gl.TRIANGLES;
    };
    
    Mesh.prototype.isLine = function() {
        return this._primitive === gl.LINES || 
               this._primitive === gl.LINE_LOOP || 
               this._primitive == gl.LINE_STRIP;
    };
    
    Mesh.prototype.hasColor = function() {
        return this._attributes.hasColor;
    };

    // Create another mesh from this one with specified regions. Each region has 
    // the index count, index offset, vertex offset and vertex count, . 
    // region = { indicesBytes, indicesOffset, verticesBytes, verticesOffset};
    Mesh.prototype.slice = function(regions) {
        if (!gl.isWebGL2) {
            console.error("createSubMesh is only supported in WebGL2");
            return this;
        }
        // Calculate the size of the new mesh. 
        var newVerticesBytes = 0;
        var newIndicesBytes = 0;
        for (var i = 0, len = regions.length; i < len; i++) {
            newVerticesBytes += regions[i].verticesBytes;
            newIndicesBytes += regions[i].indicesBytes;
        }

        var newMesh = this._manager.getMesh((parseFloat(this._name) + Math.random()).toString());
        newMesh._vbo = gl.createBuffer();
        newMesh._ibo = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, newMesh._vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(newVerticesBytes), gl.STATIC_DRAW);

        var offset = 0;
        gl.bindBuffer(gl.COPY_READ_BUFFER, this._vbo);
        for (var i = 0, len = regions.length; i < len; i++) {
            gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.ARRAY_BUFFER, this._vboBase + regions[i].verticesOffset,
                    offset, regions[i].verticesBytes);

            offset += regions[i].verticesBytes;
        }

        var indicesBuffer = null;
        var newIndicesBuffer = null;
        switch (this.indexSize) {
            case 2:
                indicesBuffer = new Uint16Array(this.length);
                newIndicesBuffer = new Uint16Array(newIndicesBytes / 2);
                break;
            case 1:
                indicesBuffer = new Uint8Array(this.length);
                newIndicesBuffer = new Uint8Array(newIndicesBytes);
                break;
            case 4:
                indicesBuffer = new Uint32Array(this.length);
                newIndicesBuffer = new Uint32Array(newIndicesBytes / 4);
                break;
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
        gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER, this._iboBase, indicesBuffer);
        
        var dstIndexOffset = 0;
        var dstVertexOffset = 0;
        for (var i = 0, len = regions.length; i < len; i++) {
            var srcVertexOffset = regions[i].verticesOffset / this._attributes.values[0].stride;
            var indexCount = regions[i].indicesBytes / this.indexSize;
            var srcIndexOffset = regions[i].indicesOffset / this.indexSize;
            for (var j = 0; j < indexCount; j++) {
                newIndicesBuffer[j + dstIndexOffset] = indicesBuffer[j + srcIndexOffset] - srcVertexOffset + dstVertexOffset;
            }
            dstIndexOffset += indexCount;
            dstVertexOffset += regions[i].verticesBytes / this._attributes.values[0].stride;
        }
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, newMesh._ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, newIndicesBuffer, gl.STATIC_DRAW);

        newMesh._primitive  = this._primitive;
        newMesh._attributes = this._attributes;
    
        if (gl.isWebGL2 || gl.vaoExtension) {
            newMesh._vao = gl.createVertexArray();
            gl.bindVertexArray(newMesh._vao);
            newMesh._attributes.bind(newMesh._vbo);
            gl.bindVertexArray(null);
        }

        newMesh.bytes = (newIndicesBytes + newVerticesBytes);
        
        newMesh._type = this._type;
        newMesh.indexSize = this.indexSize;
        newMesh.length = newIndicesBytes / newMesh.indexSize;

        if (gl.getError() === gl.NO_ERROR) {
            newMesh.ready = true;
        
            //modelo3d.debug("mesh %s is created.", this._name);
        } else {
            // It is very likely out of memory.
            // Clean at the exist.
            gl.deleteBuffer(newMesh._vbo);
            gl.deleteBuffer(newMesh._ibo);
            if (newMesh._vao) {
                gl.deleteVertexArray(newMesh._vao);
            }
        }

        return newMesh;
    };
    
    // Replace the subdata of IBO
    Mesh.prototype.ibSubData = function(offset, bufferData) {
        this.ready = false;

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
        gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, this._iboBase+offset, bufferData);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        
        if (gl.getError() === gl.NO_ERROR) {
            this.ready = true;
        } else {
            gl.deleteBuffer(this._ibo);
            gl.deleteBuffer(this._vbo);

            if (this._vao) {
                gl.deleteVertexArray(this.vao);
                this._vao = false;
                delete this._vao;
            }
        }
            
    };

    // Replace the subdata of VBO
    Mesh.prototype.vbSubData = function(offset, bufferData) {
        this.ready = false;

        gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
        gl.bufferSubData(gl.ARRAY_BUFFER, this._vboBase + offset, bufferData);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        
        if (gl.getError() === gl.NO_ERROR) {
            this.ready = true;
        } else {
            gl.deleteBuffer(this._ibo);
            gl.deleteBuffer(this._vbo);

            if (this._vao) {
                gl.deleteVertexArray(this.vao);
                this._vao = false;
                delete this._vao;
            }
        }
    };

    // Download nbytes of VBO from offset and write the chunk of data to buffer starting at bufferOffset
    Mesh.prototype.getVBSubData = function(offset, buffer) {
        // FIXME: only support in WebGL 2
        gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
        gl.getBufferSubData(gl.ARRAY_BUFFER, this._vboBase + offset, buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        // FIXME: handle GL error, e.g., read out of range.
    };
    
    Mesh.prototype.getIBSubData = function(offset, buffer) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
        gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER, this._iboBase+offset, buffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    };

    
    return Mesh;
})();
    
