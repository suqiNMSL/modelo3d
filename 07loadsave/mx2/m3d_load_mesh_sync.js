//
// m3d_load_mesh_sync.js
// Merge meshes into large one to reduce drawcall
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
        this.identity       = true;
        this.mergible       = true;
        this.region         = 0;    

        // transform and bbox are in the binary.

        this.cost           = 0; // When this node is a merge result of serveral other nodes, 
                                 // what's the memory cost versus reduce draw call number.
        this.memoryCost     = 0; // The extra memory cost in bytes if merge.
        this.groupMeshes    = null; //Record all the mesh indexes in the local group
    };

    function LoadMeshSync(resourceManager, sceneJson, sceneBin, attributesData, compressNormal) {
        this._resourceManager = resourceManager;
        this._sceneJson       = sceneJson;
        this._sceneBin        = sceneBin;
        this._attributesData  = attributesData;
        this._maxVertexNumber = 65536; // we ensure the merge mesh still uses uint16 for index type.
        
        this._meshes          = 0;
        this._compressNormal  = compressNormal;
        
        this._nodesInfo   = null;
        this._buffersNodes    = [];
        this._verticesBinary   = null;
        this._indicesBinary    = null;
    };
    
    LoadMeshSync.prototype.destroy = function() {
        delete this._attributesData;
        delete this._sceneJson;
        delete this._sceneBin;
        delete this._caller;

        this._nodesInfo = null;
        delete this._nodesInfo;
        this._buffersNodes = null;
        delete this._buffersNodes;
        this._buffersInfo = null;
        delete this._buffersInfo;
        this._verticesBinary = null;
        delete this._verticesBinary;
        this._indicesBinary = null;
        delete this._indicesBinary;
    };

    var SCALE = 16;

    var gridInfo = {
        size     : vec3.create(),
        cellSize : vec3.create(),
        segments : vec3.create(),
        center   : vec3.create()
    };

    LoadMeshSync.prototype.initialize = function() {
        // Already initialized
        if (this._nodesInfo !== null) {
            return ;
        }
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

        var numBuffers = this._sceneJson.buffers.length;
        for (var i = 0; i < numBuffers; i++) {
            this._meshes += this._sceneJson.buffers[i].meshes;
        }
        //
        // Create node info for each node
        //
        this._nodesInfo = [];
        this._buffersNodes = new Array(numBuffers);
        for (var i = 0, len = this._sceneJson.buffers.length; i < len; i++) {
            this._buffersNodes[i] = [];
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
                    nodeInfo.indexType = (meshData[0] & 0xff);
                    nodeInfo.verticesOffset = meshData[1];
                    nodeInfo.verticesBytes = meshData[2];
                    nodeInfo.indicesOffset = meshData[3];
                    nodeInfo.indicesBytes = meshData[4];

                    this._nodesInfo.push(nodeInfo);
                    this._buffersNodes[j].push(i);
                    break;
                }
            }
        }

        for (var i = 0, len = numBuffers; i < len; i++) {
            this._groupNodesByMaterial(this._buffersNodes[i]);
        }

        this._createMerges(new Uint32Array(numBuffers), Globals.gpuMemory * 1024 * 1024);
        
        // 
        // For each mesh.bin, we create only one GL buffer to save the GL object bookkeeping cost
        // which can be huge.
        //
        var maxVbSize = 0; 
        var maxIbSize = 0;
        for (var i = 0, len = this._buffersNodes.length; i < len; ++i) {
            var bufferNodes = this._buffersNodes[i];
            
            var vbSize = 0;
            var ibSize = 0;
            for (var j = 0, len2 = bufferNodes.length; j < len2; j++) {
                var nodeInfo = this._nodesInfo[bufferNodes[j]];

                if (nodeInfo.valid) { // only for valid
                    var verticesBytes = nodeInfo.verticesBytes;
                    var indicesBytes = nodeInfo.indicesBytes;
                    var attributes = this._attributesData[nodeInfo.attribute];
                    var vertices = verticesBytes / attributes.values[0].stride;

                    if (this._compressNormal && attributes.hasNormal) {
                        verticesBytes = vertices * (attributes.values[0].stride - 4);
                    }

                    // Add the vertex visible/material bytes for each mesh 
                    //verticesBytes += vertices;

                    // Align to 4 bytes.
                    verticesBytes = (verticesBytes + 3) & (-4);
                    indicesBytes  = (indicesBytes + 3) & (-4);
                    
                    vbSize += verticesBytes;
                    ibSize += indicesBytes;
                }
            }

            if (maxVbSize < vbSize) {
                maxVbSize = vbSize;
            }
            if (maxIbSize < ibSize) {
                maxIbSize = ibSize;
            }
        }
        this._verticesBinary = new ArrayBuffer(maxVbSize);
        this._indicesBinary  = new ArrayBuffer(maxIbSize);
    };

    LoadMeshSync.prototype._createMerges = function(offsets, memoryBudget) {
        var mergeNodes = [];
        var mergeBytes = 0;

        var minCost = 1024 * 1024 * 1024; 
        
        // flags if this mesh has been used by any nodes.
        var meshes = new Uint8Array(this._meshes);
        for (var i = 0, len = this._buffersNodes.length; i < len; i++) {
            var bufferNodes = this._buffersNodes[i];

            for (var j = offsets[i], len1 = bufferNodes.length; j < len1; ++j) {
                var nodeIndex = bufferNodes[j];

                if (this._nodesInfo[nodeIndex].valid) { // valid == true
                    if (this._nodesInfo[nodeIndex].nodes.length > 0) { 
                        
                        this._computeMergeInfo(nodeIndex, meshes);
                        
                        // If the extra memory cost is smaller than 128KB, we simply merge it.
                        
                        var extraMemCost = this._nodesInfo[nodeIndex].verticesBytes + this._nodesInfo[nodeIndex].indicesBytes -
                            this._nodesInfo[nodeIndex].bytes; // 7
                        
                        var bytes = this._nodesInfo[nodeIndex].verticesBytes + this._nodesInfo[nodeIndex].indicesBytes;

                        if (extraMemCost < 130000) {
                            
                            memoryBudget -= bytes;
                        } else {
                            if (minCost > extraMemCost) {
                                minCost = extraMemCost;
                            }

                            memoryBudget -= this._nodesInfo[nodeIndex].bytes; // original mesh size
                            mergeNodes.push(nodeIndex);
                            mergeBytes += extraMemCost;
                        }
                    } else {
                        if (!meshes[this._nodesInfo[nodeIndex].mesh]) {
                            memoryBudget -= (this._nodesInfo[nodeIndex].verticesBytes + this._nodesInfo[nodeIndex].indicesBytes);
                            meshes[this._nodesInfo[nodeIndex].mesh] = 1;
                        }
                    }

                    if (memoryBudget < 0) {
                        console.log("No enough GPU memory to load this model.");
                        throw (new Error("No enough GPU memory to load this model."));
                    }
                }
            }
        }
        // Check if the remaining memory can still meet the fullly merge. Solve
        // Knapsack problem if not.
        if (memoryBudget < mergeBytes) {
            // Normalize the cost 
            for (var i = 0, len = mergeNodes.length; i < len; i++) {
                var nodeIndex = mergeNodes[i];
                this._nodesInfo[nodeIndex].bytes = (this._nodesInfo[nodeIndex].verticesBytes +
                                                    this._nodesInfo[nodeIndex].indicesBytes -
                                                    this._nodesInfo[nodeIndex].bytes) / minCost;
            }

            // Use dynamic programming to solve Knapsack problem.
            // https://www.cnblogs.com/Christal-R/p/Dynamic_programming.html
            var N = mergeNodes.length;
            var C = Math.ceil(memoryBudget / minCost);
            var V = new Uint32Array((N + 1) * (C + 1));

            for (var i = 1; i <= N; i++) {
                var c = this._nodesInfo[mergeNodes[i - 1]].bytes;
                var v = this._nodesInfo[mergeNodes[i - 1]].nodes.length;

                for (var j = 1; j <= C; j++) {
                    var i0 = i * (C + 1) + j;
                    var i1 = (i - 1) * (C + 1) + j;
                    if (j < c) {
                        V[i0] = V[i1];
                    } else {
                        var i2 = (i - 1) * (C + 1) + j - c;
                        if (V[i1] > V[i2] + v) {
                            V[i0] = V[i1];
                        } else {
                            V[i0] = V[i2] + v;
                        }
                    }
                }
            }

            var merges = new Uint8Array(mergeNodes.length);
            var that = this;
            var findMerges = function FindMerges(i, j) {
                if (i > 0) {
                    var c = that._nodesInfo[mergeNodes[i - 1]].bytes;
                    var v = that._nodesInfo[mergeNodes[i - 1]].nodes.length;

                    if (V[i * (C + 1) + j] === V[(i - 1) * (C + 1) + j]) {
                        FindMerges(i - 1, j);
                    } else if (j - c >= 0 && V[i * (C + 1) + j] === V[(i - 1) * (C + 1) + j - c] + v) {

                        merges[i - 1] = 1;
                        FindMerges(i - 1, j - c);
                    }
                }
            }
            findMerges(N, C);

            var meshes1 = new Uint8Array(this._meshes);

            for (var i = 0, len = merges.length; i < len; i++) {
                if (!merges[i]) {
                    this._deleteMergeInfo(mergeNodes[i], meshes1);
                }
            }
        }
    };
    
    // Compute the extra memory it consumes if we merge nodes.
    LoadMeshSync.prototype._computeMergeInfo = function(nodeIndex, meshes) {
        var attribute = this._nodesInfo[nodeIndex].attribute;
        var indexType = this._nodesInfo[nodeIndex].indexType;
        var attributeData = this._attributesData[attribute];
        var stride = attributeData.values[0].stride;
        
        var bytes = 0;
        var verticesBytes1 = this._nodesInfo[nodeIndex].verticesBytes;
        var indicesBytes1 = this._nodesInfo[nodeIndex].indicesBytes;
        var mesh = this._nodesInfo[nodeIndex + 1];
        if (!meshes[mesh]) {
            meshes[mesh] = 1;

            bytes += verticesBytes1 + indicesBytes1;
        } 
        var verticesBytes = verticesBytes1;
        var indices = indicesBytes1 / indexType;

        for (var i = 0; i < this._nodesInfo[nodeIndex].nodes.length; i++) {
            var nodeInfo = this._nodesInfo[nodeIndex].nodes[i];
            verticesBytes1 = nodeInfo.verticesBytes;
            indicesBytes1  = nodeInfo.indicesBytes;
            indexType = nodeInfo.indexType; 
            mesh = nodeInfo.mesh;
            if (!meshes[mesh]) {
                meshes[mesh] = 1;
                bytes += verticesBytes1 + indicesBytes1;
            }
            
            verticesBytes += verticesBytes1;
            indices += indicesBytes1 / indexType;
        }
        
        var vertices = verticesBytes / stride;

        // Update index type.
        indexType = 1;
        if (vertices > 65536) {
            indexType = 4;
        } else if (vertices > 256) {
            indexType = 2;
        } 

        this._nodesInfo[nodeIndex].verticesBytes = verticesBytes;
        this._nodesInfo[nodeIndex].indicesBytes = indices * indexType;
        this._nodesInfo[nodeIndex].bytes = bytes;
        this._nodesInfo[nodeIndex].indexType = indexType;
    };
    
    LoadMeshSync.prototype._deleteMergeInfo = function(nodeIndex, meshes) {
        var meshData = this._sceneBin.readMesh(this._nodesInfo[nodeIndex].mesh);
        this._nodesInfo[nodeIndex].attribute = (meshData[0] >> 16);
        this._nodesInfo[nodeIndex].indexType = (meshData[0] & 0xff);
        this._nodesInfo[nodeIndex].verticesOffset = meshData[1];
        this._nodesInfo[nodeIndex].verticesBytes = meshData[2];
        this._nodesInfo[nodeIndex].indicesOffset = meshData[3];
        this._nodesInfo[nodeIndex].indicesBytes = meshData[4];
        for (var i = 0; i < this._nodesInfo[nodeIndex].nodes.length; i++) {
            this._nodesInfo[nodeIndex].nodes[i].valid = true;
            this._nodesInfo[nodeIndex].nodes[i].nodes = [];
        }
        this._nodesInfo[nodeIndex].nodes = [];
    };
    
    // Combine nodes together if they use the same material
    LoadMeshSync.prototype._groupNodesByMaterial = function(bufferNodes) {
        if (bufferNodes.length < 1) {
            return ;
        }
        
        var that = this;
        
        bufferNodes.sort(function(a, b) {
            var ret = 0;

            ret = that._nodesInfo[a].billboard - that._nodesInfo[b].billboard;
            if (ret !== 0) {
                return ret;
            }

            ret = that._nodesInfo[a].material - that._nodesInfo[b].material;
            if (ret !== 0) {
                return ret;
            }

            ret = that._nodesInfo[a].layer - that._nodesInfo[b].layer;
            if (ret !== 0) {
                return ret;
            }

            ret = that._nodesInfo[a].attribute - that._nodesInfo[b].attribute;
            if (ret !== 0) {
                return ret;
            }

            return that._nodesInfo[a].views.localeCompare(that._nodesInfo[b].views);
        });

        var currentMaterial   = that._nodesInfo[bufferNodes[0]].material;
        var currentLayer      = that._nodesInfo[bufferNodes[0]].layer;
        var currentAttribute  = that._nodesInfo[bufferNodes[0]].attribute;
        var currentViews      = that._nodesInfo[bufferNodes[0]].views;

        var nodesGroup = [];
        nodesGroup.push(that._nodesInfo[bufferNodes[0]]);
        var i, k, len;
        for (i = 1, len = bufferNodes.length; i < len; ++i) {
            if (that._nodesInfo[bufferNodes[i]].billboard                       ||
                !that._nodesInfo[bufferNodes[i]].indexType > 2                  ||
                that._nodesInfo[bufferNodes[i]].material !== currentMaterial    ||
                that._nodesInfo[bufferNodes[i]].layer !== currentLayer          ||
                that._nodesInfo[bufferNodes[i]].attribute !== currentAttribute  ||
                that._nodesInfo[bufferNodes[i]].views !== currentViews          ||
                false) {

                this._splitnodesGroup(nodesGroup);
                
                nodesGroup = [];

                currentMaterial  = that._nodesInfo[bufferNodes[i]].material;
                currentLayer     = that._nodesInfo[bufferNodes[i]].layer;
                currentViews     = that._nodesInfo[bufferNodes[i]].views;
                currentAttribute = that._nodesInfo[bufferNodes[i]].attribute;
            } 
            
            nodesGroup.push(that._nodesInfo[bufferNodes[i]]);
        }

        this._splitnodesGroup(nodesGroup);
    };
        
    var MINIMUM_NODES_PERGROUP = 30;
    
    LoadMeshSync.prototype._splitnodesGroup = function(nodesGroup) {
        
        if (nodesGroup.length > 1) {
            if (nodesGroup.length > 1) {
                this._splitNodesGroupSub(nodesGroup);
            }
        }
    };
    
    LoadMeshSync.prototype._splitNodesGroupSub = function(nodesGroup) {
        var k = 0;
        nodesGroup[k].valid = true;
        var maxBytes = this._attributesData[nodesGroup[0].attribute].values[0].stride * this._maxVertexNumber;
        for (var j = 1, len1 = nodesGroup.length; j < len1; ++j) {
            if (nodesGroup[k].verticesBytes + nodesGroup[j].verticesBytes > maxBytes) {
                k = j;
                nodesGroup[k].valid = true;
            } else {
                nodesGroup[k].nodes.push(nodesGroup[j]);
                nodesGroup[j].valid = false;
            }
        }
    }
    
    LoadMeshSync.prototype._locateCell = function(index) {
        var bbox = this._sceneBin.readNodeBBox(index);
        vec3.set(gridInfo.center,   (bbox[3] + bbox[0]) / 2 - this._sceneJson.scene.min[0], 
                                    (bbox[1] + bbox[4]) / 2 - this._sceneJson.scene.min[1], 
                                    (bbox[2] + bbox[5]) / 2 - this._sceneJson.scene.min[2]);
                                    
        var x = Math.floor(gridInfo.center[0] / gridInfo.cellSize[0]);
        var y = Math.floor(gridInfo.center[1] / gridInfo.cellSize[1]);
        var z = Math.floor(gridInfo.center[2] / gridInfo.cellSize[2]);
        
        return z + y * gridInfo.segments[2]+ x * gridInfo.segments[1] * gridInfo.segments[2];
    };
    
    // Compute the extra memory it consumes if we merge nodes.
    LoadMeshSync.prototype._updateMergeNodeInfo = function(nodeInfo) {

        var nodesInfo = nodeInfo.nodes;
        var attributeData = this._attributesData[nodeInfo.attribute];
        var stride = attributeData.values[0].stride;
        
        var verticesBytes = 0;
        var indexNumber = 0;

        // Check how many meshes will be expanded
        var meshes = {};
        var numVertices = 0;
        for (var i = 0, len = nodesInfo.length; i < len; ++i) {
            var mesh = nodesInfo[i].mesh;
            if (!meshes.hasOwnProperty(mesh)) {
                meshes[mesh] = 0;
            }
            meshes[mesh]++;

            verticesBytes += nodesInfo[i].verticesBytes;
            indexNumber += nodesInfo[i].indicesBytes / nodesInfo[i].indexType;
        }
        if (!meshes.hasOwnProperty(nodeInfo.mesh)) {
            meshes[nodeInfo.mesh] = 1;
        } else {
            meshes[nodeInfo.mesh]++;
        }
        var meshData = this._sceneBin.readMesh(nodeInfo.mesh);
        verticesBytes += meshData[2];;
        indexNumber += meshData[4] / nodeInfo.indexType;

        var vertexNumber = verticesBytes / stride;

        // Update index type.
        var indexType = 1;
        if (vertexNumber > 65536) {
            indexType = 4;
        } else if (vertexNumber > 256) {
            indexType = 2;
        } 

        var bytes = 0;
        var total = 0;
        var numDrawcalls = 0;
        for (var mesh in meshes) {
            var n = meshes[mesh]; // The first one will reuse the current mesh memory space.

            var meshData = this._sceneBin.readMesh(mesh);
            var thisIndexType = (meshData[0] & 0xff);
            var scale = indexType / thisIndexType;
            total += n * (meshData[2] + meshData[4] * scale); 
            bytes += (n-1) * (meshData[2] + meshData[4] * scale); 

            numDrawcalls += n;
        }

        nodeInfo.verticesBytes = verticesBytes;
        nodeInfo.indicesBytes = indexNumber * indexType;
        nodeInfo.indexType = indexType;
        nodeInfo.memoryCost = bytes;
        nodeInfo.cost = total / numDrawcalls;
        nodeInfo.groupMeshes = meshes;
    };

    LoadMeshSync.prototype._updateNodesInfo = function() {
        var mergeNodes = [];

        for (var i = 0, len = this._nodesInfo.length; i < len; i++) {
            var nodes = this._nodesInfo[i];
            for (var j = 0, len1 = nodes.length; j < len1; ++j) {
                if (nodes[j].nodes.length > 0) {
                    this._updateMergeNodeInfo(nodes[j]);
                    mergeNodes.push(nodes[j]);
                }
            }
        }

        // Sort the nodes with merge costs, i.e., place the node with large merge costs
        // at last.
        mergeNodes.sort(function(a, b) {
            return a.cost - b.cost;
        });
        
        // Compute the memoryCost of each merged node. The cost is the sum of repeated mesh size.
        // Check MOD-6335
        var meshes = {};
        for (var i = 0, len = mergeNodes.length; i < len; i++) {
            for (var mesh in mergeNodes[i].groupMeshes) {
                if (!meshes.hasOwnProperty(mesh)) {
                    meshes[mesh] = true;
                } else {
                    var meshData = this._sceneBin.readMesh(mesh);
                    var thisIndexType = (meshData[0] & 0xff);
                    var scale = mergeNodes[i].indexType / thisIndexType;
                    mergeNodes[i].memoryCost += meshData[2] + meshData[4] * scale;
                }
            }
        }

        var nummergeNodes = 0;
        
        // Compute the maximum bytes during mesh expansion (node merge).
        var maxBytes = 0;

        // Search which nodes can be merged with given budget. Here we just use greedy algorithm
        // which might not be optimum.
        var budget = this._memoryBudget;
        for (var i = 0, len = mergeNodes.length; i < len; i++) {
            var mergeNode = mergeNodes[i];

            nummergeNodes += mergeNode.nodes.length;

            var bytes = mergeNode.verticesBytes + mergeNode.indicesBytes;
            if (maxBytes < bytes) {
                maxBytes = bytes;
            }

            budget -= mergeNode.memoryCost;
            if (budget < 0) {
                break;
            }

            mergeNode.verticesOffset = 0;
            mergeNode.indicesOffset = mergeNode.verticesBytes;
        }
        
        this._retMeshBinary = new ArrayBuffer(maxBytes);

        modelo3d.debug("Used memory budget: " + (this._memoryBudget - budget));
        modelo3d.debug("Largest mesh size: " + maxBytes);
        modelo3d.debug((nummergeNodes + i) + " nodes are merged to " + i);
        
        var memoryRequired = 0;
        nummergeNodes = 0;
                
        // Restore nodes that won't be merged back to their original state.
        for (var j = i; j < len; j++) {
            var nodeInfo = mergeNodes[j];
            for (var k = 0, len2 = nodeInfo.nodes.length; k < len2; k++) {
                nodeInfo.nodes[k].valid = true;
            } 
        
            memoryRequired += nodeInfo.memoryCost;
                
            nummergeNodes += nodeInfo.nodes.length;
                    
            // Recover the vertices and indices information.
            var meshData = this._sceneBin.readMesh(nodeInfo.mesh);

            nodeInfo.indexType = (meshData[0] & 0xff);
            nodeInfo.verticesOffset = meshData[1];
            nodeInfo.verticesBytes = meshData[2];
            nodeInfo.indicesOffset = meshData[3];
            nodeInfo.indicesBytes = meshData[4];

            nodeInfo.nodes = [];
        }

        var k = len - i;
        if (k !== 0) {
            modelo3d.debug((nummergeNodes + k) + " nodes can be merged to " + k + " with " + memoryRequired + " memory");
        }
    };

    LoadMeshSync.prototype.load = function(meshBufferIndex, meshBinary, onNodeDataReady) {
        var bufferNodes = this._buffersNodes[meshBufferIndex];

        var vertexBuffer = this._resourceManager.getBuffer("vmesh" + meshBufferIndex + ".bin");
        var indexBuffer = this._resourceManager.getBuffer("imesh" + meshBufferIndex + ".bin");
        
        // Initialize the buffer data so that meshes sharing these buffer are valid.
        vertexBuffer.create(gl.ARRAY_BUFFER, new Uint8Array(1)); 
        indexBuffer.create(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(1));

        this._verticesOffset = 0;
        this._indicesOffset = 0;
        
        for (var i = 0, len = bufferNodes.length; i < len; ++i) {
            var nodeIndex = bufferNodes[i];
            var nodeInfo = this._nodesInfo[nodeIndex];
            if (nodeInfo.valid) {
                
                var vertices = null;
                var indices  = null;
                
                if (nodeInfo.nodes == 0) { // no children
                    var meshData = this._sceneBin.readMesh(nodeInfo.mesh);
                    
                    // If this mesh has never been created before.
                    if (!this._resourceManager.hasMesh(nodeInfo.mesh)) {
                        var phonyMesh = this._resourceManager.getMesh(nodeInfo[1]); // Add a mesh
                        
                        var attributeData = this._attributesData[nodeInfo.attribute];
                        var encodedIndexType = (meshData[0] & 0xff);
                
                        var verticesFloats = meshData[2] / 4;
                        var verticesNumber = meshData[2] / attributeData.values[0].stride;
                        if (this._compressNormal && attributeData.hasNormal) {
                            verticesFloats -= meshData[2] / attributeData.values[0].stride;
                        } 

                        var encodedVertices = new Float32Array(meshBinary, meshData[1], meshData[2] / 4);
                        vertices = new Float32Array(this._verticesBinary, this._verticesOffset, verticesFloats);
                        
                        UncompressVertices(vertices, encodedVertices, attributeData, this._compressNormal); 

                        var encodedIndices = new Uint8Array(meshBinary, meshData[3], meshData[4]);
                        indices = new Uint8Array(this._indicesBinary, this._indicesOffset, meshData[4]);
                        
                        UncompressIndices(indices, encodedIndices, meshData[4], 0);

                        nodeInfo.verticesBytes = verticesNumber;
                        // Note that since for simple drawable with only one node, we don't need to 
                        // pad the vis/mat vertex attribute as it can be changed in CPU side.

                        this._verticesOffset += verticesFloats * 4;
                        this._indicesOffset += meshData[4];

                        this._verticesOffset = (this._verticesOffset + 3) & (-4);
                        this._indicesOffset = (this._indicesOffset + 3) & (-4);
                    }
                    onNodeDataReady(nodeInfo, vertexBuffer, indexBuffer, vertices, indices, this._nodesInfo);
                //} else if (nodeInfo[2] & 0x30000000) {
                //    this._populateInstancedNode(nodeInfo);
                //    onNodeDataReady(nodeInfo, meshBinary, this._nodesInfo, this._buffersInfo);
                } else {
                    var verticesOffset = this._verticesOffset;
                    var indicesOffset = this._indicesOffset;

                    nodeInfo = this._populateMergedNode(nodeInfo, meshBinary);

                    var verticesBytes = this._verticesOffset - verticesOffset;
                    var indicesBytes = this._indicesOffset - indicesOffset;
        
                    // Align the vertices and indices binary to 4.
                    this._verticesOffset = (this._verticesOffset + 3) & (-4);
                    this._indicesOffset  = (this._indicesOffset + 3) & (-4);

                    var vertices = new Uint8Array(this._verticesBinary, verticesOffset, verticesBytes);
                    var indices  = new Uint8Array(this._indicesBinary, indicesOffset, indicesBytes);
                    
                    onNodeDataReady(nodeInfo, vertexBuffer, indexBuffer, vertices, indices, this._nodesInfo);
                }
            }
        }
        
        // Update the buffer data.
        vertexBuffer.update(new Uint8Array(this._verticesBinary, 0, this._verticesOffset)); 
        indexBuffer.update(new Uint8Array(this._indicesBinary, 0, this._indicesOffset));
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
                if (attributeData.values[2].index === 4) { // texcoord 
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
                if (attributeData.values[2].index === 4) { // texcoord 
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
                if (attributeData.values[2].index === 4) { // texcoord 
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
            
    function UncompressVertices(vertices, encodedVertices, attributeData, compressNormal) {
        var vertexNumber = ((encodedVertices.byteLength / attributeData.values[0].stride) | 0);
        var numFloats = (((attributeData.values[0].stride | 0) >> 2) | 0);
        var i;
        var totalNumFloats = (((numFloats | 0) * (vertexNumber | 0)) | 0);
        
        if (attributeData.primitive === 4 && compressNormal) {
            var encodedNormals = new Int8Array(encodedVertices.buffer, encodedVertices.byteOffset, encodedVertices.byteLength);
            var normals = new Int8Array(vertices.buffer, vertices.byteOffset, vertices.byteLength);
                
            for (var d = 0, s = 0; s < totalNumFloats; s += numFloats, d += (numFloats - 1)) {
                // position
                vertices[d]     = encodedVertices[s];
                vertices[d + 1] = encodedVertices[s + 1];
                vertices[d + 2] = encodedVertices[s + 2]; 

                // normal
                var d1 = (d << 2);
                var s1 = (s << 2);
                normals[d1]     = encodedNormals[s1 + 12];
                normals[d1 + 4] = encodedNormals[s1 + 13];
                normals[d1 + 8] = encodedNormals[s1 + 14];
            }
            
            if (attributeData.values.length > 2) {
                if (attributeData.values[2].index === 4) { // texcoord 
                    for (var d = 3, s = 4; s < totalNumFloats; d += 5, s += 6) {
                        vertices[d]     = encodedVertices[s];
                        vertices[d + 1] = encodedVertices[s + 1];
                    }
                } else { // vertex color
                    for (var d = 3, s = 4; s < totalNumFloats; d += 4, s += 5) {
                        vertices[d] = encodedVertices[s];
                    }
                }
            }
        } else {
            vertices.set(encodedVertices, 0, totalNumFloats);
        }
    };
    
    LoadMeshSync.prototype._populateMergedNode = function(nodeInfo, meshBinary) {
        var attributeData = this._attributesData[nodeInfo.attribute];

        var baseIndicesOffset = this._indicesOffset;

        //var indexTypeAttribute = nodeInfo[8];
        
        var nodeBBoxData = this._sceneBin.readNodeBBox(nodeInfo.index);
        var indexType = nodeInfo.indexType;
        var attribute = nodeInfo.attribute
        var nodes = [];
        nodes.push(nodeInfo);
        for (var i = 0; i < nodeInfo.nodes.length; i++) {
            nodes.push(nodeInfo.nodes[i]);
        }
        var that = this;
        // Sort the nodes in the ascending order of rendering importance (region + bbox)
        nodes.sort(function(a, b) {
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

        // The current vertices number.
        var vertexNumber = 0;
        for (var i = 0, len = nodes.length; i < len; i++) {
            var nodeData = nodes[i];
            
            var transformData   = this._sceneBin.readNodeTransform(nodeData.index);
            var bboxData        = this._sceneBin.readNodeBBox(nodeData.index);

            var meshData        = this._sceneBin.readMesh(nodeData.mesh);
            var encodedVertices = new Float32Array(meshBinary, meshData[1], meshData[2] / 4);

            var verticesFloats = meshData[2] / 4;
            if (this._compressNormal && attributeData.hasNormal) {
                verticesFloats -= meshData[2] / attributeData.values[0].stride;;
            } 
                
            var vertices = new Float32Array(this._verticesBinary, this._verticesOffset, verticesFloats);

            if (!nodeData.identity) {
                if (IsTranslationMatrix(transformData)) {
                    translate[0] = transformData[9];
                    translate[1] = transformData[10];
                    translate[2] = transformData[11];
                    TransformUncompressVertices1(vertices, encodedVertices, attributeData, translate, this._compressNormal);
                } else if (IsTranslationScalingMatrix(transformData)) {
                    translate[0] = transformData[9];
                    translate[1] = transformData[10];
                    translate[2] = transformData[11];
                    scale[0] = transformData[0];
                    scale[1] = transformData[4];
                    scale[2] = transformData[8];
                    TransformUncompressVertices2(vertices, encodedVertices, attributeData, scale, translate, this._compressNormal);
                } else {
                    TransformUncompressVertices3(vertices, encodedVertices, attributeData, transformData, this._compressNormal);
                }
            } else {
                UncompressVertices(vertices, encodedVertices, attributeData, this._compressNormal);
            }
            this._verticesOffset += verticesFloats * 4;
                
            UnionBBox(nodeBBoxData, bboxData);
            
            var indices  = null;
            var encodedIndices  = null;
            
            var numIndices = 0;
            var encodedIndexType = (meshData[0] & 0xff);
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
                    indices = new Uint32Array(this._indicesBinary, this._indicesOffset, numIndices);
                    break;
                case 2:
                    indices = new Uint16Array(this._indicesBinary, this._indicesOffset, numIndices);
                    break;
                default:
                    indices = new Uint8Array(this._indicesBinary, this._indicesOffset, numIndices);
                    break;
            }
            UncompressIndices(indices, encodedIndices, numIndices, vertexNumber);
            nodeData.drawOffset = this._indicesOffset - baseIndicesOffset;
            nodeData.drawCount = numIndices;
            nodeData.verticesBytes = meshData[2] / attributeData.values[0].stride;;

            vertexNumber += nodeData.verticesBytes;
            this._indicesOffset += numIndices * indexType;
        }
        // Add the vertex material/visiblity bytes to the end of vertices buffer of each mesh.
        //var mvBytes = new Uint8Array(this._verticesBinary, this._verticesOffset, vertexNumber);
        //for (var i = 0; i < vertexNumber; i++) {
        //    mvBytes[i] = 0;
        //}
        //this._verticesOffset += vertexNumber;

        // Re-order the nodes in the list according to the previous sorting result.
        
        var nodeInfo = nodes[0];
        for (var i = 1, len = nodes.length; i < len; i++) {
            nodeInfo.nodes.push(nodes[i]);
        }
        //var nodeIndex = nodes[i];
        //this._nodesInfo[nodeIndex * NODEINFO_INT32 + 3] = -1;

        // Fetch the first node information. 
        //nodeInfo = new Int32Array(this._nodesInfo.buffer, nodes[0] * NODEINFO_INT32 * 4, NODEINFO_INT32);

        // Since the first node of the node list of the merge node has changed, we should update its
        // information for the merge node.

        // Update the bbox of the first node to merged bbox.
        var nodeBBoxData1 = this._sceneBin.readNodeBBox(nodeInfo.index);
        nodeBBoxData1[0] = nodeBBoxData[0];
        nodeBBoxData1[1] = nodeBBoxData[1];
        nodeBBoxData1[2] = nodeBBoxData[2];
        nodeBBoxData1[3] = nodeBBoxData[3];
        nodeBBoxData1[4] = nodeBBoxData[4];
        nodeBBoxData1[5] = nodeBBoxData[5];
        
        // Set the attribute and index type
        nodeInfo.indexType = indexType;
        nodeInfo.attribute = attribute;
        // It is a new mesh.
        nodeInfo.mesh = -1; 
        // Remove the transform
        nodeInfo.identity = true;
        // The output vertex number
        nodeInfo.verticesBytes = vertexNumber;

        return nodeInfo;
    };
    
    
    return LoadMeshSync;
    
})();
    

