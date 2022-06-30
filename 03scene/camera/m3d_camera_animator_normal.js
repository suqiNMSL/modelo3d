//
// m3d_camera_animator_normal.js
// The normal camera animation
//
//  
//

import Utils          from "../../00utility/m3d_utils.js";
import BaseCamera     from "./m3d_base_camera.js";
import CameraAnimator from "./m3d_camera_animator.js"

export default (function() {
    "use strict";
    
    function CameraAnimatorNormal() {
        // Inheritance:
        CameraAnimator.apply(this, arguments);

        this._updateThreshold = 1e-4; // We set the threshold to a fixed value for now, in the future if we
                                      // found wasted update canvas or too much calculation, change this value
                                      // based on the scene's radius
        this._acceleration    = 0.15;
    };

    CameraAnimatorNormal.prototype = Object.create(CameraAnimator.prototype);
    CameraAnimatorNormal.prototype.constructor = CameraAnimatorNormal;
    
    CameraAnimatorNormal.prototype.update = function() {
        var camera = this._camera;

        var diffDistance   = camera._targetDistance - camera._distance;
        var diffTheta      = camera._targetTheta - camera._theta;
        var diffPhi        = camera._targetPhi - camera._phi;
        var diffFov        = camera._targetFov - camera._fov;

        var updated = false;

        var diffAt         = 0;
        if (!camera._firstPerson) {
            var diffAt0    = camera._targetAt[0] - camera._at[0];
            var diffAt1    = camera._targetAt[1] - camera._at[1];
            var diffAt2    = camera._targetAt[2] - camera._at[2];

            camera._at[0]    += diffAt0 * this._acceleration;
            camera._at[1]    += diffAt1 * this._acceleration;
            camera._at[2]    += diffAt2 * this._acceleration;

            diffAt = Math.abs(diffAt0) + Math.abs(diffAt1) + Math.abs(diffAt2);
        }
        
        // Check if the camera has been updated in camera frame.
        var angleChanged = Math.abs(diffTheta) + Math.abs(diffPhi) > 1e-4;
        var positionChanged = (Math.abs(diffDistance) + diffAt) > this._updateThreshold;
        var fovChanged = Math.abs(diffFov) > 1e-4;

        updated = angleChanged || positionChanged || fovChanged; // either force rendering or camera updated.

        if (updated) {
            camera._distance += diffDistance * this._acceleration;
            camera._theta    += diffTheta * this._acceleration;
            camera._phi      += diffPhi * this._acceleration;
            
            if (camera._phi >= 0.499999 * Math.PI) {
                camera._phi = 0.499999 * Math.PI;
            }
            if (camera._phi <= -0.499999 * Math.PI) {
                camera._phi = -0.499999 * Math.PI;
            }
            BaseCamera.prototype._setFov.apply(camera, [camera._fov + diffFov * this._acceleration]);

            // Update projection every frame because we find it is needed when at is no longer at
            // the origin of the world space.
            if (camera._scene) {
                camera._updateProjection();
            }
            
            BaseCamera.prototype.update.apply(camera, arguments);

            camera._cull.update();
        } 

        return updated;
    };
    
    return CameraAnimatorNormal;
})();
