//
// m3d_frustum_cull.js
// Frustum culling and small objects culling
//
//  

import Globals from "../../m3d_globals.js";
import Math    from "../../00utility/m3d_math.js";

export default (function() {
    "use strict";

    function FrustumCull(camera) {
        this._camera  = camera;
        this._scene   = camera._scene;  
        //this._cone    = Math.cone.create();
        this._frustum = Math.frustum.createFromMatrix(camera.vpMatrix);
        this._contain = false; // contain the entire scene.
        this._p = [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0]];
        this._t = [0, 0, 0, 0, 0, 0];
    };

    FrustumCull.prototype.isCulled = function(drawable) {
        // When the (clipped) scene is contained by the frustum entirely, 
        // we don't need to do the culling.

        // According to test, computing aabb_frustum only takes only 30% of
        // CPU time of the combination of the three functions (see above)
        // together. That is why we disable the first two tests and use only
        // the last one.
        //return !modelo3d.intersect.sphere_cone(drawable.bsphere, this._cone) ||
        //        modelo3d.outside.sphere_frustum(drawable.bsphere, this._frustum) ||
        //        modelo3d.outside.aabb_frustum(drawable.bbox, this._frustum);
        if (this._contain) {
           return false;
        }

        var f = this._frustum;
        var b = drawable.bbox;
        // A simplified version of outside.aabb_frustum
        return (b[this._p[0][0]] * f[0][0] + b[this._p[0][1]] * f[0][1] + b[this._p[0][2]] * f[0][2] > this._t[0]) ||
               (b[this._p[1][0]] * f[1][0] + b[this._p[1][1]] * f[1][1] + b[this._p[1][2]] * f[1][2] > this._t[1]) ||
               (b[this._p[2][0]] * f[2][0] + b[this._p[2][1]] * f[2][1] + b[this._p[2][2]] * f[2][2] > this._t[2]) ||
               (b[this._p[3][0]] * f[3][0] + b[this._p[3][1]] * f[3][1] + b[this._p[3][2]] * f[3][2] > this._t[3]) ||
               (b[this._p[4][0]] * f[4][0] + b[this._p[4][1]] * f[4][1] + b[this._p[4][2]] * f[4][2] > this._t[4]) ||
               (b[this._p[5][0]] * f[5][0] + b[this._p[5][1]] * f[5][1] + b[this._p[5][2]] * f[5][2] > this._t[5]);
    };
    
    // Update the frustum shape
    FrustumCull.prototype.update = function() {
        // Update the cone shape by first finding 
        // the max spanning angle of the frustum.
        //if (this._camera.isPerspective()) {
        //    Math.cone.updateShape(this._cone, this._camera._fov, this._camera._aspect);
        //    // Cone
        //    vec3.copy(this._cone.tip, this._camera.eye);
        //    this._cone.direction = this._camera.getViewDirection();
        //}
        this._frustum = Math.frustum.createFromMatrix(this._camera.vpMatrix);    

        // Pre-compute some parts of the outside.aabb_frustum 
        for (var i = 0; i < 6; i++) {
            this._p[i][0] = (this._frustum[i][0] > 0? 0 : 3);
            this._p[i][1] = (this._frustum[i][1] > 0? 1 : 4);
            this._p[i][2] = (this._frustum[i][2] > 0? 2 : 5);
            this._t[i] = -this._frustum[i][3];
        }
 
        this._contain = Math.inside.aabb_frustum(this._scene.bbox, this._frustum);
    };

    return FrustumCull;
})();
    
