//
// m3d_load_mesh_sync_hybrid.js
// Merge meshes into large one to reduce drawcall
// If there are not enough memory space we using instancing drawing to reduce drawcall
//
//  
//

import Globals        from "../../m3d_globals.js";
import Mesh           from "../../02resource/m3d_mesh.js";

export default (function() {
    "use strict";

    function LoadMeshSyncHybrid(resourceManager, sceneJson, modelBin, modelJson, attributesData, 
            compressNormal) {
        this._resourceManager = resourceManager;
        this._sceneJson       = sceneJson;
        this._modelBin        = modelBin;
        this._modelJson       = modelJson;
        this._attributesData  = attributesData;
        this._maxVertexNumber = 65536;
        this._meshes          = 0;
        this._compressNormal  = compressNormal;

        this._nodesInfo       = null;
        this._buffersNodes    = [];

        this._verticesBinary   = null;
        this._indicesBinary    = null;
        
        this._stats           = {};
        this._study           = false;

        this._initialize();
    };
    
    
    LoadMeshSyncHybrid.prototype.destroy = function() {
        delete this._attributesData;
        delete this._sceneJson;
        delete this._modelBin;

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

    LoadMeshSyncHybrid.prototype._getNodeStats = function(sceneJson) {
        this._stats.materials   = sceneJson.materials.length;
        this._stats.nodes       = sceneJson.scene.nodes;

        this._stats.meshesNodes = new Array(9);
        for (var i = 0; i < 9; i++) {
            this._stats.meshesNodes[i] = 0;
        }

        this._stats.fullyMergeMemory  = 0;
        this._stats.fullyMergedDrawcalls = 0;
        this._stats.fullyOrphanDrawcalls = 0;

        this._stats.orphanDrawcalls = 0;
        this._stats.orphanMemory    = 0;
        
        this._stats.simplyMergeMemory  = 0;
        this._stats.mergeMemory = 0;
        this._stats.mergedDrawcalls    = 0;
        this._stats.mergeReducedDrawcalls = 0;

        this._stats.instancedMemory           = 0;
        this._stats.instancedReducedMemory    = 0;
        this._stats.instancedReducedDrawcalls = 0;
        this._stats.instancedDrawcalls = 0;

        this._stats.orphanDrawcalls    = 0;
    };

    var NODEINFO_INT32 = 9; 

    LoadMeshSyncHybrid.prototype._initialize = function() {
        var numNodes = this._modelJson["model.bin"].nodes;
        var numBuffers = this._modelJson.buffers.length;
        
        var meshBinBytes = 0;
        for (var i = 0; i < numBuffers; i++) {
            meshBinBytes += this._modelJson.buffers[i].byteLength;
            this._meshes += this._modelJson.buffers[i].meshes;
        }
        if (meshBinBytes > Globals.gpuMemory * 1024 * 1024 * 1024) {
            throw new Error("No enough GPU memory to load this model: " + meshBinBytes);
        }

        if (this._study) {
            this._stats.meshBins     = numBuffers;
            this._stats.meshBinBytes = meshBinBytes;
            this._stats.meshes       = this._meshes;
            this._stats.meshMaxBytes = 0;

            this._getNodeStats(this._sceneJson);
        }

        //
        // Create node info for each node
        //
        var meshesNodes = null;
        if (this._study) {
            meshesNodes = new Uint16Array(this._stats.meshes);
        }

        this._nodesInfo = new Int32Array(NODEINFO_INT32 * numNodes);
        this._buffersNodes = new Array(numBuffers);
        for (var i = 0; i < numBuffers; i++) {
            this._buffersNodes[i] = [];
        }
        
        for (var i = 0; i < numNodes; i++) {
            var nodeInfo = new Int32Array(this._nodesInfo.buffer, i * NODEINFO_INT32 * 4, NODEINFO_INT32);
            
            var nodeData = this._modelBin.readNodeData(i);

            nodeInfo[0] = i;
            nodeInfo[1] = nodeData[1]; // mesh
            nodeInfo[2] = (nodeData[0] & 0xffff);  // material and ...
            nodeInfo[2] |= 0x80000000; // valid, 31
            nodeInfo[2] |= (((nodeData[2] >> 30) & 0x1)? 0x40000000 : 0x00000000); // identity
            //nodeInfo[2] |= 0x30000000; // instanced (1 instanced, 3 instance confirmed)
            
            nodeInfo[2] |= (((nodeData[2] >> 25) & 0x0f) << 24); // region
            
            nodeInfo[3] = -1; // next
            //nodeInfo[6] = 0; // temp1, output: the children length for instance, indicesOffset for merged
            //nodeInfo[7] = 0; // temp2, merging: the original mesh mem cost, output: indicesCount
                    
            var meshData = this._modelBin.readMesh(nodeInfo[1]);

            nodeInfo[4] = meshData[2]; // merging: vertices bytes, output: vertices count of this node
            nodeInfo[5] = meshData[4]; // merging: indices bytes
            nodeInfo[8] = (meshData[0] & 0xffff); // index, attribute 
            
            var bufferIndex = (meshData[0] >> 16);
            this._buffersNodes[bufferIndex].push(i);
            if (this._study) {
                meshesNodes[nodeData[1]]++;
            }
        
            if (this._study && meshData[2] + meshData[4] > this._stats.meshMaxBytes) {
                this._stats.meshMaxBytes = meshData[2] + meshData[4];
            }
        }

        if (this._study) {
            for (var i = 0; i < this._stats.meshes; i++) {
                if (meshesNodes[i] <= 1) {
                    this._stats.meshesNodes[0]++;
                } else if (meshesNodes[i] <= 10) {
                    this._stats.meshesNodes[1]++;
                } else if (meshesNodes[i] <= 20) {
                    this._stats.meshesNodes[2]++;
                } else if (meshesNodes[i] <= 30) {
                    this._stats.meshesNodes[3]++;
                } else if (meshesNodes[i] <= 50) {
                    this._stats.meshesNodes[4]++;
                } else if (meshesNodes[i] <= 100) {
                    this._stats.meshesNodes[5]++;
                } else if (meshesNodes[i] <= 200) {
                    this._stats.meshesNodes[6]++;
                } else if (meshesNodes[i] <= 500) {
                    this._stats.meshesNodes[7]++;
                } else {
                    this._stats.meshesNodes[8]++;
                } 
            }
        }

        // If the total mesh size is greater than 500MB, we create instances before
        // merging them, otherwise we simply try to merge them in an optimal way.
        //if (meshBinBytes > 500 * 1024 * 1024) {
        //    for (var i = 0, len = numBuffers; i < len; i++) {
        //        this._groupNodesByInstance(this._buffersNodes[i]);
        //    }
        //    // Inside createInstances, we create merges as well.
        //    this._createInstances();
        //    
        //} else {

            for (var i = 0, len = numBuffers; i < len; i++) {
                this._groupNodesByMaterial(this._buffersNodes[i]);
            }

            this._createMerges(new Uint32Array(numBuffers),
                    Globals.gpuMemory * 1024 * 1024);
        //}
            
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
                var nodeInfo = new Int32Array(this._nodesInfo.buffer, 4 * bufferNodes[j] * NODEINFO_INT32, NODEINFO_INT32);

                if (nodeInfo[2] & 0x80000000) { // only for valid
                    var verticesBytes = nodeInfo[4];
                    var indicesBytes = nodeInfo[5];
                    var attributes = this._attributesData[(nodeInfo[8] >> 8) & 0xff];
                    var vertices = verticesBytes / attributes.values[0].stride;

                    if (this._compressNormal && attributes.hasNormal) {
                        verticesBytes = vertices * (attributes.values[0].stride - 4);
                    }

                    // Add the vertex visible/material bytes for each mesh 
                    verticesBytes += vertices;

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
        
        if (this._study) {
            console.log(this._stats);
            var totalNodes = 0, totalValid = 0;
            for (var k = 0; k < this._buffersNodes.length; k++) {
                var bufferNodes = this._buffersNodes[k];
                
                var v = 0;
                for (var i = 0, len = bufferNodes.length; i < len; ++i) {
                    var nodeIndex = bufferNodes[i];

                    var nodeInfo = new Int32Array(this._nodesInfo.buffer, 4 * nodeIndex * NODEINFO_INT32, NODEINFO_INT32);
                    if (nodeInfo[2] & 0x80000000) {
                        v++;
                    }
                }
                totalNodes += bufferNodes.length;
                totalValid += v;
                console.log("mesh" + k + ".bin: nodes: " + bufferNodes.length + ", after merged: " + v);
            }
            console.log("Total Nodes: " + totalNodes +  ", Total valid: " + totalValid);
        }
    };
    
    LoadMeshSyncHybrid.prototype._createInstances = function() {
        var memoryBudget = Globals.gpuMemory * 1024 * 1024;
        var maxInstancesPerMeshBin = Math.floor(Globals.maxInstances / this._buffersNodes.length);
        var offsets = [];

        for (var i = 0, len = this._buffersNodes.length; i < len; i++) {
            var bufferNodes = this._buffersNodes[i];
        
            var that = this;

            // Sort nodes in number of instances and mesh size.
            bufferNodes.sort(function(a, b) {
                var addr1 = a * NODEINFO_INT32;
                var addr2 = b * NODEINFO_INT32;

                var instance1 = (that._nodesInfo[addr1 + 2] & 0x10000000);
                var instance2 = (that._nodesInfo[addr2 + 2] & 0x10000000);
                if (instance1 !== instance2) {
                    return instance2 - instance1; // put instance before single
                }
                
                var meshSize1 = that._nodesInfo[addr1 + 4] + that._nodesInfo[addr1 + 5];
                var meshSize2 = that._nodesInfo[addr2 + 4] + that._nodesInfo[addr2 + 5];
                var nodes1 = that._nodesInfo[addr1 + 6];
                var nodes2 = that._nodesInfo[addr2 + 6];
                
                return meshSize1 * (nodes1 + 1) - meshSize2 * (nodes2 + 1);
            });

            var end = Math.min(bufferNodes.length, maxInstancesPerMeshBin + 1);
            for (var j = 0; j < end; ++j) {
                var nodeIndex = bufferNodes[j];
                var addr = nodeIndex * NODEINFO_INT32;
                if (!(this._nodesInfo[addr + 2] & 0x10000000)) { // not an instance
                    break;
                }
                
                var bytes = this._nodesInfo[addr + 4] + this._nodesInfo[addr + 5]; // vbytes + ibytes
                memoryBudget -= bytes;

                this._nodesInfo[addr + 2] |= 0x30000000;
                var next = this._nodesInfo[addr + 3];
                
                // Find out all instances with this kind, and upgrade their instance flag.
                while (next >= 0) {
                    this._nodesInfo[next * NODEINFO_INT32 + 2] |= 0x30000000;
                    next = this._nodesInfo[next * NODEINFO_INT32 + 3];
                }
            }

            if (this._study) {
                this._stats.instancedDrawcalls += j;
            }

            // Cancel the rest instanced nodes.
            for (var k = 0, len1 = bufferNodes.length; k < len1; k++) {
                var nodeIndex = bufferNodes[k];
                
                // All instanced should be canceled.
                var addr = nodeIndex * NODEINFO_INT32;
                if ((this._nodesInfo[addr + 2] & 0x30000000) === 0x10000000) {
                    var next = this._nodesInfo[addr + 3]; //get next first
                    this._nodesInfo[addr + 3] = -1; // remove the node from children list
                    this._nodesInfo[addr + 2] &= ~0x30000000; // instance = false;
                    this._nodesInfo[addr + 2] |= 0x80000000; // valid = true
                    this._nodesInfo[addr + 6]  = 0; //no more children
                
                    while (next >= 0) {
                        addr = next * NODEINFO_INT32;
                        next = this._nodesInfo[addr + 3];
                        this._nodesInfo[addr + 3] = -1; // remove the node from children list
                        this._nodesInfo[addr + 2] &= ~0x30000000; // instance = false;
                        this._nodesInfo[addr + 2] |= 0x80000000; // valid = true
                        this._nodesInfo[addr + 6]  = 0; //no more children
                    }
                        
                }
            }

            // Sort nodes in number of instances and mesh size.
            bufferNodes.sort(function(a, b) {
                var addr1 = a * NODEINFO_INT32;
                var addr2 = b * NODEINFO_INT32;

                var instance1 = (that._nodesInfo[addr1 + 2] & 0x30000000);
                var instance2 = (that._nodesInfo[addr2 + 2] & 0x30000000);
                if (instance1 !== instance2) {
                    return instance2 - instance1; // put instance before single
                }
                
                var meshSize1 = that._nodesInfo[addr1 + 4] + that._nodesInfo[addr1 + 5];
                var meshSize2 = that._nodesInfo[addr2 + 4] + that._nodesInfo[addr2 + 5];
                var nodes1 = that._nodesInfo[addr1 + 6];
                var nodes2 = that._nodesInfo[addr2 + 6]; 
                
                return meshSize1 * (nodes1 + 1) - meshSize2 * (nodes2 + 1);
            });

            var k = 0;
            for (k = 0, len1 = bufferNodes.length; k < len1; k++) {
                var nodeIndex = bufferNodes[k];
                if (!(this._nodesInfo[nodeIndex * NODEINFO_INT32 + 2] & 0x30000000)) { //not instanced
                    break;
                }
            }
            // Now k points to the first non-instanced node.
            if (k < bufferNodes.length) {
                this._groupNodesByMaterial(bufferNodes.slice(k));
            }

            offsets.push(k);
        }
            
        this._createMerges(offsets, memoryBudget);
    };

    // Combine nodes together if they use the same material
    LoadMeshSyncHybrid.prototype._groupNodesByMaterial = function(bufferNodes) {
        if (bufferNodes.length <= 1) {
            return ;
        }

        var that = this;

        bufferNodes.sort(function(a, b) {
            var addr1 = a * NODEINFO_INT32;
            var addr2 = b * NODEINFO_INT32;

            var material1 = (that._nodesInfo[addr1 + 2] & 0xffff);
            var material2 = (that._nodesInfo[addr2 + 2] & 0xffff);
            if (material1 !== material2) {
                return material1 - material2;
            }

            var attribute1 = ((that._nodesInfo[addr1 + 8] >> 8) & 0xff);
            var attribute2 = ((that._nodesInfo[addr2 + 8] >> 8) & 0xff);
            return attribute1 - attribute2;
        });

        var addr = bufferNodes[0] * NODEINFO_INT32;
        var currentMaterial   = (this._nodesInfo[addr + 2] & 0xffff); 
        var currentAttribute  = ((this._nodesInfo[addr + 8] >> 8) & 0xff); 

        var nodesGroup = [bufferNodes[0]];
        for (var i = 1, len = bufferNodes.length; i < len; ++i) {
            addr = bufferNodes[i] * NODEINFO_INT32;
            var material  = (this._nodesInfo[addr + 2] & 0xffff); 
            var attribute = ((this._nodesInfo[addr + 8] >> 8) & 0xff); 
            var indexType = (this._nodesInfo[addr + 8] & 0xff); 

            if (indexType > 2                  ||
                material !== currentMaterial   ||
                attribute !== currentAttribute ||
                false) {
                this._splitNodesGroup(nodesGroup);
                nodesGroup = [bufferNodes[i]];
                
                currentMaterial  = material;
                currentAttribute = attribute;
            } else {
                nodesGroup.push(bufferNodes[i]);
            }
        }
        this._splitNodesGroup(nodesGroup);
    };
    
    LoadMeshSyncHybrid.prototype._groupNodesByInstance = function(bufferNodes) {
        if (bufferNodes.length <= 1) {
            return ;
        }

        var that = this;
        bufferNodes.sort(function(a, b) {
            var ret = 0;
                
            var addr1 = a * NODEINFO_INT32;
            var addr2 = b * NODEINFO_INT32;

            var mesh1 = that._nodesInfo[addr1 + 1];
            var mesh2 = that._nodesInfo[addr2 + 1];
            ret = mesh1 - mesh2;
            if (ret !== 0) {
                return ret;
            }

            var material1 = (that._nodesInfo[addr1 + 2] & 0xffff);
            var material2 = (that._nodesInfo[addr2 + 2] & 0xffff);
            return material1 - material2;
        });

        var addr = bufferNodes[0] * NODEINFO_INT32;
        var currentMaterial   = (this._nodesInfo[addr + 2] & 0xffff); 
        var currentMesh       = this._nodesInfo[addr + 1];

        var prevNode = bufferNodes[0];
        var headNode = bufferNodes[0];
        this._nodesInfo[addr + 2] |= 0x10000000; 
        
        for (var i = 1, len = bufferNodes.length; i < len; ++i) {
            addr = bufferNodes[i] * NODEINFO_INT32;
            var material = (this._nodesInfo[addr + 2] & 0xffff); 
            var mesh     = this._nodesInfo[addr + 1];

            if (material !== currentMaterial    ||
                mesh !== currentMesh            ||
                false) {
                headNode         = bufferNodes[i];
                currentMaterial  = material;
                currentMesh      = mesh;
                prevNode         = bufferNodes[i];
                //instanced = 1
                this._nodesInfo[addr + 2] |= 0x10000000; 
            } else {
                // valid = false
                this._nodesInfo[addr + 2] &= ~0x80000000; 
                // add node to the master node's children.
                this._nodesInfo[prevNode * NODEINFO_INT32 + 3] = bufferNodes[i];
                
                this._nodesInfo[headNode * NODEINFO_INT32 + 6]++;
                prevNode = bufferNodes[i];
            }
        }
    };
        
    var MINIMUM_NODES_PERGROUP = 30;
    
    LoadMeshSyncHybrid.prototype._splitNodesGroup = function(nodesGroup) {
        if (nodesGroup.length > 1) {
            this._splitNodesGroupSub(nodesGroup);
        }
    };
    
    LoadMeshSyncHybrid.prototype._splitNodesGroupSub = function(nodesGroup) {
        // Group nodes and each group should not have exceed more than max vertices limit.
        var nodeIndex = nodesGroup[0];
        var prevIndex = nodeIndex;
        var headIndex = nodeIndex;

        var addr = nodeIndex * NODEINFO_INT32; 
        this._nodesInfo[addr + 2] |= 0x80000000; // valid = true

        var currentBytes = this._nodesInfo[addr + 4]; // vertices bytes
        var attribute = ((this._nodesInfo[addr + 8] >> 8)  & 0xff);
        var maxBytes = this._attributesData[attribute].values[0].stride * this._maxVertexNumber;

        for (var j = 1, len1 = nodesGroup.length; j < len1; ++j) {
            nodeIndex = nodesGroup[j];
            var bytes = this._nodesInfo[nodeIndex * NODEINFO_INT32 + 4];
            if (currentBytes + bytes > maxBytes) {
                // FIXME: should already have been inited to 1
                this._nodesInfo[nodeIndex * NODEINFO_INT32 + 2] |= 0x80000000; // valid = true 
                headIndex = nodeIndex;
                currentBytes = bytes;
            } else {
                this._nodesInfo[nodeIndex * NODEINFO_INT32 + 2] &= ~0x80000000; // valid = false
                this._nodesInfo[prevIndex * NODEINFO_INT32 + 3] = nodeIndex;
                this._nodesInfo[headIndex * NODEINFO_INT32 + 6]++;

                currentBytes += bytes;
            }
            prevIndex = nodeIndex;
        }
    };
    
    // Compute the extra memory it consumes if we merge nodes.
    LoadMeshSyncHybrid.prototype._computeMergeInfo = function(nodeIndex, meshes) {
        var addr = nodeIndex * NODEINFO_INT32;
        var attribute = ((this._nodesInfo[addr + 8] >> 8) & 0xff);
        var indexType = (this._nodesInfo[addr + 8] & 0xff); 
        var attributeData = this._attributesData[attribute];
        var stride = attributeData.values[0].stride;
        
        var bytes = 0;
        var verticesBytes1 = this._nodesInfo[addr + 4];
        var indicesBytes1 = this._nodesInfo[addr + 5];
        var mesh = this._nodesInfo[addr + 1];
        if (!meshes[mesh]) {
            meshes[mesh] = 1;

            bytes += verticesBytes1 + indicesBytes1;
        } 
        var verticesBytes = verticesBytes1;
        var indices = indicesBytes1 / indexType;

        var next = this._nodesInfo[addr + 3];
        
        while (next >= 0) {
            addr = next * NODEINFO_INT32;
            verticesBytes1 = this._nodesInfo[addr + 4];
            indicesBytes1  = this._nodesInfo[addr + 5];
            indexType = (this._nodesInfo[addr + 8] & 0xff); 
            mesh = this._nodesInfo[addr + 1];
            if (!meshes[mesh]) {
                meshes[mesh] = 1;
                bytes += verticesBytes1 + indicesBytes1;
            }
            
            verticesBytes += verticesBytes1;
            indices += indicesBytes1 / indexType;
            next = this._nodesInfo[addr + 3];
        }

        var vertices = verticesBytes / stride;

        // Update index type.
        indexType = 1;
        if (vertices > 65536) {
            indexType = 4;
        } else if (vertices > 256) {
            indexType = 2;
        } 

        var addr = nodeIndex * NODEINFO_INT32;

        this._nodesInfo[addr + 4] = verticesBytes;
        this._nodesInfo[addr + 5] = indices * indexType;
        this._nodesInfo[addr + 7] = bytes;
        this._nodesInfo[addr + 8] = (this._nodesInfo[addr + 8] & 0xffffff00) | indexType;

        if (this._study) {
            this._stats.fullyMergeMemory += 
                this._nodesInfo[addr + 4] + 
                this._nodesInfo[addr + 5];
        }
    };

    LoadMeshSyncHybrid.prototype._deleteMergeInfo = function(nodeIndex, meshes) {
        var addr = nodeIndex * NODEINFO_INT32;
        var nodeInfo = new Int32Array(this._nodesInfo.buffer, nodeIndex * NODEINFO_INT32 * 4, NODEINFO_INT32);
        
        var meshData = this._modelBin.readMesh(nodeInfo[1]);
        this._nodesInfo[addr + 4] = meshData[2];
        this._nodesInfo[addr + 5] = meshData[4];
        this._nodesInfo[addr + 6] = 0;
        this._nodesInfo[addr + 8] = meshData[0];

        while (this._nodesInfo[addr + 3] > 0) {
            var temp = this._nodesInfo[addr + 3];
            this._nodesInfo[addr + 2] |= 0x80000000; // valid = true
            this._nodesInfo[addr + 3] = -1; // remove the child

            addr = temp * NODEINFO_INT32;
        }
    };

    LoadMeshSyncHybrid.prototype._createMerges = function(offsets, memoryBudget) {
        var mergeNodes = [];
        var mergeBytes = 0;

        var minCost = 1024 * 1024 * 1024; 
        
        // flags if this mesh has been used by any nodes.
        var meshes = new Uint8Array(this._meshes);
        for (var i = 0, len = this._buffersNodes.length; i < len; i++) {
            var bufferNodes = this._buffersNodes[i];

            for (var j = offsets[i], len1 = bufferNodes.length; j < len1; ++j) {
                var nodeIndex = bufferNodes[j];
                var addr = nodeIndex * NODEINFO_INT32;

                if (this._nodesInfo[addr + 2] & 0x80000000) { // valid == true
                    if (this._nodesInfo[addr + 3] >= 0) { 
                        this._computeMergeInfo(nodeIndex, meshes);
                        // If the extra memory cost is smaller than 128KB, we simply merge it.
                        var extraMemCost = this._nodesInfo[addr + 4] + this._nodesInfo[addr + 5] -
                            this._nodesInfo[addr + 7];
                        
                        var bytes = this._nodesInfo[addr + 4] + this._nodesInfo[addr + 5];

                        if (extraMemCost < 130000) {
                            if (this._study) {
                                this._stats.simplyMergeMemory += bytes;
                                this._stats.mergedDrawcalls++;
                                this._stats.mergeReducedDrawcalls += this._nodesInfo[addr + 3];
                            }
                            memoryBudget -= bytes;
                        } else {
                            if (minCost > extraMemCost) {
                                minCost = extraMemCost;
                            }

                            memoryBudget -= this._nodesInfo[addr + 7]; // original mesh size
                            mergeNodes.push(nodeIndex);
                            mergeBytes += extraMemCost;
                        }
                        if (this._study) {
                            this._stats.fullyMergedDrawcalls++;
                        }
                    } else {
                        if (!meshes[this._nodesInfo[addr + 1]]) {
                            memoryBudget -= (this._nodesInfo[addr + 4] + this._nodesInfo[addr + 5]);
                            meshes[this._nodesInfo[addr + 1]] = 1;
                        }
                        if (this._study) {
                            this._stats.fullyOrphanDrawcalls++;
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
                var addr = mergeNodes[i] * NODEINFO_INT32;
                this._nodesInfo[addr + 7] = (this._nodesInfo[addr + 4] +
                                             this._nodesInfo[addr + 5] -
                                             this._nodesInfo[addr + 7]) / minCost;
            }

            // Use dynamic programming to solve Knapsack problem.
            // https://www.cnblogs.com/Christal-R/p/Dynamic_programming.html
            var N = mergeNodes.length;
            var C = Math.ceil(memoryBudget / minCost);
            var V = new Uint32Array((N + 1) * (C + 1));

            for (var i = 1; i <= N; i++) {
                var c = this._nodesInfo[mergeNodes[i - 1] * NODEINFO_INT32 + 7];
                var v = this._nodesInfo[mergeNodes[i - 1] * NODEINFO_INT32 + 6];

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
                    var c = that._nodesInfo[mergeNodes[i - 1] * NODEINFO_INT32 + 7];
                    var v = that._nodesInfo[mergeNodes[i - 1] * NODEINFO_INT32 + 6];

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
                if (merges[i]) {
                    var addr = mergeNodes[i] * NODEINFO_INT32;
                    var bytes = this._nodesInfo[addr + 4] + this._nodesInfo[addr + 5];
                    // This Bytes is used for doing the study here, no use
                    
                    if (this._study) {
                        this._stats.mergeMemory += bytes;
                        this._stats.mergedDrawcalls++;
                        // FIXME: it is larger than actual reduce drawcall number as meshes are shared between merge nodes,
                        // and we repeatly count them in.
                        this._stats.mergeReducedDrawcalls += mergeNodes[i];
                    }
                } else {
                    this._deleteMergeInfo(mergeNodes[i], meshes1);
                }
            }
            
            if (this._study) {
                this._stats.mergeMemory += this._stats.simplyMergeMemory;
            }

        } else {
            if (this._study) {
                this._stats.mergeMemory = this._stats.fullyMergeMemory;
            }
        }
    };

    LoadMeshSyncHybrid.prototype.load = function(meshBufferIndex, meshBinary, onNodeDataReady) {

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
            var nodeInfo = new Int32Array(this._nodesInfo.buffer, 4 * nodeIndex * NODEINFO_INT32, NODEINFO_INT32);
            if (nodeInfo[2] & 0x80000000) {
                if (nodeInfo[3] < 0) { // no children
                    var meshData = this._modelBin.readMesh(nodeInfo[1]);
                    var attributeData = this._attributesData[(nodeInfo[8] >> 8) & 0xff];
                    var encodedIndexType = (meshData[0] & 0xff);
            
                    var verticesFloats = meshData[2] / 4;
                    var verticesNumber = meshData[2] / attributeData.values[0].stride;
                    if (this._compressNormal && attributeData.hasNormal) {
                        verticesFloats -= meshData[2] / attributeData.values[0].stride;
                    } 

                    var encodedVertices = new Float32Array(meshBinary, meshData[1], meshData[2] / 4);
                    var vertices = new Float32Array(this._verticesBinary, this._verticesOffset, verticesFloats);
                    UncompressVertices(vertices, encodedVertices, attributeData, this._compressNormal); 

                    var encodedIndices = new Uint8Array(meshBinary, meshData[3], meshData[4]);
                    var indices = new Uint8Array(this._indicesBinary, this._indicesOffset, meshData[4]);
                    UncompressIndices(indices, encodedIndices, meshData[4], 0);

                    nodeInfo[4] = verticesNumber;
                    // Note that since for simple drawable with only one node, we don't need to 
                    // pad the vis/mat vertex attribute as it can be changed in CPU side.

                    this._verticesOffset += verticesFloats * 4;
                    this._indicesOffset += meshData[4];

                    this._verticesOffset = (this._verticesOffset + 3) & (-4);
                    this._indicesOffset = (this._indicesOffset + 3) & (-4);

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
    
    function TransformUncompressVertices1(vertices, encodedVertices, attributeData, translate, compressNormal) {
        var vertexNumber = ((encodedVertices.byteLength / attributeData.values[0].stride) | 0);
        var numFloats = (((attributeData.values[0].stride | 0) >> 2) | 0);
        var totalNumFloats = (((numFloats | 0) * (vertexNumber | 0)) | 0);

        var i;
        if (attributeData.primitive === 4) {
            if (compressNormal) {
                var normals        = new Uint8Array(vertices.buffer, vertices.byteOffset, vertices.byteLength);
                var encodedNormals = new Uint8Array(encodedVertices.buffer, encodedVertices.byteOffset, encodedVertices.byteLength);

                for (i = 0; i < vertexNumber; i++) {
                    var d = i * (numFloats - 1);
                    var s = i * numFloats;
                    // position
                    vertices[d]     = encodedVertices[s] + translate[0];
                    vertices[d + 1] = encodedVertices[s + 1] + translate[1];
                    vertices[d + 2] = encodedVertices[s + 2] + translate[2];

                    // normal
                    d = (d << 2);
                    s = (s << 2);
                    normals[d]     = encodedNormals[s + 12];
                    normals[d + 4] = encodedNormals[s + 13];
                    normals[d + 8] = encodedNormals[s + 14];
                } 
                
                if (attributeData.values.length > 2) {
                    if (attributeData.values[2].index === 4) { // texcoord 
                        for (i = 0; i < vertexNumber; i++) {
                            var s = i * 6 + 4;
                            var d = i * 5 + 3;
                            vertices[d]     = encodedVertices[s];
                            vertices[d + 1] = encodedVertices[s + 1];
                        }
                    } else { // vertex color
                        for (i = 0; i < vertexNumber; i++) {
                            var s = i * 5 + 4;
                            var d = i * 4 + 3;
                            vertices[d] = encodedVertices[s];
                        }
                    }
                }
            } else {
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
            }

        } else {
            for (i = 0; i < totalNumFloats; i += 3) {
                vertices[i]     = encodedVertices[i] + translate[0];
                vertices[i + 1] = encodedVertices[i + 1] + translate[1];
                vertices[i + 2] = encodedVertices[i + 2] + translate[2];
            }
        }
    };

    function TransformUncompressVertices2(vertices, encodedVertices, attributeData, scale, translate, compressNormal) {
        var vertexNumber = ((encodedVertices.byteLength / attributeData.values[0].stride) | 0);
        var numFloats = (((attributeData.values[0].stride | 0) >> 2) | 0);
        var totalNumFloats = (((numFloats | 0) * (vertexNumber | 0)) | 0);

        var i;
        if (attributeData.primitive === 4) {
            var normals        = new Uint8Array(vertices.buffer, vertices.byteOffset, vertices.byteLength);
            var encodedNormals = new Uint8Array(encodedVertices.buffer, encodedVertices.byteOffset, encodedVertices.byteLength);

            // If it is a uniform scaling
            // FIXME: if the scaling is negative.
            if (scale[0] === scale[1] && scale[1] === scale[2]) {
                if (compressNormal) {
                    for (i = 0; i < vertexNumber; i++) {
                        var d = i * (numFloats - 1);
                        var s = i * numFloats;
                        // position
                        vertices[d]     = encodedVertices[s] * scale[0] + translate[0];
                        vertices[d + 1] = encodedVertices[s + 1] * scale[1] + translate[1];
                        vertices[d + 2] = encodedVertices[s + 2] * scale[2] + translate[2];

                        // normal
                        d = (d << 2);
                        s = (s << 2);
                        normals[d]     = encodedNormals[s + 12];
                        normals[d + 4] = encodedNormals[s + 13];
                        normals[d + 8] = encodedNormals[s + 14];
                    } 
                } else {
                    for (i = 0; i < totalNumFloats; i += numFloats) {
                        // position
                        vertices[i]     = encodedVertices[i] * scale[0] + translate[0];
                        vertices[i + 1] = encodedVertices[i + 1] * scale[1] + translate[1];
                        vertices[i + 2] = encodedVertices[i + 2] * scale[2] + translate[2];

                        // normal
                        vertices[i + 3] = encodedVertices[i + 3];
                    } 
                }
            } else {
                var n = tempVector31;
                var invScale = tempVector32;

                invScale[0] = 1.0 / scale[0];
                invScale[1] = 1.0 / scale[1];
                invScale[2] = 1.0 / scale[2];
            
                if (compressNormal) {
                    for (i = 0; i < vertexNumber; i++) {
                        var d = i * (numFloats - 1);
                        var s = i * numFloats;
                        // position
                        vertices[d]     = encodedVertices[s] * scale[0] + translate[0];
                        vertices[d + 1] = encodedVertices[s + 1] * scale[1] + translate[1];
                        vertices[d + 2] = encodedVertices[s + 2] * scale[2] + translate[2];

                        // normal
                        d = (d << 2);
                        s = (s << 2);
                        var normal0 = encodedNormals[s + 12];
                        var normal1 = encodedNormals[s + 13];
                        var normal2 = encodedNormals[s + 14];

                        n[0] = normal0 * invScale[0];
                        n[1] = normal1 * invScale[1];
                        n[2] = normal2 * invScale[2];

                        var inv = 127.0 / Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
                        
                        index = i << 2;
                        normals[d]     = n[0] * inv;
                        normals[d + 4] = n[1] * inv;
                        normals[d + 8] = n[2] * inv;
                    }
                } else {
                    for (i = 0; i < totalNumFloats; i += numFloats) {
                        // position
                        vertices[i]     = encodedVertices[i] * scale[0] + translate[0];
                        vertices[i + 1] = encodedVertices[i + 1] * scale[1] + translate[1];
                        vertices[i + 2] = encodedVertices[i + 2] * scale[2] + translate[2];

                        // normal
                        var index = (i << 2) + 12;
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
            }
            
            if (attributeData.values.length > 2) {
                if (compressNormal) {
                    if (attributeData.values[2].index === 4) { // texcoord 
                        for (i = 0; i < vertexNumber; i++) {
                            var s = i * 6 + 4;
                            var d = i * 5 + 3;
                            vertices[d]     = encodedVertices[s];
                            vertices[d + 1] = encodedVertices[s + 1];
                        }
                    } else { // vertex color
                        for (i = 0; i < vertexNumber; i++) {
                            var s = i * 5 + 4;
                            var d = i * 4 + 3;
                            vertices[d] = encodedVertices[s];
                        }
                    }
                } else {
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
    
    function TransformUncompressVertices3(vertices, encodedVertices, attributeData, transform, compressNormal) {
        var vertexNumber = ((encodedVertices.byteLength / attributeData.values[0].stride) | 0);
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
                
            var encodedNormals = new Int8Array(encodedVertices.buffer, encodedVertices.byteOffset, totalNumFloats * 4);
            var normals = new Int8Array(vertices.buffer, vertices.byteOffset, vertices.byteLength);

            if (compressNormal) {

                for (i = 0; i < vertexNumber; i++) {
                    var d = i * (numFloats - 1);
                    var s = i * numFloats;
                    // position
                    var x = encodedVertices[s];
                    var y = encodedVertices[s + 1];
                    var z = encodedVertices[s + 2];

                    var nx = m0 * x + m4 * y + m8 * z + m12;
                    var ny = m1 * x + m5 * y + m9 * z + m13;
                    var nz = m2 * x + m6 * y + m10 * z + m14;

                    vertices[d]     = nx;
                    vertices[d + 1] = ny;
                    vertices[d + 2] = nz;

                    // normal
                    d = (d << 2);
                    s = (s << 2);
                    var normal0 = encodedNormals[s + 12];
                    var normal1 = encodedNormals[s + 13];
                    var normal2 = encodedNormals[s + 14];

                    n[0] = m0 * normal0 + m4 * normal1 + m8 * normal2;
                    n[1] = m1 * normal0 + m5 * normal1 + m9 * normal2;
                    n[2] = m2 * normal0 + m6 * normal1 + m10 * normal2;

                    var inv = 127.0 / Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
                    
                    normals[d]     = n[0] * inv;
                    normals[d + 4] = n[1] * inv;
                    normals[d + 8] = n[2] * inv;
                } 
                
                if (attributeData.values.length > 2) {
                    if (attributeData.values[2].index === 4) { // texcoord 
                        for (i = 0; i < vertexNumber; i++) {
                            var s = i * 6 + 4;
                            var d = i * 5 + 3;
                            vertices[d]     = encodedVertices[s];
                            vertices[d + 1] = encodedVertices[s + 1];
                        }
                    } else { // vertex color
                        for (i = 0; i < vertexNumber; i++) {
                            var s = i * 5 + 4;
                            var d = i * 4 + 3;
                            vertices[d] = encodedVertices[s];
                        }
                    }
                }

            } else {

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
                    var index = (i << 2) + 12;
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
        
        if (attributeData.primitive === 4) {
            if (compressNormal) {
                var encodedNormals = new Int8Array(encodedVertices.buffer, encodedVertices.byteOffset, encodedVertices.byteLength);
                var normals = new Int8Array(vertices.buffer, vertices.byteOffset, vertices.byteLength);
                for (i = 0; i < vertexNumber; i++) {
                    var d = i * (numFloats - 1);
                    var s = i * numFloats;
                    // position
                    vertices[d]     = encodedVertices[s];
                    vertices[d + 1] = encodedVertices[s + 1];
                    vertices[d + 2] = encodedVertices[s + 2]; 

                    // normal
                    d = (d << 2);
                    s = (s << 2);
                    normals[d]     = encodedNormals[s + 12];
                    normals[d + 4] = encodedNormals[s + 13];
                    normals[d + 8] = encodedNormals[s + 14];
                }
                
                if (attributeData.values.length > 2) {
                    if (attributeData.values[2].index === 4) { // texcoord 
                        for (i = 0; i < vertexNumber; i++) {
                            var s = i * 6 + 4;
                            var d = i * 5 + 3;
                            vertices[d]     = encodedVertices[s];
                            vertices[d + 1] = encodedVertices[s + 1];
                        }
                    } else { // vertex color
                        for (i = 0; i < vertexNumber; i++) {
                            var s = i * 5 + 4;
                            var d = i * 4 + 3;
                            vertices[d]     = encodedVertices[s];
                        }
                    }
                }
            } else {

                for (i = 0; i < totalNumFloats; i += numFloats) {
                    // position
                    vertices[i]     = encodedVertices[i];
                    vertices[i + 1] = encodedVertices[i + 1];
                    vertices[i + 2] = encodedVertices[i + 2]; 

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

    LoadMeshSyncHybrid.prototype._populateInstancedNode = function(nodeInfo) {
        var nodeBBoxData = this._modelBin.readNodeBBox(nodeInfo[0]);
        
        var addr = nodeInfo[3] * NODEINFO_INT32;
        while (this._nodesInfo[addr + 3] >= 0) {
            var bboxData = this._modelBin.readNodeBBox(this._nodesInfo[addr]);
            UnionBBox(nodeBBoxData, bboxData);

            addr = this._nodesInfo[addr + 3] * NODEINFO_INT32;
        }
    };
    
    LoadMeshSyncHybrid.prototype._populateMergedNode = function(nodeInfo, meshBinary) {
        var attributeData = this._attributesData[(nodeInfo[8] >> 8) & 0xff];

        var baseIndicesOffset = this._indicesOffset;

        var indexTypeAttribute = nodeInfo[8];
        
        var nodeBBoxData = this._modelBin.readNodeBBox(nodeInfo[0]);
        var indexType = (nodeInfo[8] & 0xff);

        var nodes = [];
        var childNodeIndex = nodeInfo[0];
        while (childNodeIndex >= 0) {
            nodes.push(childNodeIndex);
            childNodeIndex = this._nodesInfo[childNodeIndex * NODEINFO_INT32 + 3];
        }

        var that = this;
        // Sort the nodes in the ascending order of rendering importance (region + bbox)
        nodes.sort(function(a, b) {
            var region1 = ((that._nodesInfo[a * NODEINFO_INT32 + 2] >> 24) & 0x0f); 
            var region2 = ((that._nodesInfo[b * NODEINFO_INT32 + 2] >> 24) & 0x0f); 

            return region1 - region2; // The smaller region value is, the more important it is.
        });

        // The current vertices number.
        var vertexNumber = 0;
        for (var i = 0, len = nodes.length; i < len; i++) {
            var nodeData = new Int32Array(this._nodesInfo.buffer, 4 * NODEINFO_INT32 * nodes[i], NODEINFO_INT32);
            
            var transformData   = this._modelBin.readNodeTransform(nodeData[0]);
            var bboxData        = this._modelBin.readNodeBBox(nodeData[0]);

            var meshData        = this._modelBin.readMesh(nodeData[1]);
            var encodedVertices = new Float32Array(meshBinary, meshData[1], meshData[2] / 4);

            var verticesFloats = meshData[2] / 4;
            if (this._compressNormal && attributeData.hasNormal) {
                verticesFloats -= meshData[2] / attributeData.values[0].stride;;
            } 
                
            var vertices = new Float32Array(this._verticesBinary, this._verticesOffset, verticesFloats);

            if ((nodeData[2] & 0x40000000) === 0) {
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
            nodeData[6] = this._indicesOffset - baseIndicesOffset;
            nodeData[7] = numIndices;
            nodeData[4] = meshData[2] / attributeData.values[0].stride;;

            vertexNumber += nodeData[4];
            this._indicesOffset += numIndices * indexType;
        }
        // Add the vertex material/visiblity bytes to the end of vertices buffer of each mesh.
        var mvBytes = new Uint8Array(this._verticesBinary, this._verticesOffset, vertexNumber);
        for (var i = 0; i < vertexNumber; i++) {
            mvBytes[i] = 0;
        }
        this._verticesOffset += vertexNumber;

        // Re-order the nodes in the list according to the previous sorting result.
        for (var i = 0, len = nodes.length - 1; i < len; i++) {
            var nodeIndex = nodes[i];
            this._nodesInfo[nodeIndex * NODEINFO_INT32 + 3] = nodes[i + 1];
        }
        var nodeIndex = nodes[i];
        this._nodesInfo[nodeIndex * NODEINFO_INT32 + 3] = -1;

        // Fetch the first node information. 
        nodeInfo = new Int32Array(this._nodesInfo.buffer, nodes[0] * NODEINFO_INT32 * 4, NODEINFO_INT32);

        // Since the first node of the node list of the merge node has changed, we should update its
        // information for the merge node.

        // Update the bbox of the first node to merged bbox.
        var nodeBBoxData1 = this._modelBin.readNodeBBox(nodeInfo[0]);
        nodeBBoxData1[0] = nodeBBoxData[0];
        nodeBBoxData1[1] = nodeBBoxData[1];
        nodeBBoxData1[2] = nodeBBoxData[2];
        nodeBBoxData1[3] = nodeBBoxData[3];
        nodeBBoxData1[4] = nodeBBoxData[4];
        nodeBBoxData1[5] = nodeBBoxData[5];
        
        // Set the attribute and index type
        nodeInfo[8] = indexTypeAttribute;
        // It is a new mesh.
        nodeInfo[1] = -1; 
        // Remove the transform
        nodeInfo[2] |= 0x40000000;
        // The output vertex number
        nodeInfo[4] = vertexNumber;

        return nodeInfo;
    };
    
    return LoadMeshSyncHybrid;
    
})();
    

