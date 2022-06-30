//
// m3d_load_terrain.js
// Load the terrain.bin, the terrain information
//
// Copyright Modelo XX - 2018, All rights reserved.

export default (function() {
    "use strict";
    
    var UINT32_BYTES = 4;

    function TerrainBinLoader(sceneJson, terrainBin) {
        this._terrainBin = terrainBin; 

        // The offset of each level binary in the terrain.bin.
        this._levelOffsets = Array(sceneJson.levels.length);
        this._levelNames = Array(sceneJson.levels.length);

        // initialize
        var offset = 0;
        for (var i = 0; i < this._levelNames.length; i++) {
            this._levelNames[i] = sceneJson.levels[i].name;

            var size = (1 << this._levelNames[i]);
            
            this._levelOffsets[i] = offset;
            offset += size * size * UINT32_BYTES * 7;
        }
    };

    TerrainBinLoader.prototype.destroy = function() {
        this._terrainBin = null;
        delete this._terrainBin;
        this._levelOffsets = null;
        delete this._levelOffsets;
        this._levelNames = null;
        delete this._levelNames;
    };

    TerrainBinLoader.prototype.readTile = function(levelIndex, tileIndex) {
        if (levelIndex >= this._levelOffsets.length) {
            return null;
        }

        var offset = this._levelOffsets[levelIndex];
        return new Uint32Array(this._terrainBin, 
                offset + tileIndex * 7 * UINT32_BYTES,
                7);
    }

    return TerrainBinLoader;
})();
