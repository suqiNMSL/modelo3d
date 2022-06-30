// m3d_terrain_level.js
// The terrain object, loaded from .mt file.
//
// Copyright Modelo XX - 2018, All rights reserved.
//
//


export default (function() {
    "use strict";

    function TerrainLevel(level) {
        this.index = level;
        this.size  = (1 << level);
        this.tiles = Array(this.size * this.size);
    };

    TerrainLevel.prototype.destroy = function() {
        var count = this.size * this.size;
        for (var i = 0; i < this.size * this.size; ++i) {
            if (this.tiles[i]) {
                this.tiles[i].destroy();
            }
        }
        this.tiles = null;
        delete this.tiles;
        
        this.index = null;
        delete this.index;
        this.size = null;
        delete this.size;
    };
    
    TerrainLevel.prototype.addTile = function(tile) {
        var index = tile.y * this.size + tile.x;
        this.tiles[index] = tile;
    };

    return TerrainLevel;
})();

