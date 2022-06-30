//
// m3d_camera_animator_instant.js
// The instant camera animation, i.e., update camera instantly
//
//  
//

import Utils          from "../../00utility/m3d_utils.js";
import BaseCamera     from "./m3d_base_camera.js";
import CameraAnimator from "./m3d_camera_animator.js"

export default (function() {
    "use strict";

    function CameraAnimatorInstant() {
        // Inheritance:
        CameraAnimator.apply(this, arguments);
    };
    
    CameraAnimatorInstant.prototype = Object.create(CameraAnimator.prototype);
    CameraAnimatorInstant.prototype.constructor = CameraAnimatorInstant;

    CameraAnimatorInstant.prototype.update = function() {
        var camera = this._camera;

        camera._distance   = camera._targetDistance;
        camera._theta      = camera._targetTheta;
        camera._phi        = camera._targetPhi;
        camera._fov        = camera._targetFov;

        // add this check for phi not to flip the scene when look up
        // MOD-6902
        if (camera._phi >= 0.49999 * Math.PI) {
            camera._phi = 0.49999 * Math.PI;
        }
        if (camera._phi <= -0.49999 * Math.PI) {
            camera._phi = -0.49999 * Math.PI;
        }
            
        if (!camera._firstPerson) {
            camera._at[0]    = camera._targetAt[0];
            camera._at[1]    = camera._targetAt[1];
            camera._at[2]    = camera._targetAt[2];
        }

        var updated = true; // either force rendering or camera updated.

        // Update projection every frame because we find it is needed when at is no longer at
        // the origin of the world space.
        camera._invTanFov = 1.0 / Math.tan(camera._fov * 0.00872665);

        if (camera._perspective) {
            camera.projectMatrix[0] = camera._invTanFov / camera._aspect;
            camera.projectMatrix[5] = camera._invTanFov;
        }

        if (camera._scene) {
            camera._updateProjection();
        }
        
        BaseCamera.prototype.update.apply(camera, arguments);

        camera._cull.update();

        return updated;
    };
    
    return CameraAnimatorInstant;
})();
