//
// m3d_load_mesh_syncfast.js
// load meshes as they are
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
        this.drawOffset     = 0;
        this.drawCount      = 0;
    };
    
    function LoadMeshSyncFast(sceneData, attributesData, caller) {
        this._nodesInfo       = {};
        this._attributesData  = attributesData;
        this._sceneData       = sceneData;
        this._caller          = caller;
    };
    
    // Initialize the worker thread per every mesh.bin
    LoadMeshSyncFast.prototype.initialize = function() {
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
            nodeInfo.transform = nodeData.transform? ExtendTransform(nodeData.transform) : null;
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
            nodeInfo.transform = nodeData.transform? ExtendTransform(nodeData.transform) : null;
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
    };
    
    LoadMeshSyncFast.prototype.load = function(meshBinaryName, meshBinary) {
        var nodesInfo = this._nodesInfo[meshBinaryName];
        var meshesData = this._sceneData.meshes[meshBinaryName];
        for (var i = 0, len = nodesInfo.length; i < len; ++i) {
            var nodeInfo = nodesInfo[i];
            nodeInfo.meshBinary = meshBinary;
            this._caller.onNodeDataReady(nodeInfo);
        }

        this._caller.onMeshBinaryProcessed();
    };
    
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
    
    return LoadMeshSyncFast;
})();
    


