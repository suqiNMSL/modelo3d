// m3d_terrain.js
// The terrain object, loaded from .mt file.
//
// Copyright Modelo XX - 2018, All rights reserved.
//
//

import MyMath     from "../../00utility/m3d_math.js";
import Transform  from "../drawables/m3d_transform.js";


export default (function() {
    "use strict";

    function Terrain(levels, bbox) {
        // private:
        this._levels         = new Array(levels);
        this._rotation       = 0.0; // The transform angle
        this._scaling        = 1.0; // Ditto
        this._translation    = [0, 0, 0]; // Ditto.
        this._matrix         = mat4.create(); // The transform matrix.
        this._originalBBox   = MyMath.aabb.createFromArray(bbox); // The original bbox of the terrain model.

        // public:
        this.tiles          = []; // current visible tiles
        this.source         = "";
        this.id             = "";
        this.bbox           = MyMath.aabb.createFromArray(bbox); // The current bbox of the terrain (after transformed)
    };

    Terrain.prototype.destroy = function() {
        for (var i = 0, len = this._levels.length; i < len; ++i) {
            if (this._levels[i]) {
                this._levels[i].destroy();
            }
        }
        this._levels = null;
        delete this._levels;

        this._matrix = null;
        delete this._matrix;

        this._translation = null;
        delete this._translation;

        this._scaling = null;
        delete this._scaling;

        this._rotation = null;
        delete this._rotation;

        this.bbox = null;
        delete this.bbox;
        
        this._originalBBox = null;
        delete this._originalBBox;

        this.tiles = [];
        delete this.tiles;
    };

    // Add level of tiles to this terrain object.
    Terrain.prototype.setLevel = function(level) {
        if (level.index < this._levels.length) {
            this._levels[level.index] = level;
        }
    };

    Terrain.prototype._applyTransform = function() {
        var cx = (this._originalBBox[3] + this._originalBBox[0]) * 0.5;
        var cy = (this._originalBBox[4] + this._originalBBox[1]) * 0.5;
        var cz = (this._originalBBox[5] + this._originalBBox[2]) * 0.5;

        // Accumulate the scaling and rotation at the center of bbox of the terrain.
        this._matrix[12] = -cx * this._scaling;
        this._matrix[13] = -cy * this._scaling;
        this._matrix[14] = -cz * this._scaling;

        this._matrix[0] = this._scaling;
        this._matrix[1] = 0;
        this._matrix[2] = 0;
        
        this._matrix[4] = 0;
        this._matrix[5] = this._scaling;
        this._matrix[6] = 0;
        
        this._matrix[8] = 0;
        this._matrix[9] = 0;
        this._matrix[10] = this._scaling;

        mat4.rotateZ(this._matrix, this._matrix, this._rotation);

        this._matrix[12] += cx + this._translation[0];
        this._matrix[13] += cy + this._translation[1];
        this._matrix[14] += cz + this._translation[2];
    };
    
    Terrain.prototype.translate = function(x, y, z) {
        this._translation[0] += x;
        this._translation[1] += y;
        this._translation[2] += z;

        this._applyTransform();

        for (var i = 0, count = this.tiles.length; i < count; i++) {
            this.tiles[i].setTransform(this._matrix);
        }

        // Update the terrain bbox
        MyMath.aabb.transform(this.bbox, this._originalBBox, this._matrix);
    }

    Terrain.prototype.setTranslation = function(x, y, z) {
        this._translation[0] = x;
        this._translation[1] = y;
        this._translation[2] = z;

        this._applyTransform();

        for (var i = 0, count = this.tiles.length; i < count; i++) {
            this.tiles[i].setTransform(this._matrix);
        }

        // Update the terrain bbox
        MyMath.aabb.transform(this.bbox, this._originalBBox, this._matrix);

        console.log([x, y, z]);
    };
    
    Terrain.prototype.setRotation = function(angle) {
        // Avoid overflow
        if (angle < -1e7) {
            angle = -1e7;
        }
        if (angle > 1e7) {
            angle = 1e7;
        }
        
        angle = angle * 0.0174532925199432957; // PI / 180

        this._rotation = angle;
        
        this._applyTransform();

        for (var i = 0, count = this.tiles.length; i < count; i++) {
            this.tiles[i].setTransform(this._matrix);
        }

        // Update the terrain bbox
        MyMath.aabb.transform(this.bbox, this._originalBBox, this._matrix);
    };

    Terrain.prototype.setScaling = function(s) {
        if (s < 0) {
            s = 1e-5;
        }

        this._scaling = s;
        
        this._applyTransform();
        
        for (var i = 0, count = this.tiles.length; i < count; i++) {
            this.tiles[i].setTransform(this._matrix);
        }

        // Update the terrain bbox
        MyMath.aabb.transform(this.bbox, this._originalBBox, this._matrix);
    };

    Terrain.prototype.getScaling = function() {
        return this._scaling;
    };
    Terrain.prototype.getRotation = function() {
        return this._rotation * 57.29577951308232087;
    };
    Terrain.prototype.getTranslation = function() {
        return this._translation;
    };

    // Prepare to render this level. 
    // FIXME: for the first iteration of modelo3d terrain rendering, we only support
    // render one and only one entire level. There is no dynamic LOD support.
    Terrain.prototype.useLevel = function(levelIndex) {
        this._currentLevel = levelIndex;

        this.drawables = [];
        var level = this._levels[levelIndex];
        var size = (1 << levelIndex);
        var count = size * size;
        for (var i = 0; i < count; i++) {
            var tile = level.tiles[i];

            if (tile) {
                tile.setTransform(this._matrix);
                this.tiles.push(tile);
                this.drawables.push(tile.drawable);
            }
        }
    };

    Terrain.prototype.levels = function() {
        return this._levels.length;
    };

    return Terrain;
})();

