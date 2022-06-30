//
// m3d_load_mesh_sync_instanced.js
// Merge meshes one with same materials or instanced node to reduce drawcall
//
//  
//

import Globals        from "../../m3d_globals.js";

export default (function() {
    "use strict";
    
    function NodeInfo() {
        this.index          = 0;    // The index of this node in the entire scene.
        this.valid          = true; // If this nodes is valid one.
        this.nodes          = [];

        this.verticesOffset = 0;
        this.indicesOffset  = 0;
        this.verticesBytes  = 0;
        this.indicesBytes   = 0;
        this.indexType      = 2;
        this.attribute      = 0;

        this.drawOffset = 0; // Each node contains serveral nodes. These two
        this.drawCount  = 0; // variables record the start and length of node indices
                             // inside this node node.

        this.views          = "";
        this.layer          = 0;    
        this.material       = 0;
        this.mesh           = 0;
        this.billboard      = 1;
        this.identity       = 1;
        this.mergible       = 1;
        this.region         = 0;    

        // transform and bbox are in the binary.

        this.instanced      = false; // If this item is a transform
    };
    
    function LoadMeshSyncInstanced(sceneJson, sceneBin, attributesData, memoryBudget) {
        this._sceneJson       = sceneJson;
        this._sceneBin        = sceneBin;
        this._attributesData  = attributesData;
        this._maxVertexNumber = 65536; // we ensure the merge mesh still uses uint16 for index type.
        this._memoryBudget    = memoryBudget;

        this._retMeshBinary   = null;
        this._nodesInfo       = null;
    
        this._initialize();
    };
    
    LoadMeshSyncInstanced.prototype.destroy = function() {
        delete this._attributesData;
        delete this._sceneJson;
        delete this._sceneBin;
        delete this._caller;

        delete this._nodesInfo;
        delete this._retMeshBinary;
    };

    var SCALE = 16;

    var gridInfo = {
        size     : vec3.create(),
        cellSize : vec3.create(),
        segments : vec3.create(),
        center   : vec3.create()
    };

    LoadMeshSyncInstanced.prototype._initialize = function() {
        //
        // Create association between nodes->views and nodes->layers
        //
        var nodesViews = new Array(this._sceneJson.scene.nodes);
        for (var i = 0; i < this._sceneJson.scene.nodes; i++) {
            nodesViews[i] = "";
        }
        for (var i = 0, len = this._sceneJson.views.length; i < len; ++i) {
            var viewNodes = this._sceneBin.readViewNodes(i);
            if (viewNodes !== null) {
                for (var j = 0, len1 = viewNodes.length; j < len1; j++) {
                    var nodeIndex = viewNodes[j];
                    nodesViews[nodeIndex] += i.toString() + ".";
                }
            }
        }
        
        var nodesLayer = new Array(this._sceneJson.scene.nodes);
        for (var i = 0, len = this._sceneJson.layers.length; i < len; ++i) {
            var layerNodes = this._sceneBin.readLayerNodes(i);
            for (var j = 0, len1 = layerNodes.length; j < len1; j++) {
                var nodeIndex = layerNodes[j];
                nodesLayer[nodeIndex] = i; 
            }
        }

        //
        // Create node info for each node
        //
        this._nodesInfo = new Array(this._sceneJson.buffers);
        for (var i = 0, len = this._sceneJson.buffers.length; i < len; i++) {
            this._nodesInfo[i] = [];
        }

        for (var i = 0; i < this._sceneJson.scene.nodes; i++) {
            var nodeData = this._sceneBin.readNodeData(i);

            var nodeInfo = new NodeInfo();
            nodeInfo.index     = i;
            nodeInfo.views     = nodesViews[i].slice(0, -1); // remove trailing '.'

            nodeInfo.material  = (nodeData[0] & 0xffff);
            nodeInfo.layer     = nodesLayer[i];
            nodeInfo.mesh      = nodeData[1];
            nodeInfo.billboard = ((nodeData[2] >> 31) & 0x1);
            nodeInfo.identity  = ((nodeData[2] >> 30) & 0x1);
            nodeInfo.mergible  = ((nodeData[2] >> 29) & 0x1);
            nodeInfo.region    = ((nodeData[2] >> 25) & 0x0f); 
        
            var start = 0;
            var end = 0;
            for (var j = 0, len = this._sceneJson.buffers.length; j < len; j++) {
                start = end;
                end += this._sceneJson.buffers[j].meshes;

                if (nodeInfo.mesh >= start && nodeInfo.mesh < end) {
                    var meshData = this._sceneBin.readMesh(nodeInfo.mesh);

                    nodeInfo.attribute = (meshData[0] >> 16);
                    nodeInfo.indexType = (meshData[0] & 0xffff);
                    nodeInfo.verticesOffset = meshData[1];
                    nodeInfo.verticesBytes = meshData[2];
                    nodeInfo.indicesOffset = meshData[3];
                    nodeInfo.indicesBytes = meshData[4];

                    this._nodesInfo[j].push(nodeInfo);

                    break;
                }
            }
        }

        // Get the scene's bbox size, divide group nodes by distance if nodes are with same png textures.
        // The split size is based on the scene's size and just need to calculate once here.
        vec3.subtract(gridInfo.size, this._sceneJson.scene.max, this._sceneJson.scene.min);
        
        // Calculate how many parts for each axis
        gridInfo.segments[0] = Math.max(Math.ceil(gridInfo.size[0] / SCALE), 10); // We think a normal room/cell is 3x3 m
        gridInfo.segments[1] = Math.max(Math.ceil(gridInfo.size[1] / SCALE), 10);
        gridInfo.segments[2] = Math.max(Math.ceil(gridInfo.size[2] / SCALE), 10);
        
        // Get each part's width height and length
        vec3.divide(gridInfo.cellSize, gridInfo.size, gridInfo.segments);

        for (var i = 0, len = this._sceneJson.buffers.length; i < len; i++) {
            this._groupNodesByMaterial(this._nodesInfo[i]);
        }

        // Update the nodes information, e.g, vertices, for merging.
        this._updateNodesInfo(this._nodesInfo);
    };

    // Combine nodes together if they use the same material
    LoadMeshSyncInstanced.prototype._groupNodesByMaterial = function(nodesInfo) {
        if (nodesInfo.length <= 1) {
            return ;
        }

        nodesInfo.sort(function(a, b) {
            var ret = 0;

            ret = a.billboard - b.billboard;
            if (ret !== 0) {
                return ret;
            }

            ret = a.material - b.material;
            if (ret !== 0) {
                return ret;
            }

            ret = a.layer - b.layer;
            if (ret !== 0) {
                return ret;
            }

            ret = a.attribute - b.attribute;
            if (ret !== 0) {
                return ret;
            }

            return a.views.localeCompare(b.views);
        });

        var currentMaterial   = nodesInfo[0].material;
        var currentLayer      = nodesInfo[0].layer;
        var currentAttribute  = nodesInfo[0].attribute;
        var currentViews      = nodesInfo[0].views;

        var nodesGroup = [];
        nodesGroup.push(nodesInfo[0]);
        var i, k, len;
        for (i = 1, len = nodesInfo.length; i < len; ++i) {
            if (nodesInfo[i].billboard                       ||
                !nodesInfo[i].indexType > 2                  ||
                nodesInfo[i].material !== currentMaterial    ||
                nodesInfo[i].layer !== currentLayer          ||
                nodesInfo[i].attribute !== currentAttribute  ||
                nodesInfo[i].views !== currentViews          ||
                false) {

                this._splitnodesGroup(nodesGroup);
                
                nodesGroup = [];

                currentMaterial  = nodesInfo[i].material;
                currentLayer     = nodesInfo[i].layer;
                currentViews     = nodesInfo[i].views;
                currentAttribute = nodesInfo[i].attribute;
            } 
            
            nodesGroup.push(nodesInfo[i]);
        }

        this._splitnodesGroup(nodesGroup);
    };
        
    var MINIMUM_NODES_PERGROUP = 30;
    
    LoadMeshSyncInstanced.prototype._splitnodesGroup = function(nodesGroup) {
        
        if (nodesGroup.length > 1) {
            // If the node group is not mergible, which means there is transparent nodes, we should
            // consider merging it when it is large. However, it can't be all merged into one drawcall
            // for the rendering effect will be wrong. We ought to separate them by distance. It can cause 
            // minor rendering problems too but the speed can be much faster.
            if ((!nodesGroup[0].mergible && nodesGroup.length > MINIMUM_NODES_PERGROUP)) {
                for (var i = 0, len = nodesGroup.length - 1; i < len; i++) {
                    if (!nodesGroup[i].valid) {
                        continue;
                    }
                    var nodesGroup1 = []; // per cell
                    var cellIndex = this._locateCell(nodesGroup[i].index);
                    for (var j = i + 1; j < nodesGroup.length; j++) {
                        if (nodesGroup[j].valid && cellIndex === this._locateCell(nodesGroup[j].index)) {
                            nodesGroup1.push(nodesGroup[j]);
                            nodesGroup[j].valid = false;
                        }
                    }
                
                    if (nodesGroup1.length > 1) {
                        this._splitnodesGroupSub(nodesGroup1);
                    }
                }
                
            } else {
                this._splitnodesGroupSub(nodesGroup);
            }
        }
    };
    
    LoadMeshSyncInstanced.prototype._splitnodesGroupSub = function(nodesGroup) {
        // Sort the nodes in this group by mesh
        nodesGroup.sort(function(a, b) {
            return a.mesh - b.mesh;
        });

        // Nodes that have only itself.
        var lonelyNodes = [];

        // Group nodes into one node's subnode array.
        var k = 0;
        nodesGroup[k].valid = true;
        var maxBytes = this._attributesData[nodesGroup[0].attribute].values[0].stride * this._maxVertexNumber;
        for (var j = 1, len1 = nodesGroup.length; j < len1; ++j) {
            if (nodesGroup[j].mesh !== nodesGroup[k].mesh) {
                if (nodesGroup[k].nodes.length === 0) {
                    lonelyNodes.push(nodesGroup[k]);
                } else {
                    nodesGroup[k].instanced = true;
                    nodesGroup[k].identity = 0;
                }

                k = j;
                nodesGroup[k].valid = true;
            } else {
                nodesGroup[k].nodes.push(nodesGroup[j]);
                nodesGroup[j].valid = false;
            }
        }

        if (nodesGroup[k].nodes.length !== 0) {
            nodesGroup[k].instanced = true;
            nodesGroup[k].identity = 0;
        } else {
            lonelyNodes.push(nodesGroup[k]);
        }

        // Merge lonely nodes into one big node as it will not consume extra memory in most of time, unless
        // same mesh are used different nodes with different materials. It is very rare in the input model file.
        for (var j = 1, len1 = lonelyNodes.length; j < len1; j++) {
            lonelyNodes[0].nodes.push(lonelyNodes[j]);
            lonelyNodes[j].valid = false;
        }
    }
    
    LoadMeshSyncInstanced.prototype._locateCell = function(index) {
        var bbox = this._sceneBin.readNodeBBox(index);
        vec3.set(gridInfo.center,   (bbox[3] + bbox[0]) / 2 - this._sceneJson.scene.min[0], 
                                    (bbox[1] + bbox[4]) / 2 - this._sceneJson.scene.min[1], 
                                    (bbox[2] + bbox[5]) / 2 - this._sceneJson.scene.min[2]);
                                    
        var x = Math.floor(gridInfo.center[0] / gridInfo.cellSize[0]);
        var y = Math.floor(gridInfo.center[1] / gridInfo.cellSize[1]);
        var z = Math.floor(gridInfo.center[2] / gridInfo.cellSize[2]);
        
        return z + y * gridInfo.segments[2]+ x * gridInfo.segments[1] * gridInfo.segments[2];
    };
    
    LoadMeshSyncInstanced.prototype._updateNodesInfo = function() {
        // Compute the maximum bytes during mesh expansion (node merge).
        var maxBytes = 0;

        // Compute the output node number and required mesh size.
        var numInstancedNodes= 0;
        var numMergedNodes    = 0;
        var numlonelyNodes    = 0;

        // The output total mesh bytes
        var totalBytes = 0;

        for (var i = 0, len = this._nodesInfo.length; i < len; i++) {
            var nodes = this._nodesInfo[i];
            for (var j = 0, len1 = nodes.length; j < len1; ++j) {
                if (nodes[j].valid) {
                    if (nodes[j].instanced) {
                        numInstancedNodes++;
                    } else if (nodes[j].nodes.length > 0) {
                        numMergedNodes++;

                        // For merged node, its mesh size is the sum of merging ones.
                        var verticesBytes = nodes[j].verticesBytes;
                        var indexNumber   = nodes[j].indicesBytes / nodes[j].indexType;

                        bytes += nodes[j].verticesBytes + nodes[j].indicesBytes;
                        for (var k = 0, len2 = nodes[j].nodes.length; k < len2; k++) {
                            verticesBytes += nodes[j].nodes[k].verticesBytes;
                            indexNumber += nodes[j].nodes[k].indicesBytes / nodes[j].nodes[k].indexType;
                        }
        
                        var attributeData = this._attributesData[nodes[j].attribute];
                        var stride = attributeData.values[0].stride;
                        var vertexNumber = verticesBytes / stride;
        
                        var indexType = 1;
                        if (vertexNumber > 65536) {
                            indexType = 4;
                        } else if (vertexNumber > 256) {
                            indexType = 2;
                        } 

                        nodes[j].verticesBytes  = verticesBytes;
                        nodes[j].indicesBytes   = indexNumber * indexType;
                        nodes[j].verticesOffset = 0;
                        nodes[j].indicesOffset  = nodes[j].verticesBytes;
                        nodes[j].indexType      = indexType;
                    } else {
                        numlonelyNodes++;
                    }
                        
                    var bytes = nodes[j].verticesBytes + nodes[j].indicesBytes;

                    if (maxBytes < bytes) {
                        maxBytes = bytes;
                    }

                    totalBytes += bytes;
                }
            }
        }

        this._retMeshBinary = new ArrayBuffer(maxBytes);

        var totalOriginalBytes = 0;
        for (var i = 0, len = this._sceneJson.buffers.length; i < len; i++) {
            totalOriginalBytes += this._sceneJson.buffers[i].byteLength;
        }

        modelo3d.debug("The total orignal mesh bytes: " + totalOriginalBytes);
        modelo3d.debug("The total output mesh bytes: " + totalBytes);
        modelo3d.debug("The largest output mesh bytes: " + maxBytes);
        modelo3d.debug("The original node number:" + this._sceneJson.scene.nodes + ". After loading: ");
        modelo3d.debug("instanced: " + numInstancedNodes);
        modelo3d.debug("merged:    " + numMergedNodes);
        modelo3d.debug("lonely:    " + numlonelyNodes);
    };

    LoadMeshSyncInstanced.prototype.load = function(meshBufferIndex, meshBinary, onNodeDataReady) {
        var nodesInfo = this._nodesInfo[meshBufferIndex];
        for (var i = 0, len = nodesInfo.length; i < len; ++i) {
            var nodeInfo = nodesInfo[i];
            if (nodeInfo.valid) {
                nodeInfo.nodes.push(nodeInfo); // put the node itself into the node list as well.
                if (nodeInfo.nodes.length === 1) {
                    nodeInfo.drawOffset = 0;
                    nodeInfo.drawCount = nodeInfo.indicesBytes / nodeInfo.indexType;
                    onNodeDataReady(nodeInfo, meshBinary);
                } else if (nodeInfo.instanced) {
                    this._populateInstancedNode(nodeInfo, meshBinary);
                    onNodeDataReady(nodeInfo, meshBinary);
                } else {
                    this._populateMergedNode(nodeInfo, meshBinary);
                    onNodeDataReady(nodeInfo, this._retMeshBinary);
                }

            }
        }
    };
    
    var translate    = new Float32Array([0, 0, 0]);
    var scale        = new Float32Array([0, 0, 0]);
    var tempVector31 = new Float32Array(3); // temporary variable
    var tempVector32 = new Float32Array(3); // ditto
    
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
    
    LoadMeshSyncInstanced.prototype._populateInstancedNode = function(nodeInfo, meshBinary) {
        var nodeBBoxData = this._sceneBin.readNodeBBox(nodeInfo.index);
        for (var i = 0, len = nodeInfo.nodes.length; i < len; i++) {
            var nodeData = nodeInfo.nodes[i];

            var bboxData = this._sceneBin.readNodeBBox(nodeData.index);
            UnionBBox(nodeBBoxData, bboxData);
        }
    };
    
    LoadMeshSyncInstanced.prototype._populateMergedNode = function(nodeInfo, meshBinary) {
        var attributeData = this._attributesData[nodeInfo.attribute];

        var retMeshBinary = this._retMeshBinary;

        var vertexOffset = 0;
        var indexOffset  = nodeInfo.verticesBytes;

        var nodeBBoxData = this._sceneBin.readNodeBBox(nodeInfo.index);
        var indexType = nodeInfo.indexType;

        var that = this;
        // Sort the nodes in the ascending order of rendering importance (region + bbox)
        nodeInfo.nodes.sort(function(a, b) {
            if (a.region !== b.region) { 
                return a.region - b.region; // The smaller region value is, the more important it is.
            }
            var aBBox = that._sceneBin.readNodeBBox(a.index);
            var bBBox = that._sceneBin.readNodeBBox(b.index);

            var w, h, d, p;

            h = (aBBox[5] - aBBox[2]);
            d = (aBBox[4] - aBBox[1]);
            w = (aBBox[3] - aBBox[0]);
            var ap = (h + d + w); // an approximate diag

            h = (bBBox[5] - bBBox[2]);
            d = (bBBox[4] - bBBox[1]);
            w = (bBBox[3] - bBBox[0]);
            var bp = (h + d + w); // an approximate diag

            return ap - bp;
        });

        for (var i = 0, len = nodeInfo.nodes.length; i < len; i++) {
            var nodeData = nodeInfo.nodes[i];

            var meshData = this._sceneBin.readMesh(nodeData.mesh);
            var transformData = this._sceneBin.readNodeTransform(nodeData.index);
            var bboxData = this._sceneBin.readNodeBBox(nodeData.index);

            var vertices = new Float32Array(retMeshBinary, vertexOffset, meshData[2] / 4);
            var encodedVertices = new Float32Array(meshBinary, meshData[1], meshData[2] / 4);

            if (!nodeData.identity) {
                if (IsTranslationMatrix(transformData)) {
                    translate[0] = transformData[9];
                    translate[1] = transformData[10];
                    translate[2] = transformData[11];
                    TransformUncompressVertices1(vertices, encodedVertices, attributeData, translate);
                } else if (IsTranslationScalingMatrix(transformData)) {
                    translate[0] = transformData[9];
                    translate[1] = transformData[10];
                    translate[2] = transformData[11];
                    scale[0] = transformData[0];
                    scale[1] = transformData[4];
                    scale[2] = transformData[8];
                    TransformUncompressVertices2(vertices, encodedVertices, attributeData, scale, translate);
                } else {
                    TransformUncompressVertices3(vertices, encodedVertices, attributeData, transformData);
                }
            } else {
                UncompressVertices(vertices, encodedVertices, attributeData);
            }
                
            UnionBBox(nodeBBoxData, bboxData);
            
            var indices  = null;
            var encodedIndices  = null;
            
            var numIndices = 0;
            var encodedIndexType = (meshData[0] & 0xffff);
            switch (encodedIndexType) {
                case 4:
                    numIndices = meshData[4] / 4;
                    encodedIndices = new Uint32Array(meshBinary, meshData[3], numIndices);
                    break;
                case 2:
                    numIndices = meshData[4] / 2;
                    encodedIndices = new Uint16Array(meshBinary, meshData[3], numIndices);
                    break;
                default:
                    numIndices = meshData[4];
                    encodedIndices = new Uint8Array(meshBinary, meshData[3], numIndices);
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

            vertexOffset += meshData[2];
            indexOffset += numIndices * indexType;
        }

        // It is a new mesh.
        nodeInfo.mesh = nodeInfo.mesh.toString() + "x" + nodeInfo.index.toString();
        // Remove the transform
        nodeInfo.identity = 1;
    };
    
    return LoadMeshSyncInstanced;
    
})();
    

