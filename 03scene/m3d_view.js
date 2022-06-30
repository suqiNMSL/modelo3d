//
// m3d_view.js
// A camera view (imported from model)
//
//  

export default (function() {
    "use strict";

    function View(viewName, viewData) {
        // public:
        this.name     = viewName;
        this.distance = viewData.distance;
        this.phi      = viewData.phi;
        this.theta    = viewData.theta;
        this.at       = vec3.clone(viewData.at);
        this.fov      = null;
        this.height   = null;
        this.drawables    = []; // the indices of drawables that are visible in this view.
        this.visible  = false;

        this.layers   = []; // the indices of layers that are visible in this view. If empty, all layers are visible in this view.

        if (viewData.hasOwnProperty("fov")) {
            this.fov = viewData.fov;
        }
        if (viewData.hasOwnProperty("height")) {
            this.height = viewData.height;
        }
    };

    View.prototype.isOrthoView = function() {
        return this.fov === null;
    };

    return View;
})();
    
