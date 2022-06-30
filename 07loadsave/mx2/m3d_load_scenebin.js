//
// m3d_load_scenebin.js
// Parse scene.bin in MX 2.0
//
//  


import Globals        from "../../m3d_globals.js";

export default (function() {
    "use strict";
    
    function SceneBinLoader(sceneJson, sceneBin) {
        this._sceneJson = null;
        this._sceneBin  = null;

        this._viewLocations      = new Array(sceneJson.views.length);
        this._samplersLocation   = 0;
        this._texturesLocation   = 0;
        this._materialsLocation  = 0;
        this._attributesLocation = 0;
        this._meshesLocation     = 0;
        this._layerLocations     = new Array(sceneJson.layers.length);
        this._nodesLocation      = 0;

        this._initialize(sceneJson, sceneBin);
    };
    
    SceneBinLoader.prototype.destroy = function() {
        this._sceneBin  = null;
        this._sceneJson = null;
        delete this._sceneBin;
        delete this._sceneJson;

        this._viewLocations      = null;
        this._samplersLocation   = null;
        this._texturesLocation   = null;
        this._materialsLocation  = null;
        this._attributesLocation = null;
        this._meshesLocations    = null;
        this._layerLocations     = null;
        this._nodesLocation      = null;
        delete this._viewLocations;
        delete this._samplersLocation;
        delete this._texturesLocation;
        delete this._materialsLocation;
        delete this._attributesLocation;
        delete this._meshesLocations;
        delete this._layerLocations;
        delete this._nodesLocation;
    };

    var UINT32  = 4;
    var FLOAT32 = 4;
    var INT32   = 4;
    var UINT8   = 1;
        
    SceneBinLoader.prototype._initialize = function(sceneJson, sceneBin) {
        this._sceneJson = sceneJson;
        this._sceneBin  = sceneBin;
        
        var offset = 0;

        if (sceneJson.samplers.length > 0) {
            this._samplersLocation = offset;

            offset += sceneJson.samplers.length * (4 * UINT8);
        }
        
        if (sceneJson.textures.length > 0) {
            this._texturesLocation = offset;

            offset += sceneJson.textures.length * (4 * UINT8);
        }

        if (sceneJson.materials.length > 0) {
            this._materialsLocation = offset;

            offset += sceneJson.materials.length * (16 * UINT8);
        }

        if (sceneJson.attributes.length > 0) {
            this._attributesLocation = offset;

            offset += sceneJson.attributes.length * (8 * UINT8);
        }

        if (sceneJson.buffers.length > 0) {
            this._meshesLocation = offset;
            var numMeshes = 0;
            for (var i = 0, len = sceneJson.buffers.length; i < len; ++i) {
                numMeshes += sceneJson.buffers[i].meshes;
            }
            offset += numMeshes * (UINT32 * 5);
        }
        
        this._nodesLocation = offset;
        offset += sceneJson.scene.nodes * (FLOAT32 * 21);

        if (sceneJson.layers.length > 0) {
            this._layerLocations[0] = offset;
            var numNodes = sceneJson.layers[0].nodes;
            for (var i = 1, len = sceneJson.layers.length; i < len; ++i) {
                this._layerLocations[i] = this._layerLocations[i - 1] + 
                    sceneJson.layers[i - 1].nodes * UINT32;
                numNodes += sceneJson.layers[i].nodes;
            }
            offset += numNodes * UINT32;
        }

        if (sceneJson.views.length > 0) {
            this._viewLocations[0] = offset;

            for (var i = 1, len = sceneJson.views.length; i < len; ++i) {
                var viewInfo = sceneJson.views[i - 1];
                this._viewLocations[i] = this._viewLocations[i - 1] + 
                    7 * FLOAT32 + viewInfo.nodes * UINT32 + viewInfo.layers * UINT32;
            }
        }
    };
    
    // uint8array(4)
    // linear: uint8,
    // repeat: uint8,
    // mipmap: uint8
    // padding: uint8
    SceneBinLoader.prototype.readSampler = function(index) {
        return new Uint8Array(this._sceneBin, this._samplersLocation + index * UINT8 * 4, 4);
    };
    
    // uint8array(4)
    // nchannels: uint8
    // sampler: uint8
    // alphaMask: uint8
    // padding: uint8
    SceneBinLoader.prototype.readTexture = function(index) {
        return new Uint8Array(this._sceneBin, this._texturesLocation + index * UINT8 * 4, 4);
    };
    
    // uint8array(16)
    // kd: uint8 * 3
    // transparent: uint8
    // diffuse texture: int16
    // placeholder0: int16
    // placeholder1: float32
    // placeholder2: float32
    SceneBinLoader.prototype.readMaterial = function(index) {
        return new Uint8Array(this._sceneBin, this._materialsLocation + index * UINT8 * 16, 16);
    };
    
    // int8array(8)
    // primitive: int8 (0, 1, 4 - points, lines, triangles)
    // normal: int8
    // uv: int8
    // color: int8
    // padding: int8
    // padding: int8
    // padding: int8
    // padding: int8
    SceneBinLoader.prototype.readAttribute = function(index) {
        return new Int8Array(this._sceneBin, this._attributesLocation + index * UINT8 * 8, 8);
    };
    
    // uint32array(5)
    // attribute: uint16
    // indextype: uint16
    // verticesOffset: uint32
    // verticesBytes: uint32
    // indicesOffset: uint32
    // indicesBytes: uint32
    SceneBinLoader.prototype.readMesh = function(meshIndex) {
        return new Uint32Array(this._sceneBin, this._meshesLocation + meshIndex * UINT32 * 5, 5);
    };
    
    // uint32array(3)
    // material:      uint16
    // layer:         uint16
    // mesh:          uint32
    // flags:         uint32 (31: billboard, 30: identity, 29: mergible)
    SceneBinLoader.prototype.readNodeData = function(index) {
        return new Uint32Array(this._sceneBin, this._nodesLocation + index * UINT32 * 21, 3);
    };

    // float32array(6)
    SceneBinLoader.prototype.readNodeBBox = function(index) {
        return new Float32Array(this._sceneBin, this._nodesLocation + (index * 21 + 3) * FLOAT32, 6);
    };

    // float32array(12)
    SceneBinLoader.prototype.readNodeTransform = function(index) {
        return new Float32Array(this._sceneBin, this._nodesLocation + (index * 21 + 9) * FLOAT32, 12);
    };
    
    // uint32array(numNodes)
    SceneBinLoader.prototype.readLayerNodes = function(index) {
        var numNodes = this._sceneJson.layers[index].nodes;
        if (numNodes > 0) {
            return new Uint32Array(this._sceneBin, this._layerLocations[index], numNodes);
        }

        return null;
    };

    // {
    //  "height": 0
    //  "at":[3.845837, 2.172731, 0.134048],
    //  "distance":6.756883,
    //  "phi":1.125090,
    //  "theta":1.670229,
    // }
    var orthoViewData = {
        "height": 0,
        "at" : [0, 0, 0],
        "distance": 0,
        "phi": 0,
        "theta": 0
    };
    // {
    //  "fov":35.000000,
    //  "at":[3.845837, 2.172731, 0.134048],
    //  "distance":6.756883,
    //  "phi":1.125090,
    //  "theta":1.670229,
    // }
    var perspViewData = {
        "fov": 0,
        "at" : [0, 0, 0],
        "distance": 0,
        "phi": 0,
        "theta": 0
    };
    SceneBinLoader.prototype.readViewData = function(index) {
        var viewBin = new Float32Array(this._sceneBin, this._viewLocations[index], 7);
        var viewInfo = this._sceneJson.views[index];

        if (viewInfo.perspective) {
            perspViewData.fov      = viewBin[0];
            perspViewData.at[0]    = viewBin[1];
            perspViewData.at[1]    = viewBin[2];
            perspViewData.at[2]    = viewBin[3];
            perspViewData.distance = viewBin[4];
            perspViewData.phi      = viewBin[5];
            perspViewData.theta    = viewBin[6];

            return perspViewData;
        } 

        orthoViewData.height   = viewBin[0];
        orthoViewData.at[0]    = viewBin[1];
        orthoViewData.at[1]    = viewBin[2];
        orthoViewData.at[2]    = viewBin[3];
        orthoViewData.distance = viewBin[4];
        orthoViewData.phi      = viewBin[5];
        orthoViewData.theta    = viewBin[6];

        return orthoViewData;
    };

    // uint32array(numLayers)
    SceneBinLoader.prototype.readViewLayers = function(index) {
        var numLayers = this._sceneJson.views[index].layers;
        if (numLayers > 0) {
            var offset = this._viewLocations[index] + 7 * FLOAT32;
            return new Uint32Array(this._sceneBin, offset, numLayers);
        }
        return null;
    };

    // uint32array(numNodes)
    SceneBinLoader.prototype.readViewNodes = function(index) {
        var numNodes = this._sceneJson.views[index].nodes;
        if (numNodes > 0) {
            var numLayers = this._sceneJson.views[index].layers;
            var offset = this._viewLocations[index] + 7 * FLOAT32;
            offset += numLayers * UINT32;
            return new Uint32Array(this._sceneBin, offset, numNodes);
        }
        return null;
    };

    return SceneBinLoader;

})();
