//
// m3d_bim_cull.js
// The bim culling will cull off elements inside drawable drawable based
// on BIM.
// 
//  

import Globals     from "../../m3d_globals.js";
import Node from "../graph/m3d_node.js";

export default (function() {
    "use strict";

    function BimCull(camera) {
        this._camera = camera;

        this.enabled = false;
    };
    
    BimCull.prototype.update = function() {
    };

    // The output indices is the index offset and range of draw call.
    BimCull.prototype.isCulled = function(drawable, indices) {
        if (!this.enabled) {
            return false;
        }

        // Bim culling is to skip the rendering of hidable elements inside
        // this drawable drawable. The hidability of each element is given by their regions.
        // In most cases, the element of interior will be thrown away, together with less important
        // regions than interior, e.g., landscape, mep.
        if (drawable.hidables > 0) {
            indices[1] = drawable.nodes[drawable.hidables].indicesOffset / drawable.mesh.indexSize;
        }

        return drawable.hidables === 0; // If entire drawable can be culled.
    };

    return BimCull;
})();
    


