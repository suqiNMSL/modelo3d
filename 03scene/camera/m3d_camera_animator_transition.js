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
    
    function CameraAnimatorTransition(eventEmitter) {
        CameraAnimator.apply(this, arguments);

        this._srcAt         = vec3.create();   // source
        this._srcEye        = vec3.create();
        
        this._dstAt         = vec3.create();   // destination
        this._dstEye        = vec3.create();
        
        this._curAt         = vec3.create();   // current
        this._curEye        = vec3.create();
        this._eventEmitter  = eventEmitter;
        
        this._srcTheta      = 0;
        this._dstTheta      = 0;
        
        this._srcPhi        = 0;
        this._dstPhi        = 0;
        
        this._curTheta      = 0;
        this._curPhi        = 0;
        
        this._srcDistance   = 0;
        this._dstDistance   = 0;
        
        this._startTime     = 0;
        this._duration      = 0;
        this._speed         = 15;
    };

    CameraAnimatorTransition.prototype = Object.create(CameraAnimator.prototype);
    CameraAnimatorTransition.prototype.constructor = CameraAnimatorTransition;
    
    CameraAnimatorTransition.prototype.update = function() {
        var currTime = new Date().getTime();
        var elapsedTime = currTime - this._startTime;
        if (elapsedTime >= this._duration) {
            if (elapsedTime > this._duration * 3) {
                if (this._eventEmitter) {
                    this._eventEmitter.emit("commentTransitionEnded");
                }
                this.stop();
            } else if (!this._updateCamera(this._dstEye, this._dstAt, this._dstTheta, this._dstPhi)) {
                if (this._eventEmitter) {
                    this._eventEmitter.emit("commentTransitionEnded");
                }
                this.stop();
            }
            return true;
        }

        var ratio = elapsedTime / this._duration;
        //I use the sin function to make the movement slow at first and fast in the middle,
        //slow down at last. If it's not obvious, I can change to other similar function.
        ratio = Math.sin(ratio * Math.PI - Math.PI / 2) / 2 + 0.5;

        Interpolator.linear.vec3(this._curAt, this._srcAt, this._dstAt, ratio);
        Interpolator.linear.vec3(this._curEye, this._srcEye, this._dstEye, ratio);
        this._curPhi   = Interpolator.linear.scalar(this._srcPhi, this._dstPhi, ratio);
        this._curTheta = Interpolator.linear.scalar(this._srcTheta, this._dstTheta, ratio);
        
        if (vec3.distance(this._curEye, this._curAt) > 1e-3) {
            return this._updateCamera(this._curEye, this._curAt, this._curTheta, this._curPhi);
        }

        return false;
    };
    
    CameraAnimatorTransition.prototype.stop = function() {
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
        
        if (camera._firstPerson) {
            camera._targetPhi = camera._phi = -camera._targetPhi;
            camera._targetTheta = camera._theta = camera._targetTheta + Math.PI;
        }

        this.unbind();
    };
    
    // Move to destination camera in a smooth transition animation. Return
    // false if destination is the same as starting position.
    CameraAnimatorTransition.prototype.start = function(destination, isVrEnabled, maxStepNum) {
        var camera = this._camera;
        
        if (isVrEnabled) {
            camera.restore(destination);
        }
        
        this._setStartPoint(camera._at, 
                            camera.eye, 
                            camera._distance, 
                            destination.at, 
                            camera._theta, 
                            camera._phi);
        if (!isVrEnabled) {
            camera.restore(destination);
        }
        this._setEndPoint(camera._targetDistance, 
                          camera._targetTheta, 
                          camera._targetPhi, 
                          camera._firstPerson, 
                          camera._scene.radius,
                          maxStepNum);
        
        vec3.copy(camera._at, this._srcAt);
        vec3.copy(camera.eye, this._srcEye);
        
        if (isVrEnabled) {
            this._updateCamera(this._dstEye, this._dstAt, this._dstTheta, this._dstPhi);
            return true;
        }
        
        this._startTime = new Date().getTime();
        this._updateCamera(this._srcEye, this._srcAt, this._srcTheta, this._srcPhi);
        return true;
    };
    
    CameraAnimatorTransition.prototype._setStartPoint = function(srcAt, srcEye, srcDis, dstAt, 
            srcTheta, srcPhi) {
        vec3.copy(this._srcAt, srcAt);
        vec3.copy(this._srcEye, srcEye);
        this._srcDistance = srcDis;
        vec3.copy(this._dstAt, dstAt);
        this._srcTheta = srcTheta;
        this._srcPhi = srcPhi;
    };
    
    CameraAnimatorTransition.prototype._setEndPoint = function(dstDis, dstTheta, dstPhi, isReverse, 
            radius, maxStepNum) {

        this._dstDistance = dstDis;
        this._dstTheta = dstTheta;
        this._dstPhi = dstPhi;
        
        var dx; 
        var dy; 
        var dz;
        var sx = Math.sin(this._dstPhi);
        var cx = Math.cos(this._dstPhi);
        var sz = Math.sin(this._dstTheta);
        var cz = Math.cos(this._dstTheta);

        dx = cx * cz;
        dy = cx * sz;
        dz = sx;
        
        if (isReverse) {
            dx = -dx;
            dy = -dy;
            dz = -dz;
        }

        this._dstEye[0] = this._dstAt[0] + dx * this._dstDistance;
        this._dstEye[1] = this._dstAt[1] + dy * this._dstDistance;
        this._dstEye[2] = this._dstAt[2] + dz * this._dstDistance;
        
        // For the transition from one comment to another, we call the transition traversal function every 15ms.
        // For example if we take 100 steps to finish entire transition, then whole time is 1500ms.
        // 
        // The number of steps is calculated by 5 factors as follows: dis1,
        // dis2, dis3, dis4 and dis5 Suppose the whole scene's radius is 100
        // feet and the distance between source eye and target eye is 5 feet,
        // then the dis2 is 5 / 100 * RATIO where RATIO is a pre-defined value.
        //
        // We choose the largest among dis1 to dis5 to the value of steps.
        // Sometimes the steps can be big if the scene is a whole city. The
        // transition might take a very long time That's why we defined a value
        // called MAX_STEPNUM, which will set a limit to the steps. 
        
        // FIXME: it is not easy to find proper steps values for different
        // scenes as scenes are varying in their size varying in their sizes.
        // another. At many times the transition may fail to have a pleasant
        // speed on certain models we have not found a perfect solution yet.
        
        var dis1, dis2, dis3, dis4, dis5;

        // distance between target at and source at
        dis1 = vec3.distance(this._srcAt, this._dstAt);
        
        // distance between target eye and source eye
        dis2 = vec3.distance(this._srcEye, this._dstEye);
        
        // distance between target distance and source distance
        dis3 = Math.abs(this._srcDistance - this._dstDistance);
        
        // angle difference between target theta and source theta
        dis4 = Math.abs(this._srcTheta - this._dstTheta);
        
        // angle difference between target phi and source phi
        dis5 = Math.abs(this._srcPhi - this._dstPhi);
        
        var RATIO = Globals.isMobile ? 300 : 450;

        var MAX_STEPNUM = maxStepNum || 266;

        dis1 = Math.ceil(dis1 / radius * RATIO);
        dis2 = Math.ceil(dis2 / radius * RATIO);
        dis3 = Math.ceil(dis3 / radius * RATIO);
        dis4 = Math.ceil(dis4 / Math.PI * 90);
        dis5 = Math.ceil(dis5 / Math.PI * 90);
        
        var steps = Math.max(dis3, Math.max(dis1, dis2)); // we move at 20km/hour
        
        steps = Math.max(steps, Math.max(dis4, dis5));
        
        steps = Math.min(Math.max(steps, 1), MAX_STEPNUM);
        
        this._duration = steps * this._speed;
    };
        
    CameraAnimatorTransition.prototype._updateCamera = function(eye, at, theta, phi) {
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

        var diffFov     = camera._targetFov - camera._fov;
        var diffTheta   = camera._targetTheta - camera._theta;
        var diffPhi     = camera._targetPhi - camera._phi;
        
        var diffEye0    = camera._targetEye[0] - camera.eye[0];
        var diffEye1    = camera._targetEye[1] - camera.eye[1];
        var diffEye2    = camera._targetEye[2] - camera.eye[2];
        
        var diffAt0    = camera._targetAt[0] - camera._at[0];
        var diffAt1    = camera._targetAt[1] - camera._at[1];
        var diffAt2    = camera._targetAt[2] - camera._at[2];
        
        //MOD-6554, if the phi is 0.5*PI or -0.5*PI, then the transition camera
        //needs more iteration to get to the right eye and at position. So change
        //the threshold from 1e-4 to 1e-7
        var isVertical = false;
        if (Math.abs(1 - Math.abs(camera._targetPhi / (Math.PI * 0.49999))) < 1e-4) {
            isVertical = true;
        }
        
        var angleChanged = Math.abs(diffTheta) + Math.abs(diffPhi) > 1e-4;
        var positionChanged = (Math.abs(diffEye0) + Math.abs(diffEye1) + Math.abs(diffEye2) + 
                               Math.abs(diffAt0) + Math.abs(diffAt1) + Math.abs(diffAt2)) > (isVertical ? 6e-7 : 1e-4);
        var fovChanged = Math.abs(diffFov) > 1e-4;
        
        var updated = angleChanged || positionChanged || fovChanged;
        
        camera.eye[0] += diffEye0 * 0.15;
        camera.eye[1] += diffEye1 * 0.15;
        camera.eye[2] += diffEye2 * 0.15;
        
        camera._at[0] += diffAt0 * 0.15;
        camera._at[1] += diffAt1 * 0.15;
        camera._at[2] += diffAt2 * 0.15;

        camera._distance = vec3.distance(camera.eye, camera._at);
        
        mat4.lookAt(camera.viewMatrix, camera.eye, camera._at, [0.0, 0.0, 1.0]);
        
        BaseCamera.prototype._setFov.apply(camera, [camera._fov + diffFov * 0.15]);
        
        camera._updateProjection();
        mat4.multiply(camera.vpMatrix, camera.projectMatrix, camera.viewMatrix);
        camera._cull.update();
        return updated;
    };
    
    CameraAnimatorTransition.prototype.setTransitionSpeed = function(speed) {
        this._speed = speed;
    };
    return CameraAnimatorTransition;
})();
