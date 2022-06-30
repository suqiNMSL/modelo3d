//
// m3d_camera_animator_transition.js
// The scene animation file includes all the transit and navigation functions
//
//  


import Globals        from "../../m3d_globals.js";
import Utils          from "../../00utility/m3d_utils.js";
import Interpolator   from "../../00utility/m3d_interpolator.js";
import MyMath         from "../../00utility/m3d_math.js";
import CameraAnimator from "./m3d_camera_animator.js"
import BaseCamera     from "./m3d_base_camera.js";

export default (function() {
    "use strict";
    var STEPS = 50;
    function CameraAnimatorMorphing() {
        CameraAnimator.apply(this, arguments);
        this._speed = 0;
    };

    CameraAnimatorMorphing.prototype = Object.create(CameraAnimator.prototype);
    CameraAnimatorMorphing.prototype.constructor = CameraAnimatorMorphing;
    
    CameraAnimatorMorphing.prototype.update = function() {
        var camera = this._camera;

        if( Math.abs(camera._targetFov - camera._fov) < Math.abs(this._speed)) {
            BaseCamera.prototype._setFov.apply(camera, [camera._targetFov]);
            BaseCamera.prototype.update.apply(camera, arguments);
            camera._cull.update();
            this.unbind();
            return false;
        }
        
        BaseCamera.prototype._setFov.apply(camera, [camera._fov + this._speed]);
        BaseCamera.prototype.update.apply(camera, arguments);
        camera._cull.update();
        return true;
        
    };
    
    // Move to destination camera in a smooth transition animation. Return
    // false if destination is the same as starting position.
    CameraAnimatorMorphing.prototype.start = function(phi, theta, fov, targetFOV) {
        var camera = this._camera;
        
        if (phi) {
            camera._phi = camera._targetPhi = phi;
        }

        if (theta) {
            camera._theta = camera._targetTheta = theta;
        }
        
        if (fov != null) {
            fov = MyMath.clamp(fov, 1, 170);
            camera._fov = fov;
        }
        if (targetFOV) {
            camera._targetFov = targetFOV;
        }
        
        this._fovDiff = camera._targetFov - camera._fov;
        
        this._speed = (camera._targetFov - camera._fov) / STEPS;
    };
    
    CameraAnimatorMorphing.prototype.getProgress = function() {
        var camera = this._camera;
        
        return (camera._targetFov - camera._fov) / this._fovDiff;
    };
    
        
    return CameraAnimatorMorphing;
})();
