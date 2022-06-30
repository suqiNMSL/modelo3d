//
// m3d_cull.js
// Tailor the drawables so that only visible part of it will be rendered.
// 
//  

import Globals      from "../../m3d_globals.js";
import profiling    from "../../m3d_profiling.js" 
import ClippingCull from "./m3d_clip_cull.js";
import ZeroAreaCull from "./m3d_zeroarea_cull.js";
import FrustumCull  from "./m3d_frustum_cull.js";
import BimCull      from "./m3d_bim_cull.js";

export default (function() {
    "use strict";

    function Cull(camera) {
        this._clippingCull = new ClippingCull(camera);
        this._frustumCull  = new FrustumCull(camera);
        this._zeroAreaCull = new ZeroAreaCull(camera, this._frustumCull);
        this._bimCull      = new BimCull(camera);
        this._enabled      = false;
    };

    Cull.prototype.setEnabled = function(enabled) {
        this._enabled = enabled;
    };

    if (Globals.profiling) {
        Cull.prototype.isCulled = function(drawable, indices) {
            if (!this._enabled) {
                return false;
            }

            var culled = false;

            culled = this._clippingCull.isCulled(drawable);
            if (culled) {
                profiling.numClippingCulledVertices += drawable.mesh.length;
                return true;
            }

            culled = this._zeroAreaCull.isCulled(drawable);
            if (culled) {
                profiling.numZeroAreaCulledVertices += drawable.mesh.length;
                return true;
            }
            
            culled = this._bimCull.isCulled(drawable, indices);
            if (culled) {
                profiling.numBimCulledVertices += drawable.mesh.length;
                return true;
            } else {
                profiling.numBimCulledVertices += drawable.mesh.length - indices[1];
            }

            culled = this._frustumCull.isCulled(drawable);
            if (culled) {
                profiling.numFrustumCulledVertices += drawable.mesh.length;
                return true;
            }

            return false;
        };
    } else {

        Cull.prototype.isCulled = function(drawable, indices) {
            if (!this._enabled) {
                return false;
            }

            if (this._clippingCull.isCulled(drawable) ||
                this._frustumCull.isCulled(drawable) ||
                this._bimCull.isCulled(drawable, indices) ||
                this._zeroAreaCull.isCulled(drawable) ||
                false) {
                return true;
            }

            return false;
        };
    } 
    
    Cull.prototype.update = function() {
        if (this._enabled) {
            this._frustumCull.update();
            this._zeroAreaCull.update();
            this._bimCull.update();
        }
    };
    
    Cull.prototype.setBimCullingEnabled = function(enabled) {
        this._bimCull.enabled = enabled;
    };
    
    Cull.prototype.isBimCullingEnabled = function() {
        return this._bimCull.enabled;
    };

    return Cull;
})();
    
