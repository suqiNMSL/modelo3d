//
// m3d_clipping_cull.js
// Cull objects if they are not in clipping range
//
//  

import Globals from "../../m3d_globals.js";
import Math    from "../../00utility/m3d_math.js";

export default (function() {
    "use strict";

    function ClippingCull(camera) {
        this._camera  = camera;
        this._scene   = camera._scene;  
    };


    ClippingCull.prototype.isCulled = function(drawable) {
        if (!this._scene.clipping.isEnabled()) {
            return false;
        }

        var aabb = this._scene.clipping.get();
        
        // If the drawable's bbox is inside the clipping range, we don't cull it.
        if (Math.outside.aabb_aabb(drawable.bbox, aabb)) {
            return true;
        }

        return false;
    }

    return ClippingCull;
})();
    
