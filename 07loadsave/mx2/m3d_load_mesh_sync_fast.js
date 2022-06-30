//
// m3d_load_mesh_syncfast.js
// load meshes as they are
//
//  
//

export default (function() {
    "use strict";
    
    function NodeInfo() {
        this.index          = 0;
        this.meshBinary     = null; // The mesh vertices and indices data

        this.verticesOffset = 0;
        this.indicesOffset  = 0;
        this.verticesBytes  = 0;
        this.indicesBytes   = 0;
        this.indexType      = 2;
        this.attribute      = 0;

        this.views          = "";
        this.layer          = 0;    
        this.material       = 0;
        this.mesh           = 0;
        this.billboard      = 1;
        this.identity       = true;
        this.region         = 0;    
    };
    
    function LoadMeshSyncFast(sceneJson, sceneBin, attributesData) {
        this._nodesInfo       = null;
        this._attributesData  = attributesData;
        this._sceneBin        = sceneBin;
        this._sceneJson       = sceneJson;
        
        this._initialize();
    };
    
    LoadMeshSyncFast.prototype.destroy = function() {
        delete this._nodesInfo;
        delete this._attributesData;
        delete this._sceneJson;
        delete this._sceneBin;
    };
    
    // Initialize the worker thread per every mesh.bin
    LoadMeshSyncFast.prototype._initialize = function() {
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
    };
    
    LoadMeshSyncFast.prototype.load = function(meshBufferIndex, meshBinary, onNodeDataReady) {
        var nodesInfo = this._nodesInfo[meshBufferIndex];
        for (var i = 0, len = nodesInfo.length; i < len; ++i) {
            var nodeInfo = nodesInfo[i];
            onNodeDataReady(nodeInfo, meshBinary);
        }
    };
    
    return LoadMeshSyncFast;
})();
    


