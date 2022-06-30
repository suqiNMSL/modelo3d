//
// m3d_load_scenebin.js
// Parse scene.bin in MX 2.0
//
//  


import Globals        from "../../m3d_globals.js";

export default (function() {
    "use strict";
    
    function SceneModelBinLoader(sceneJson, sceneBin, modelJson, modelBin) {
        this._sceneJson = sceneJson;
        this._sceneBin  = sceneBin;
        this._modelJson  = modelJson;
        this._modelBin   = modelBin;

        // inside scene.bin
        this._samplersLocation   = 0;
        this._texturesLocation   = 0;
        this._materialsLocation  = 0;
        this._attributesLocation = 0;
        
        // inside model.bin
        this._meshesLocation     = 0;
        this._nodesLocation      = 0;

        this._initialize(sceneJson, sceneBin, modelJson, modelBin);
    };
    
    SceneModelBinLoader.prototype.destroy = function() {
        this._sceneBin  = null;
        this._sceneJson = null;
        this._modelBin   = null;
        this._modelJson  = null;

        delete this._sceneBin;
        delete this._sceneJson;
        delete this._modelBin;
        delete this._modelJson;

        this._samplersLocation    = null;
        this._texturesLocation    = null;
        this._materialsLocation   = null;
        this._attributesLocation  = null;
        delete this._samplersLocation;
        delete this._texturesLocation;
        delete this._materialsLocation;
        delete this._attributesLocation;

        this._meshesLocations = null;
        this._nodesLocation   = null;
        delete this._meshesLocations;
        delete this._nodesLocation;
    };

    var UINT32  = 4;
    var FLOAT32 = 4;
    var INT32   = 4;
    var UINT8   = 1;
        
    SceneModelBinLoader.prototype._initialize = function(sceneJson, sceneBin, modelJson, modelBin) {
        
        var offset = 0;

        // scene.bin
        
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
        }

        // model.bin
        this._meshesLocation = 8;

        var num = new Uint32Array(modelBin, 0, 2);
        this._nodesLocation = num[0] * (UINT32 * 5) + 8;; // First two uint32 are about #meshes and #nodes

    };
    
    // uint8array(4)
    // linear: uint8,
    // repeat: uint8,
    // mipmap: uint8
    // padding: uint8
    SceneModelBinLoader.prototype.readSampler = function(index) {
        return new Uint8Array(this._sceneBin, this._samplersLocation + index * UINT8 * 4, 4);
    };
    
    // uint8array(4)
    // nchannels: uint8
    // sampler: uint8
    // alphaMask: uint8
    // padding: uint8
    SceneModelBinLoader.prototype.readTexture = function(index) {
        return new Uint8Array(this._sceneBin, this._texturesLocation + index * UINT8 * 4, 4);
    };
    
    // uint8array(16)
    // kd: uint8 * 3
    // transparent: uint8
    // diffuse texture: int16
    // placeholder0: int16
    // placeholder1: float32
    // placeholder2: float32
    SceneModelBinLoader.prototype.readMaterial = function(index) {
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
    SceneModelBinLoader.prototype.readAttribute = function(index) {
        return new Int8Array(this._sceneBin, this._attributesLocation + index * UINT8 * 8, 8);
    };
    
    // uint32array(5)
    // indexType: uint8
    // attribute: uint8
    // meshXXX.bin index: uint16
    // verticesOffset: uint32
    // verticesBytes: uint32
    // indicesOffset: uint32
    // indicesBytes: uint32
    SceneModelBinLoader.prototype.readMesh = function(meshIndex) {
        return new Uint32Array(this._modelBin, this._meshesLocation + meshIndex * UINT32 * 5, 5);
    };
    
    // uint32array(3)
    // material:      uint16
    // layer:         uint16
    // mesh:          uint32
    // flags:         uint32 (31: billboard, 30: identity, 29: mergible, 28-25: region)
    SceneModelBinLoader.prototype.readNodeData = function(index) {
        return new Uint32Array(this._modelBin, this._nodesLocation + index * UINT32 * 21, 3);
    };

    // float32array(6)
    SceneModelBinLoader.prototype.readNodeBBox = function(index) {
        return new Float32Array(this._modelBin, this._nodesLocation + (index * 21 + 3) * FLOAT32, 6);
    };

    // float32array(12)
    SceneModelBinLoader.prototype.readNodeTransform = function(index) {
        return new Float32Array(this._modelBin, this._nodesLocation + (index * 21 + 9) * FLOAT32, 12);
    };
    
    return SceneModelBinLoader;

})();
