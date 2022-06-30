//
// m3d_camera_animator_navigate.js
// The camera animation used for scene navigation
//
//  
//

import Utils          from "../../00utility/m3d_utils.js";
import BaseCamera     from "./m3d_base_camera.js";
import CameraAnimator from "./m3d_camera_animator.js"

export default (function() {
    "use strict";
    
    function CameraAnimatorNavigate() {
        // Inheritance:
        CameraAnimator.apply(this, arguments);
    };
    
    CameraAnimatorNavigate.prototype = Object.create(CameraAnimator.prototype);
    CameraAnimatorNavigate.prototype.constructor = CameraAnimatorNavigate;
    
    CameraAnimatorNavigate.prototype.update = function() {
        var camera = this._camera;
        var updated = true;

        camera.eye[0] += (camera._targetEye[0] - camera.eye[0]) * 0.15;
        camera.eye[1] += (camera._targetEye[1] - camera.eye[1]) * 0.15;
        camera.eye[2] += (camera._targetEye[2] - camera.eye[2]) * 0.15;

        camera._at[0] += (camera._targetAt[0] - camera._at[0]) * 0.15;
        camera._at[1] += (camera._targetAt[1] - camera._at[1]) * 0.15;
        camera._at[2] += (camera._targetAt[2] - camera._at[2]) * 0.15;

        camera._distance = vec3.distance(camera.eye, camera._at);
        
        mat4.lookAt(camera.viewMatrix, camera.eye, camera._at, [0.0, 0.0, 1.0]);
        
        var diffFov = camera._targetFov - camera._fov;
        BaseCamera.prototype._setFov.apply(camera, [camera._fov + diffFov * 0.15]);
        
        camera._updateProjection();
        mat4.multiply(camera.vpMatrix, camera.projectMatrix, camera.viewMatrix);
        camera._cull.update();

        return updated;
    };
        
    CameraAnimatorNavigate.prototype.stop = function(forceStop) {
        var camera = this._camera;
        
        // When navigateEnd is called in transit() or outside, the navigation path
        // has not been finished as we are approaching target camera gradually. Thus
        // we delay the navigation end till camera freezes.
        if (!forceStop) {
            
            if (!camera) {
                return;
            }
            
            var changed = vec3.distance(camera.eye, camera._targetEye) > 1e-3 || 
                          vec3.distance(camera._at, camera._targetAt) > 1e-3  || 
                          Math.abs(camera._targetFov - camera._fov) > 1e-3 ;

            var that = this;
            if (changed) {
                window.setTimeout(function() {
                    that.stop();
                }, 100);

                return;
            }
        }
        
        camera._distance = camera._targetDistance;

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
        
        if (camera._firstPerson) {
            camera._targetPhi = camera._phi = -camera._targetPhi;
            camera._targetTheta = camera._theta = camera._targetTheta + Math.PI;
        }
        this.unbind();
    };
   
    CameraAnimatorNavigate.prototype.start = function(eye, at, theta, phi, fov) {
        var camera = this._camera;

        camera._targetAt[0] = at[0];
        camera._targetAt[1] = at[1];
        camera._targetAt[2] = at[2];

        camera._targetEye[0] = eye[0];
        camera._targetEye[1] = eye[1];
        camera._targetEye[2] = eye[2];

        if (theta) {
            camera._targetTheta = theta;
        }

        if (phi) {
            camera._targetPhi = phi;
        }

        if (fov) {
            camera.setTargetFov(fov);
        }
        var dx = camera._targetAt[0] - camera._targetEye[0];
        var dy = camera._targetAt[1] - camera._targetEye[1];
        var dz = camera._targetAt[2] - camera._targetEye[2];

        // Update the camera parameters.
        var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        camera._targetDistance = d;
        // if target distance is too small, smaller than znear distance,
        // we scale it a little up. Otherwise, the camera panning will be
        // working improperly.
        if (d < 0.001 * camera._scene.radius) {
            var scale = 0.001 * camera._scene.radius / d;
            camera._targetDistance = 0.001 * camera._scene.radius;
            camera._targetAt[0] = scale * dx + camera._targetEye[0];
            camera._targetAt[1] = scale * dy + camera._targetEye[1];
            camera._targetAt[2] = scale * dz + camera._targetEye[2];
        }
    };
    

    return CameraAnimatorNavigate;
})();
