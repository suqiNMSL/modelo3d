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

    function CameraAnimatorOrbit() {
        // Inheritance:
        CameraAnimator.apply(this, arguments);
        this._savedFirstPerson = false;
        this._acceleration    = 0.004;
    };
    
    CameraAnimatorOrbit.prototype = Object.create(CameraAnimator.prototype);
    CameraAnimatorOrbit.prototype.constructor = CameraAnimatorOrbit;

    CameraAnimatorOrbit.prototype.stop = function() {
        var camera = this._camera;

        camera._targetDistance = camera._distance;

        var dx = camera.eye[0] - camera._at[0];
        var dy = camera.eye[1] - camera._at[1];
        var dz = camera.eye[2] - camera._at[2];

        camera._targetPhi = camera._phi = Math.asin(Math.min(dz / camera._targetDistance, 1.0));
        if (camera._targetPhi >= 0.49999 * Math.PI) {
            camera._targetPhi = 0.49999 * Math.PI;
        }
        if (camera._targetPhi <= -0.49999 * Math.PI) {
            camera._targetPhi = -0.49999 * Math.PI;
        }
        
        camera._targetTheta = camera._theta = Math.atan2(dy, dx);
        
        if (this._savedFirstPerson) {
            camera.setFirstPerson(true);
        }

        this.unbind();
    };
    CameraAnimatorOrbit.prototype.start = function() {
        var camera = this._camera;
        if (camera._firstPerson) {
            this._savedFirstPerson = true;
            camera.setFirstPerson(false);
        }
    };
    CameraAnimatorOrbit.prototype.update = function() {
        var camera = this._camera;

        camera._targetTheta += this._acceleration;
        camera._theta = camera._targetTheta;

        // Update projection every frame because we find it is needed when at is no longer at
        // the origin of the world space.
        if (camera._scene) {
            camera._updateProjection();
        }
        
        BaseCamera.prototype.update.apply(camera, arguments);

        camera._cull.update();
        

        return true;
    };
    
    return CameraAnimatorOrbit;
})();
