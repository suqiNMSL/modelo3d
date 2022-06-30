//
// m3d_load_mesh_sync.js
// Merge meshes into large one to reduce drawcall
//
//  
//

export default (function() {
    "use strict";
    
    function NodeInfo() {
        this.name           = null;
        this.layer          = null;
        this.views          = null;
        this.meshBinaryName = "";
        this.mesh           = null;
        this.material       = null;
        this.verticesOffset = 0;
        this.indicesOffset  = 0;
        this.verticesBytes  = 0;
        this.indicesBytes   = 0;
        this.billboard      = false;
        this.transform      = null;
        this.bbox           = null;
        this.indexType      = 2;
        this.attribute      = "";
        this.meshBinary     = null;
        this.nodes          = [];
        this.drawOffset     = 0;
        this.drawCount      = 0;
        this.valid          = true; // If this nodes is valid one.
        this.cost           = 0; // When this node is a merge result of serveral other nodes, 
                                 // what's the memory cost versus reduce draw call number.
        this.memoryCost     = 0; // The extra memory cost in bytes if merge.
    };
    
    function LoadMeshSync(sceneData, attributesData, maxVertexNumber, memoryBudget, caller) {
        this._nodesInfo       = {};
        this._attributesData  = attributesData;
        this._sceneData       = sceneData;
        this._maxVertexNumber = maxVertexNumber;
        this._memoryBudget    = memoryBudget;
        this._caller          = caller;
        this._retMeshBinary   = null;
    };
    
    LoadMeshSync.prototype.initialize = function() {
        this._prepare();

        // Pre-allocate the memory for mesh expansion.
        var maxBytes = 0;
        for (var meshBinaryName in this._nodesInfo) {
            for (var i = 0, len = this._nodesInfo[meshBinaryName].length; i < len; i++) {
                var nodeInfo = this._nodesInfo[meshBinaryName][i];
                if (nodeInfo.valid) {
                    var bytes = nodeInfo.verticesBytes + nodeInfo.indicesBytes;
                    if (maxBytes < bytes) {
                        maxBytes = bytes;
                    }
                }
            }
        } 
        this._retMeshBinary = new ArrayBuffer(maxBytes);
    };

    LoadMeshSync.prototype.uninitialize = function() {
        delete this._nodesInfo;
        delete this._attributesData;
        delete this._sceneData;
        delete this._caller;
        delete this._retMeshBinary;
    };

    LoadMeshSync.prototype._hasTranslucentTexture = function(nodeData) {
        var materialData = this._sceneData.materials[nodeData.material];
        if (materialData.values.diffuseTexture) {
            var textureData = this._sceneData.textures[materialData.values.diffuseTexture];
            return textureData.format === "rgba";
        }
        return false;
    }; 


    // Combine nodes together if they use the same material
    LoadMeshSync.prototype._groupNodesByMaterial = function(nodesInfo) {
        if (nodesInfo.length <= 1) {
            return ;
        }

        nodesInfo.sort(function(a, b) {
            var ret = 0;

            if (a.billboard !== b.billboard) {
                if (a.billboard) return -1;
                if (b.billboard) return 1;
            }

            ret = a.material.localeCompare(b.material);
            if (ret !== 0) {
                return ret;
            }

            ret = a.layer.localeCompare(b.layer);
            if (ret !== 0) {
                return ret;
            }

            ret = a.attribute.localeCompare(b.attribute);
            if (ret !== 0) {
                return ret;
            }

            var views1 = a.views.join('');
            var views2 = b.views.join('');
            return views1.localeCompare(views2);
        });

        var currentMaterial   = nodesInfo[0].material;
        var currentLayer      = nodesInfo[0].layer;
        var currentAttribute  = nodesInfo[0].attribute;
        var currentViews      = nodesInfo[0].views.join('');

        var nodesGroup = [];
        nodesGroup.push(nodesInfo[0]);
        var i, k, len;
        for (i = 1, len = nodesInfo.length; i < len; ++i) {
            var views = nodesInfo[i].views.join('');

            if (nodesInfo[i].billboard                       ||
                nodesInfo[i].indexType > 2                   ||
                nodesInfo[i].material !== currentMaterial    ||
                nodesInfo[i].layer !== currentLayer          ||
                nodesInfo[i].attribute !== currentAttribute  ||
                views !== currentViews                       ||
                this._hasTranslucentTexture(nodesInfo[i])     ||
                false) {

                if (nodesGroup.length > 1) {
                    // Group nodes to to-be-merged groups
                    var k = 0;
                    var maxBytes = this._attributesData[nodesGroup[0].attribute].values[0].stride * this._maxVertexNumber;
                    for (var j = 1, len1 = nodesGroup.length; j < len1; ++j) {
                        if (nodesGroup[k].verticesBytes + nodesGroup[j].verticesBytes > maxBytes) {
                            k = j;
                        } else {
                            nodesGroup[k].nodes.push(nodesGroup[j]);
                            nodesGroup[k].verticesBytes += nodesGroup[j].verticesBytes;
                            nodesGroup[j].valid = false;
                        }
                    }
                }

                nodesGroup = [];

                currentMaterial  = nodesInfo[i].material;
                currentLayer     = nodesInfo[i].layer;
                currentViews     = views;
                currentAttribute = nodesInfo[i].attribute;
            } 
            
            nodesGroup.push(nodesInfo[i]);
        }
                
        if (nodesGroup.length > 1) {
            var k = 0;
            var maxBytes = this._attributesData[nodesGroup[0].attribute].values[0].stride * this._maxVertexNumber;
            for (var j = 1, len1 = nodesGroup.length; j < len1; ++j) {
                if (nodesGroup[k].verticesBytes + nodesGroup[j].verticesBytes > maxBytes) {
                    k = j;
                } else {
                    nodesGroup[k].nodes.push(nodesGroup[j]);
                    nodesGroup[k].verticesBytes += nodesGroup[j].verticesBytes;
                    nodesGroup[j].valid = false;
                }
            }
        }
    };
    
    // Compute the extra memory it consumes if we merge nodes.
    LoadMeshSync.prototype._updateMergeNodeInfo = function(nodeInfo) {

        var nodesInfo = nodeInfo.nodes;
        var meshesData = this._sceneData.meshes[nodeInfo.meshBinaryName];
        var attributeData = this._attributesData[nodeInfo.attribute];
        var stride = attributeData.values[0].stride;
        
        var vertexNumber = 0;
        var indexNumber = 0;

        // Check how many meshes will be expanded?
        var meshes = {};
        var numVertices = 0;
        for (var i = 0, len = nodesInfo.length; i < len; ++i) {
            var mesh = nodesInfo[i].mesh;
            if (!meshes.hasOwnProperty(mesh)) {
                meshes[mesh] = 0;
            }
            meshes[mesh]++;

            var meshData = meshesData[mesh];
            vertexNumber += meshData.vertices.byteLength / stride;
            indexNumber += meshData.indices.byteLength / meshData.indices.type;
        }
        if (!meshes.hasOwnProperty(nodeInfo.mesh)) {
            meshes[nodeInfo.mesh] = 1;
        } else {
            meshes[nodeInfo.mesh]++;
        }
        var meshData = meshesData[nodeInfo.mesh];
        vertexNumber += meshData.vertices.byteLength / stride;
        indexNumber += meshData.indices.byteLength / meshData.indices.type;

        // Update index type.
        var indexType = 1;
        if (vertexNumber > 65536) {
            indexType = 4;
        } else if (vertexNumber > 256) {
            indexType = 2;
        } 


        var bytes = 0;
        var numReducedDrawcalls = -1;
        for (var mesh in meshes) {
            var n = meshes[mesh] - 1; // The first one will reuse the current mesh memory space.
            if (n > 0) {
                var meshData = meshesData[mesh];
                var scale = indexType / meshData.indices.type; 
                bytes += n * (meshData.vertices.byteLength + meshData.indices.byteLength * scale); 
            }
                
            numReducedDrawcalls += meshes[mesh];
        }

        nodeInfo.verticesBytes = vertexNumber * stride;
        nodeInfo.indicesBytes = indexNumber * indexType;
        nodeInfo.indexType = indexType;
        nodeInfo.memoryCost = bytes;
        nodeInfo.cost = bytes / numReducedDrawcalls;
    };


    LoadMeshSync.prototype._updateNodesInfo = function() {
        var mergeNodes = [];

        for (var meshBinaryName in this._nodesInfo) {
            var nodes = this._nodesInfo[meshBinaryName];
            for (var i = 0, len = nodes.length; i < len; ++i) {
                if (nodes[i].nodes.length > 0) {
                    this._updateMergeNodeInfo(nodes[i]);
                    mergeNodes.push(nodes[i]);
                }
            }
        }

        // Sort the nodes with merge costs, i.e., place the node with large merge costs
        // at last.
        mergeNodes.sort(function(a, b) {
            return a.cost - b.cost;
        });

        // Search which nodes can be merged with given budget. Here we just use greedy algorithm
        // which might not be optimum.
        var budget = this._memoryBudget;
        for (var i = 0, len = mergeNodes.length; i < len; i++) {
            budget -= mergeNodes[i].memoryCost;
            if (budget < 0) {
                break;
            }

            mergeNodes[i].verticesOffset = 0;
            mergeNodes[i].indicesOffset = mergeNodes[i].verticesBytes;
        }

        modelo3d.debug("used budget: " + (this._memoryBudget - budget));
                
        // Restore nodes that won't be merged back to their original state.
        for (var j = i; j < len; j++) {
            var nodeInfo = mergeNodes[j];
            for (var k = 0, len2 = nodeInfo.nodes.length; k < len2; k++) {
                nodeInfo.nodes[k].valid = true;
            } 
                    
            // Recover the vertices and indices information.
            var meshData = this._sceneData.meshes[nodeInfo.meshBinaryName][nodeInfo.mesh];

            nodeInfo.verticesOffset = meshData.vertices.byteOffset;
            nodeInfo.verticesBytes = meshData.vertices.byteLength;
            nodeInfo.indicesOffset = meshData.indices.byteOffset;
            nodeInfo.indicesBytes = meshData.indices.byteLength;
            nodeInfo.indexType = meshData.indices.type;

            nodeInfo.nodes = [];
        }
    };

    // Initialize the worker thread per every mesh.bin
    LoadMeshSync.prototype._prepare = function() {
        var nodesLayers = {};
        var i, len;
        for (var layer in this._sceneData.layers) {
            var layerData = this._sceneData.layers[layer];
            for (i = 0, len = layerData.nodes.length; i < len; ++i) {
                var nodeName = layerData.nodes[i];
                nodesLayers[nodeName] = layer;
            }
        }
        
        for (var meshBinaryName in this._sceneData.meshes) {
            this._nodesInfo[meshBinaryName] = [];
        }

        var node;

        for (node in this._sceneData.scene.nodes) {
            var nodeData = this._sceneData.scene.nodes[node];

            var nodeInfo = new NodeInfo();
            nodeInfo.name      = node;
            nodeInfo.layer     = nodesLayers[nodeInfo.name];
            nodeInfo.mesh      = nodeData.mesh;
            nodeInfo.material  = nodeData.material;
            nodeInfo.billboard = false;
            nodeInfo.transform = nodeData.transform;
            nodeInfo.bbox      = nodeData.bbox;
            nodeInfo.views     = nodeData.views? nodeData.views.sort() : [];
        
            for (var meshBinaryName in this._sceneData.meshes) {
                var meshesData = this._sceneData.meshes[meshBinaryName];
                if (meshesData.hasOwnProperty(nodeData.mesh)) {
                    var meshData = meshesData[nodeData.mesh];
                    nodeInfo.meshBinaryName = meshBinaryName;
                    nodeInfo.attribute = meshData.attribute;
                    nodeInfo.verticesOffset = meshData.vertices.byteOffset;
                    nodeInfo.verticesBytes = meshData.vertices.byteLength;
                    nodeInfo.indicesOffset = meshData.indices.byteOffset;
                    nodeInfo.indicesBytes = meshData.indices.byteLength;
                    nodeInfo.indexType = meshData.indices.type;

                    this._nodesInfo[meshBinaryName].push(nodeInfo);

                    break;
                }
            }
        }

        for (node in this._sceneData.scene.billboards) {
            var nodeData = this._sceneData.scene.billboards[node];

            var nodeInfo = new NodeInfo();
            nodeInfo.name      = node;
            nodeInfo.layer     = nodesLayers[nodeInfo.name];
            nodeInfo.mesh      = nodeData.mesh;
            nodeInfo.material  = nodeData.material;
            nodeInfo.billboard = true;
            nodeInfo.transform = nodeData.transform;
            nodeInfo.bbox      = nodeData.bbox;
            nodeInfo.views     = nodeData.views? nodeData.views.sort() : [];

            for (var meshBinaryName in this._sceneData.meshes) {
                var meshesData = this._sceneData.meshes[meshBinaryName];
                if (meshesData.hasOwnProperty(nodeData.mesh)) {
                    var meshData = meshesData[nodeData.mesh];
                    nodeInfo.meshBinaryName = meshBinaryName;
                    nodeInfo.attribute = meshData.attribute;
                    nodeInfo.verticesOffset = meshData.vertices.byteOffset;
                    nodeInfo.verticesBytes = meshData.vertices.byteLength;
                    nodeInfo.indicesOffset = meshData.indices.byteOffset;
                    nodeInfo.indicesBytes = meshData.indices.byteLength;
                    nodeInfo.indexType = meshData.indices.type;

                    this._nodesInfo[meshBinaryName].push(nodeInfo);

                    break;
                }
            }
        }

        for (var meshBinaryName in this._nodesInfo) {
            this._groupNodesByMaterial(this._nodesInfo[meshBinaryName]);
        }
        // TODO: 
        // group by other metrics

        //// Update the nodes information, e.g, vertices, for merging.
        this._updateNodesInfo(this._nodesInfo);
    };
    
    LoadMeshSync.prototype.load = function(meshBinaryName, meshBinary) {
        var nodesInfo = this._nodesInfo[meshBinaryName];
        var meshesData = this._sceneData.meshes[meshBinaryName];
        for (var i = 0, len = nodesInfo.length; i < len; ++i) {
            var nodeInfo = nodesInfo[i];
            if (nodeInfo.valid) {
                if (nodeInfo.nodes.length !== 0) {
                    this._populateMergedNode(nodeInfo, meshesData, meshBinary);
                } else {
                    nodeInfo.meshBinary = meshBinary;
                    nodeInfo.transform = nodeInfo.transform? ExtendTransform(nodeInfo.transform) : null;
                    nodeInfo.drawOffset = 0;
                    nodeInfo.drawCount = nodeInfo.indicesBytes / nodeInfo.indexType;
                }

                this._caller.onNodeDataReady(nodeInfo);
            }
        }

        this._caller.onMeshBinaryProcessed();
    };
    
    var translate    = new Float32Array([0, 0, 0]);
    var scale        = new Float32Array([0, 0, 0]);
    var tempVector31 = new Float32Array(3); // temporary variable
    var tempVector32 = new Float32Array(3); // ditto
    
    function ExtendTransform(transform) {
        var ret = new Float32Array(16);

        ret[0] = transform[0];
        ret[1] = transform[1];
        ret[2] = transform[2];
        ret[3] = 0;

        ret[4] = transform[3];
        ret[5] = transform[4];
        ret[6] = transform[5];
        ret[7] = 0;

        ret[8] = transform[6];
        ret[9] = transform[7];
        ret[10] = transform[8];
        ret[11] = 0;

        ret[12] = transform[9];
        ret[13] = transform[10];
        ret[14] = transform[11];
        ret[15] = 1;

        return ret;
    };
    
    function IsTranslationMatrix(mat) {
        return Math.abs(mat[0] - 1.0) < 1e-6 &&
               Math.abs(mat[1]) < 1e-6 &&
               Math.abs(mat[2]) < 1e-6 &&
               Math.abs(mat[3]) < 1e-6 &&
               Math.abs(mat[4] - 1.0) < 1e-6 &&
               Math.abs(mat[5]) < 1e-6 &&
               Math.abs(mat[6]) < 1e-6 &&
               Math.abs(mat[7]) < 1e-6 &&
               Math.abs(mat[8] - 1.0) < 1e-6;
    };

    function IsTranslationScalingMatrix(mat) {
        return Math.abs(mat[1]) < 1e-6 &&
               Math.abs(mat[2]) < 1e-6 &&
               Math.abs(mat[3]) < 1e-6 &&
               Math.abs(mat[5]) < 1e-6 &&
               Math.abs(mat[6]) < 1e-6 &&
               Math.abs(mat[7]) < 1e-6;
    };

    
    // out = box | out
    function UnionBBox(out, bbox) {
        out[0] = Math.min(out[0], bbox[0]);
        out[1] = Math.min(out[1], bbox[1]);
        out[2] = Math.min(out[2], bbox[2]);
        out[3] = Math.max(out[3], bbox[3]);
        out[4] = Math.max(out[4], bbox[4]);
        out[5] = Math.max(out[5], bbox[5]);
    };
    
    function TransformUncompressVertices1(vertices, encodedVertices, attributeData, translate) {
        var vertexNumber = ((vertices.byteLength / attributeData.values[0].stride) | 0);
        var numFloats = (((attributeData.values[0].stride | 0) >> 2) | 0);
        var totalNumFloats = (((numFloats | 0) * (vertexNumber | 0)) | 0);

        var i;
        if (attributeData.primitive === 4) {
            for (i = 0; i < totalNumFloats; i += numFloats) {
                // position
                vertices[i]     = encodedVertices[i] + translate[0];
                vertices[i + 1] = encodedVertices[i + 1] + translate[1];
                vertices[i + 2] = encodedVertices[i + 2] + translate[2];
                // normal
                vertices[i + 3] = encodedVertices[i + 3];
            } 

            if (attributeData.values.length > 2) {
                if (attributeData.values[2].index === 2) { // texcoord 
                    for (i = 4; i < totalNumFloats; i += numFloats) {
                        vertices[i]     = encodedVertices[i];
                        vertices[i + 1] = encodedVertices[i + 1];
                    }
                } else { // vertex color
                    for (i = 4; i < totalNumFloats; i += numFloats) {
                        vertices[i] = encodedVertices[i];
                    }
                }
            }
        } else {
            for (i = 0; i < totalNumFloats; i += 3) {
                vertices[i]     = encodedVertices[i] + translate[0];
                vertices[i + 1] = encodedVertices[i + 1] + translate[1];
                vertices[i + 2] = encodedVertices[i + 2] + translate[2];
            }
        }
    };

    function TransformUncompressVertices2(vertices, encodedVertices, attributeData, scale, translate) {
        var vertexNumber = ((vertices.byteLength / attributeData.values[0].stride) | 0);
        var numFloats = (((attributeData.values[0].stride | 0) >> 2) | 0);
        var totalNumFloats = (((numFloats | 0) * (vertexNumber | 0)) | 0);

        var i;
        if (attributeData.primitive === 4) {
            // If it is a uniform scaling
            // FIXME: if the scaling is negative.
            if (scale[0] === scale[1] && scale[1] === scale[2]) {
                for (i = 0; i < totalNumFloats; i += numFloats) {
                    // position
                    vertices[i]     = encodedVertices[i] * scale[0] + translate[0];
                    vertices[i + 1] = encodedVertices[i + 1] * scale[1] + translate[1];
                    vertices[i + 2] = encodedVertices[i + 2] * scale[2] + translate[2];

                    // normal
                    vertices[i + 3] = encodedVertices[i + 3];
                } 
            } else {
                var n = tempVector31;
                var invScale = tempVector32;

                invScale[0] = 1.0 / scale[0];
                invScale[1] = 1.0 / scale[1];
                invScale[2] = 1.0 / scale[2];
            
                var encodedNormals = new Int8Array(encodedVertices.buffer, encodedVertices.byteOffset + 12, totalNumFloats * 4 - 12);
                var normals        = new Int8Array(vertices.buffer, vertices.byteOffset + 12, totalNumFloats * 4 - 12);

                for (i = 0; i < totalNumFloats; i += numFloats) {
                    // position
                    vertices[i]     = encodedVertices[i] * scale[0] + translate[0];
                    vertices[i + 1] = encodedVertices[i + 1] * scale[1] + translate[1];
                    vertices[i + 2] = encodedVertices[i + 2] * scale[2] + translate[2];

                    // normal
                    var index = (i << 2);
                    var normal0 = encodedNormals[index];
                    var normal1 = encodedNormals[index + 1];
                    var normal2 = encodedNormals[index + 2];

                    n[0] = normal0 * invScale[0];
                    n[1] = normal1 * invScale[1];
                    n[2] = normal2 * invScale[2];

                    var inv = 127.0 / Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
                    
                    normals[index]     = n[0] * inv;
                    normals[index + 1] = n[1] * inv;
                    normals[index + 2] = n[2] * inv;
                }
            }
            
            if (attributeData.values.length > 2) {
                if (attributeData.values[2].index === 2) { // texcoord 
                    for (i = 4; i < totalNumFloats; i += numFloats) {
                        vertices[i]     = encodedVertices[i];
                        vertices[i + 1] = encodedVertices[i + 1];
                    }
                } else { // vertex color
                    for (i = 4; i < totalNumFloats; i += numFloats) {
                        vertices[i] = encodedVertices[i];
                    }
                }
            }
        } else {
            for (i = 0; i < totalNumFloats; i += 3) {
                // position
                vertices[i]     = encodedVertices[i] * scale[0] + translate[0];
                vertices[i + 1] = encodedVertices[i + 1] * scale[1] + translate[1];
                vertices[i + 2] = encodedVertices[i + 2] * scale[2] + translate[2];
            }
        }
    };
    
    function TransformUncompressVertices3(vertices, encodedVertices, attributeData, transform) {

        var vertexNumber = ((vertices.byteLength / attributeData.values[0].stride) | 0);
        var numFloats = (((attributeData.values[0].stride | 0) >> 2) | 0);
        var totalNumFloats = (((numFloats | 0) * (vertexNumber | 0)) | 0);

        var m0 = transform[0];
        var m1 = transform[1];
        var m2 = transform[2];
        
        var m4 = transform[3];
        var m5 = transform[4];
        var m6 = transform[5];
        
        var m8 = transform[6];
        var m9 = transform[7];
        var m10 = transform[8];
        
        var m12 = transform[9];
        var m13 = transform[10];
        var m14 = transform[11];
        
        var i;

        if (attributeData.primitive === 4) {

            var n = tempVector31;
                
            var encodedNormals = new Int8Array(encodedVertices.buffer, encodedVertices.byteOffset + 12, totalNumFloats * 4 - 12);
            var normals        = new Int8Array(vertices.buffer, vertices.byteOffset + 12, totalNumFloats * 4 - 12);

            for (i = 0; i < totalNumFloats; i += numFloats) {
                // position
                var x = encodedVertices[i];
                var y = encodedVertices[i + 1];
                var z = encodedVertices[i + 2];

                var nx = m0 * x + m4 * y + m8 * z + m12;
                var ny = m1 * x + m5 * y + m9 * z + m13;
                var nz = m2 * x + m6 * y + m10 * z + m14;

                vertices[i]     = nx;
                vertices[i + 1] = ny;
                vertices[i + 2] = nz;

                // normal
                var index = (i << 2);
                var normal0 = encodedNormals[index];
                var normal1 = encodedNormals[index + 1];
                var normal2 = encodedNormals[index + 2];

                n[0] = m0 * normal0 + m4 * normal1 + m8 * normal2;
                n[1] = m1 * normal0 + m5 * normal1 + m9 * normal2;
                n[2] = m2 * normal0 + m6 * normal1 + m10 * normal2;

                var inv = 127.0 / Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
                
                normals[index]     = n[0] * inv;
                normals[index + 1] = n[1] * inv;
                normals[index + 2] = n[2] * inv;
            } 

            if (attributeData.values.length > 2) {
                if (attributeData.values[2].index === 2) { // texcoord 
                    for (i = 4; i < totalNumFloats; i += numFloats) {
                        vertices[i]     = encodedVertices[i];
                        vertices[i + 1] = encodedVertices[i + 1];
                    }
                } else { // vertex color
                    for (i = 4; i < totalNumFloats; i += numFloats) {
                        vertices[i] = encodedVertices[i];
                    }
                }
            }
        } else {
            for (i = 0; i < totalNumFloats; i += 3) {
                // position
                var x = encodedVertices[i];
                var y = encodedVertices[i + 1];
                var z = encodedVertices[i + 2];

                var nx = m0 * x + m4 * y + m8 * z + m12;
                var ny = m1 * x + m5 * y + m9 * z + m13;
                var nz = m2 * x + m6 * y + m10 * z + m14;

                vertices[i]     = nx;
                vertices[i + 1] = ny;
                vertices[i + 2] = nz;
            }
        }
    };

    function UncompressIndices(indices, encodedIndices, numIndices, vertexIndexOffset) {
        for (var i = 0; i < numIndices; i++) {
            indices[i] = (encodedIndices[i] + (vertexIndexOffset | 0));
        }
    };
            
    function UncompressVertices(vertices, encodedVertices, attributeData) {
        var vertexNumber = ((vertices.byteLength / attributeData.values[0].stride) | 0);
        var numFloats = (((attributeData.values[0].stride | 0) >> 2) | 0);
        var totalNumFloats = (((numFloats | 0) * (vertexNumber | 0)) | 0);
        var i;
        
        if (attributeData.primitive === 4) {
            for (i = 0; i < totalNumFloats; i += numFloats) {
                // position
                vertices[i]     = encodedVertices[i];
                vertices[i + 1] = encodedVertices[i + 1];
                vertices[i + 2] = encodedVertices[i + 2]; 

                // normal
                vertices[i + 3] = encodedVertices[i + 3];
            }

            if (attributeData.values.length > 2) {
                if (attributeData.values[2].index === 2) { // texcoord 
                    for (i = 4; i < totalNumFloats; i += numFloats) {
                        vertices[i]     = encodedVertices[i];
                        vertices[i + 1] = encodedVertices[i + 1];
                    }
                } else { // vertex color
                    for (i = 4; i < totalNumFloats; i += numFloats) {
                        vertices[i] = encodedVertices[i];
                    }
                }
            }
        } else {
            for (i = 0; i < totalNumFloats; i += 3) {
                // position
                vertices[i]     = encodedVertices[i];
                vertices[i + 1] = encodedVertices[i + 1];
                vertices[i + 2] = encodedVertices[i + 2]; 
            }
        }
    };
    
    
    LoadMeshSync.prototype._populateMergedNode = function(nodeInfo, meshesData, meshBinary) {

        var attributeData = this._attributesData[nodeInfo.attribute];

        var retMeshBinary = this._retMeshBinary;
        nodeInfo.meshBinary = retMeshBinary;

        var vertexOffset = 0;
        var indexOffset  = nodeInfo.verticesBytes;

        var indexType = nodeInfo.indexType;

        for (var i = -1, len = nodeInfo.nodes.length; i < len; i++) {
            if (i < 0) {
                var nodeData = nodeInfo;
            } else {
                var nodeData = nodeInfo.nodes[i];
            }

            var meshData = meshesData[nodeData.mesh];

            var vertices = new Float32Array(retMeshBinary, vertexOffset, meshData.vertices.byteLength / 4);
            var encodedVertices = new Float32Array(meshBinary, meshData.vertices.byteOffset, meshData.vertices.byteLength / 4);

            if (nodeData.transform) {
                if (IsTranslationMatrix(nodeData.transform)) {
                    translate[0] = nodeData.transform[9];
                    translate[1] = nodeData.transform[10];
                    translate[2] = nodeData.transform[11];
                    TransformUncompressVertices1(vertices, encodedVertices, attributeData, translate);
                } else if (IsTranslationScalingMatrix(nodeData.transform)) {
                    translate[0] = nodeData.transform[9];
                    translate[1] = nodeData.transform[10];
                    translate[2] = nodeData.transform[11];
                    scale[0] = nodeData.transform[0];
                    scale[1] = nodeData.transform[4];
                    scale[2] = nodeData.transform[8];
                    TransformUncompressVertices2(vertices, encodedVertices, attributeData, scale, translate);
                } else {
                    TransformUncompressVertices3(vertices, encodedVertices, attributeData, nodeData.transform);
                }
            } else {
                UncompressVertices(vertices, encodedVertices, attributeData);
            }
                
            UnionBBox(nodeInfo.bbox, nodeData.bbox);
            
            var indices  = null;
            var encodedIndices  = null;
            
            var numIndices = 0;
            var encodedIndexType = meshData.indices.type; 
            switch (encodedIndexType) {
                case 4:
                    numIndices = meshData.indices.byteLength / 4;
                    encodedIndices = new Uint32Array(meshBinary, meshData.indices.byteOffset, numIndices);
                    break;
                case 2:
                    numIndices = meshData.indices.byteLength / 2;
                    encodedIndices = new Uint16Array(meshBinary, meshData.indices.byteOffset, numIndices);
                    break;
                default:
                    numIndices = meshData.indices.byteLength;
                    encodedIndices = new Uint8Array(meshBinary, meshData.indices.byteOffset, numIndices);
                    break;
            }
            switch (indexType) {
                case 4:
                    indices = new Uint32Array(retMeshBinary, indexOffset, numIndices);
                    break;
                case 2:
                    indices = new Uint16Array(retMeshBinary, indexOffset, numIndices);
                    break;
                default:
                    indices = new Uint8Array(retMeshBinary, indexOffset, numIndices);
                    break;
            }
            
            UncompressIndices(indices, encodedIndices, numIndices, vertexOffset / attributeData.values[0].stride);
            
            nodeData.drawOffset = indexOffset - nodeInfo.verticesBytes;
            nodeData.drawCount  = numIndices;

            vertexOffset += meshData.vertices.byteLength;
            indexOffset += numIndices * indexType;
        }

        // It is a new mesh.
        nodeInfo.mesh = nodeInfo.name + nodeInfo.mesh;
        // Remove the transform
        nodeInfo.transform = null;
    };
    
    return LoadMeshSync;
    
})();
    

