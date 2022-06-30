// m3d_terrain_tile.js
// The terrain tile.
//
// Copyright Modelo XX - 2018, All rights reserved.
//
//

import MyMath  from "../../00utility/m3d_math.js";

export default (function() {
    "use strict";

    function TerrainTile(x, y, drawable, bbox) {
        this.x = x;
        this.y = y;
        this.level = null;
        this.drawable = drawable;
        this.originalBBox = MyMath.aabb.createFromArray(bbox); // The original bbox of this tile.
    };

    TerrainTile.prototype.destroy = function() {
        this.x = null;
        delete this.x;

        this.y = null;
        delete this.y;

        this.level = null;
        delete this.level;

        this.drawable.destroy();
        this.drawable = null;
        delete this.drawable;

        this.originalBBox = null;
        delete this.originalBBox;
    };

    TerrainTile.prototype.setTransform = function(matrix) {
        MyMath.aabb.transform(this.drawable.bbox, this.originalBBox, matrix);
        this.drawable.bsphere = MyMath.sphere.createFromAABB(this.drawable.bbox);
        this.drawable.transform.setTransform(matrix);
    };

    return TerrainTile;
})();
