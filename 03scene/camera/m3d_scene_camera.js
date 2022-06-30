//
// m3d_camera.js
// The scene camera
//
//  

import Globals              from "../../m3d_globals.js";
import MyMath               from "../../00utility/m3d_math.js";
import Utils                from "../../00utility/m3d_utils.js";
import Cull                 from "../culling/m3d_cull.js";
import BaseCamera           from "./m3d_base_camera.js";
import CameraAnimatorNormal from "./m3d_camera_animator_normal.js";

export default (function() {
    "use strict";

    var DISTANCERATIO     = 1.05; // The distance to model is based on the model's radius
    var ZOOM_RATIO        = 0.35;
        
    var offProj           = vec3.create(); // Only used in update projection for saving GC
    var centerProj        = vec3.create(); // Only used in update projection for saving GC
    var targetEyeProj     = [0, 0, 0];     // Only used in update projection for saving GC

    function SceneCamera(scene) {
        // Inheritance:
        BaseCamera.apply(this, arguments);

        // public:
        this._scene = scene;

        // private:
        // The targetXXX is updated by UI input event and while xxx is updated in
        // UI mainloop so that when xxx approaches xxxTarget, it generates an
        // animation/inertia effect.
        this._targetAt          = [0, 0, 0];     // The position where we look at finally
                                                 // We change this value from vec3.fromValues to [0,0,0]
                                                 // because of the precision issue
        this._targetEye         = [0, 0, 0];     // Only used in navigation

        this._targetFov         = 46;
        
        this._targetTheta       = -Math.PI / 4.0;
        this._targetPhi         = Math.PI / 18.0;
        
        this._targetDistance    = 15.0;
        this._initDistance      = 15.0;         // Only used to save the view distance at init time

        this._maxZoomOffset     = 0.6;
        this._minZoomOffset     = 0.15;

        this._restricted        = false;

        this.animator           = new CameraAnimatorNormal();
        this.animator.bind(this);
        
        this._cull              = new Cull(this);

        this.updated = true;
    };

    SceneCamera.prototype = Object.create(BaseCamera.prototype);
    SceneCamera.prototype.constructor = SceneCamera;

    SceneCamera.prototype.update = function() {
        this.updated = this.animator.update();
        return this.updated;
    };

    SceneCamera.prototype.rotate = function(x, y) {
        if (this._firstPerson) {
            y = -y;
        }

        this._targetTheta -= x * 0.006;
        this._targetPhi   += y * 0.006;

        if (this._targetPhi >= 0.499999 * Math.PI) {
            this._targetPhi = 0.499999 * Math.PI;
        }
        if (this._targetPhi <= -0.499999 * Math.PI) {
            this._targetPhi = -0.499999 * Math.PI;
        }

    };

    SceneCamera.prototype.setCullingEnabled = function(enabled) {
        this._cull.setEnabled(enabled);
        if(enabled) {
            this._cull.update();
        }
    };
    
    SceneCamera.prototype.setBimCullingEnabled = function(enabled) {
        this._cull.setBimCullingEnabled(this._scene.isBimCullingNeeded && enabled);
        if (this.isBimCullingEnabled()) {
                this._cull.update();
        }
    };
    
    SceneCamera.prototype.isBimCullingEnabled = function() {
        return this._scene.isBimCullingNeeded && this._cull.isBimCullingEnabled();
    };

    SceneCamera.prototype.setTargetFov = function(fov) {
        this._targetFov = fov;
        if (this._targetFov >= 179.9) {
            this._targetFov = 179.9;
        }
        if (this._targetFov <= 0.1) {
            this._targetFov = 0.1;
        }
    };
    
    SceneCamera.prototype.getTargetFov = function() {
        return this._targetFov;
    };

    SceneCamera.prototype.zoom = function(delta) {
        if (this._restricted) {
            return;
        }

        if (this._perspective) {
            var zoomOffset = Math.abs(delta * this._targetDistance * ZOOM_RATIO);
            this._targetDistance -= (delta > 0 ? 1 : -1) * Math.min(Math.max(zoomOffset, this._minZoomOffset), this._maxZoomOffset);

            // Prevent from being negative.
            if (this._targetDistance < 0.001 * this._scene.scale) {
                this._targetDistance = 0.001 * this._scene.scale;
            }
        } else {
            // In ortho view, we use scaling to zoom in/out the view
            var height = this._height * Math.max(1.0 - delta * 0.1 * ZOOM_RATIO, 0.00001);
            BaseCamera.prototype._setHeight.call(this, height);
            
            // Trigger camera.update
            this._targetDistance -= delta > 0 ? 1.5e-4 : -1.5e-4;
        }
    };

    SceneCamera.prototype.pan = function(dx, dy) {
        if (this._restricted) {
            return;
        }

        var offset = 0.001 * this._targetDistance;
        this._targetAt[0] += -dx * this.viewMatrix[0] * offset + dy * this.viewMatrix[1] * offset;
        this._targetAt[1] += -dx * this.viewMatrix[4] * offset + dy * this.viewMatrix[5] * offset;
        this._targetAt[2] += -dx * this.viewMatrix[8] * offset + dy * this.viewMatrix[9] * offset;
    };

    SceneCamera.prototype.forward = function(ratio, dir) {
        if (this._restricted) {
            return;
        }
        
        if (!dir) {
            dir = this.getViewDirection();
            // Forward movement is only used for in house movement, 
            // so move parallel to the floor, which means no effect on
            // z direction is correct. Also after 5.0.1, there will be no
            // flipyz difference, so only set the dir[2] to 0 should be enough
            dir[2] = 0;
        }
            
        var x = dir[0] * ratio * this._scene.radius;
        var y = dir[1] * ratio * this._scene.radius;
        var z = dir[2] * ratio * this._scene.radius;

        this._targetAt[0] += x;
        this._targetAt[1] += y;
        this._targetAt[2] += z;

        this.eye[0] += x;
        this.eye[1] += y;
        this.eye[2] += z;
    };

    SceneCamera.prototype._updateProjection = function() {

        // FIXME: The following piece of code needs validation, especially when
        // eye is in the bbox of the scene.
        centerProj = MyMath.aabb.center(this._scene.bbox);

        targetEyeProj[0] = this._at[0] + this.viewMatrix[2] * this._targetDistance;
        targetEyeProj[1] = this._at[1] + this.viewMatrix[6] * this._targetDistance;
        targetEyeProj[2] = this._at[2] + this.viewMatrix[10] * this._targetDistance;

        vec3.subtract(offProj, this.eye, centerProj);
        var projDis = this.viewMatrix[2] * offProj[0] +
                      this.viewMatrix[6] * offProj[1] +
                      this.viewMatrix[10] * offProj[2];


        vec3.subtract(offProj, targetEyeProj, centerProj);
        var projDis2 = this.viewMatrix[2] * offProj[0] +
                       this.viewMatrix[6] * offProj[1] +
                       this.viewMatrix[10] * offProj[2];

        // FIXME: the near plan is too close that will cut the model part off
        // when scrolling fast. See MOD-2664.
        var znear = Math.min(projDis, projDis2) - this._scene.radius * 1.1;
        var zfar = Math.max(projDis, projDis2) + this._scene.radius * 1.03;

        if (this._perspective && znear < 0.001 * this._scene.radius) {
            znear = 0.001 * this._scene.radius;
        }

        BaseCamera.prototype._updateProjection.call(this, znear, zfar);
    };

    // if changeCurrent is true, the current camera status will also be changed.
    SceneCamera.prototype.reset = function(changeCurrent) {
        // Reset the camera animator
        if (this.animator.stop) {
            this.animator.stop();
        }
        
        this.animator = new CameraAnimatorNormal();
        this.animator.bind(this);

        if (this._scene.clipping.isEnabled()) {
            vec3.copy(this._targetAt, this._scene.clipping.getCenter());
        } else {
            this._targetAt = MyMath.aabb.center(this._scene.bbox);
        }
        //FOV should only change by the setting panel
        
        this._targetDistance = this._getViewDistance();
        this._initDistance   = this._targetDistance;

        this._maxZoomOffset   = this._targetDistance * 0.025;
        this._minZoomOffset   = this._targetDistance * 0.0025;

        this.rotateTo(Math.PI / 18.0, -Math.PI / 4.0);
        if (changeCurrent) {
            BaseCamera.prototype.reset.apply(this, arguments);
            vec3.copy(this._at, this._targetAt);
        }
    };
    
    // here we find the smallest rotate angle of CCW and CW
    SceneCamera.prototype.rotateTo = function(phi, theta) {
        var diff = theta - this._theta;
        diff %= 2 * Math.PI;
        if (diff > Math.PI) {
            diff -= 2 * Math.PI;
        } else if (diff < -Math.PI) {
            diff += 2 * Math.PI;
        }
        this._targetTheta = this._theta + diff;
        this._targetPhi = phi;
    };

    SceneCamera.prototype.lookTo = function(position, range) {
        this._targetAt[0] = position[0];
        this._targetAt[1] = position[1];
        this._targetAt[2] = position[2];

        //MOD-bimloader, range is the bbox's radius of the selected drawable in bim mode.
        //According to this range/radius value, we need to move the camera to focus on
        //on the drawable with a proper distance.  Camera needs to see the whole drawable.
        if (range) {
            this._targetDistance = range / Math.sin(this._fov * Math.PI / 360);
        } else {
            var dx = this._targetAt[0] - this.eye[0];
            var dy = this._targetAt[1] - this.eye[1];
            var dz = this._targetAt[2] - this.eye[2];
    
            this._distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            // this._targetDistance = this._distance;
            this._targetDistance = Math.min(ZOOM_RATIO * this._scene.radius, this._distance);
        }
    };

    SceneCamera.prototype.zoomTo = function(distance, targetDistance, targetAt) {
        
        this._distance = distance;
        if (targetDistance) {
            this._targetDistance = targetDistance;
        } else {
            this._targetDistance = distance;
        }
        if (targetAt) {
            vec3.copy(this._targetAt, targetAt);
        }
    };
    
    SceneCamera.prototype.zoomBy = function(ratio) {
        if (this._perspective) {
            return;
        }

        var height = this._height * ratio;
        BaseCamera.prototype._setHeight.call(this, height);
       
        // Trigger camera.update
        this._targetDistance -= ratio < 1 ? 1.5e-4 : -1.5e-4;
    };

    SceneCamera.prototype.dump = function() {
        var targetPhi;
        var targetTheta;
        // Note that we don't save/restore a first-person camera, so
        // a first-person camera is converted into a 3rd-person one
        // at saving.
        if (this._firstPerson) {
            targetPhi = -this._targetPhi;
            targetTheta = this._targetTheta - Math.PI;
        } else {
            targetPhi = this._targetPhi;
            targetTheta = this._targetTheta;
        }

        var ret;

        if (this._perspective) {
            ret = {
                fov:      this._fov,
                distance: this._targetDistance,
                phi:      targetPhi,
                theta:    targetTheta,
                at:       [this._at[0], this._at[1], this._at[2]]
            };
        } else {
            ret = {
                height:   this._height,
                distance: this._targetDistance,
                phi:      targetPhi,
                theta:    targetTheta,
                at:       [this._at[0], this._at[1], this._at[2]]
            };
        }

        return ret;
    };

    SceneCamera.prototype.restore = function(dumped) {

        // Reset targetDistance if it is a ortho view.
        var targetDistance = dumped.height? this._scene.radius * 1.2 : dumped.distance;

        var diffDistance      = 0.15 * Math.abs(targetDistance - this._targetDistance) / Math.max(targetDistance, this._targetDistance);
        var diffPhi           = 0;
        var diffTheta         = 0;
        this._distance = this._targetDistance  = targetDistance;

        if (dumped.phi >= 0.49999 * Math.PI) {
            dumped.phi = 0.49999 * Math.PI;
        }
        if (dumped.phi <= -0.49999 * Math.PI) {
            dumped.phi = -0.49999 * Math.PI;
        }
        
        if (this._firstPerson) {
            diffPhi = Math.abs(-dumped.phi - this._targetPhi);

            this._phi = this._targetPhi = -dumped.phi;
            // wrapping the theta
            var diff = dumped.theta + Math.PI - this._theta;
            diff %= 2 * Math.PI;
            if (diff > Math.PI) {
                diff -= 2 * Math.PI;
            } else if (diff < -Math.PI) {
                diff += 2 * Math.PI;
            }
            diffTheta = Math.abs(this._theta + diff - this._targetTheta);
            this._targetTheta = this._theta + diff;
            this._theta = this._targetTheta
            
            var dx;
            var dy;
            var dz;
            var sx = Math.sin(this._targetPhi);
            var cx = Math.cos(this._targetPhi);
            var sz = Math.sin(this._targetTheta);
            var cz = Math.cos(this._targetTheta);

            dx = cx * cz;
            dy = cx * sz;
            dz = sx;
            
            // The origin of the coordinate is at eye
            this.eye[0] = dumped.at[0] - dx * this._targetDistance;
            this.eye[1] = dumped.at[1] - dy * this._targetDistance;
            this.eye[2] = dumped.at[2] - dz * this._targetDistance;
        } else {
            diffPhi = Math.abs(dumped.phi - this._targetPhi);
            this._phi = this._targetPhi = dumped.phi;
            // wrapping the theta
            var diff = dumped.theta - this._theta;
            diff %= 2 * Math.PI;
            if (diff > Math.PI) {
                diff -= 2 * Math.PI;
            } else if (diff < -Math.PI) {
                diff += 2 * Math.PI;
            }
            diffTheta = Math.abs(this._theta + diff - this._targetTheta);
            this._targetTheta = this._theta + diff;
            this._theta = this._targetTheta;
        }

        this._at[0] = this._targetAt[0] = dumped.at[0];
        this._at[1] = this._targetAt[1] = dumped.at[1];
        this._at[2] = this._targetAt[2] = dumped.at[2];

        if (dumped.height) {
            BaseCamera.prototype._setHeight.call(this, dumped.height);
            BaseCamera.prototype.setPerspective.call(this, false);
        } else {
            // The following line is removed for MOD-4798 since at the eye of frontend,
            // fov is part of rendering setting but not camera. When switching comments,
            // the fov should not change with different camera.
            // This.setTargetFov(dumped.fov);
            BaseCamera.prototype.setPerspective.call(this, true);
        }

        if (this._scene) {
            this._updateProjection();
        }
        BaseCamera.prototype.update.apply(this, arguments);
        this._cull.update();
    };

    SceneCamera.prototype.cull = function(drawable, indices) {
        return this._cull.isCulled(drawable, indices);
    };

    SceneCamera.prototype.setFirstPerson = function(enabled, restricted) {
        if (this._firstPerson !== enabled) {
            this._targetTheta = Math.PI + this._targetTheta;
            this._targetPhi = -this._targetPhi;
        }

        // When switched back from 1st-person view, we need to fix
        // the camera's at position.
        if (!enabled) {
            this._targetAt[0] = this._at[0];
            this._targetAt[1] = this._at[1];
            this._targetAt[2] = this._at[2];

            // FIXME: this is a temp solution for avoiding the projection matrix go wrong
            // Since the diffAt of at and target at is always bigger than the threshold of 1e-8
            // once the model is panned, but directly copy the value to targetAt makes the projection matrix
            // not updated anymore. Current solution makes a small delta value from the at and the targetAt.
            // This bug will be fix better in the next version.
            this._at[0] -= 0.000001;
            this._at[1] -= 0.000001;
            this._at[2] -= 0.000001;
        }

        if (restricted !== undefined) {
            this._restricted = restricted;
        }

        BaseCamera.prototype.setFirstPerson.apply(this, arguments);
    };

    SceneCamera.prototype.isFirstPerson = function() {
        return this._firstPerson;
    };

    SceneCamera.prototype.isRestricted = function() {
        return this._restricted;
    };

    SceneCamera.prototype.isPerspective = function() {
        return this._perspective;
    };

    // Get an appropriate view distance to have a good screen size of visible
    // objects.
    SceneCamera.prototype._getViewDistance = function() {
        var distance = -Number.MAX_VALUE;
        var scale1 = 1.0 / Math.sin(this._fov * 0.00872665); //Math.PI / 180 / 2 = 0.00872665
        var scale2 = scale1 / Math.cos(this._fov * 0.00872665); //Math.PI / 180 / 2 = 0.00872665
        var scale3 = Math.tan(this._fov * 0.00872665); //Math.PI / 180 / 2 = 0.00872665
        var viewDirection = this.getTargetViewDirection();
        var off = vec3.create();
        var p = vec3.create();

        if (this._scene.layers.length !== 0) {
            for (var i = 0, len1 = this._scene.layers.length; i < len1; i++) {
                if (this._scene.layers[i].visible) {
                    for (var j = 0, len2 = this._scene.layers[i].drawables.length; j < len2; j++) {
                        var drawableData = this._scene.layers[i].drawables[j];

                        // The description of the math below can be found in MOD-2557
                        vec3.subtract(off, drawableData.bsphere, this._targetAt);
                        var at2p = vec3.dot(off, viewDirection);

                        vec3.scaleAndAdd(p, this._targetAt, viewDirection, at2p);

                        var d = vec3.distance(p, drawableData.bsphere);
                        var r = drawableData.bsphere[3];
                        var o2eye = d * scale2 + r * scale1;
                        var o2p = d * scale3;
                        var at2eye = at2p + (o2eye - o2p);

                        var thisDistance = Math.max(r, at2eye) * DISTANCERATIO;

                        distance = Math.max(distance, thisDistance);
                    }
                }
            }
        }

        if (this._scene.clipping.isEnabled()) {
            var r = this._scene.clipping.getRadius();
            var o2eye = r * scale1;
            thisDistance = Math.max(r, o2eye) * DISTANCERATIO;
            distance = Math.min(distance, thisDistance);
        }

        // FIXME: at initialization, the layers don't contain any drawables and
        // we can't compute a valid distance value using layer information.
        // We simply take the entire scene into computation.
        if (distance < 0) {
            var r = this._scene.radius;
            var o2eye = r * scale1;
            distance = Math.max(r, o2eye) * DISTANCERATIO;
        }

        return distance;
    };

    // Get the target view direction.
    SceneCamera.prototype.getTargetViewDirection = function() {
        var sx = Math.sin(this._targetPhi);
        var cx = Math.cos(this._targetPhi);
        var sz = Math.sin(this._targetTheta);
        var cz = Math.cos(this._targetTheta);

        var ret = vec3.create();

        // NOTE: The theta and phi are in the spherical coordinate whose
        // origin is at the lookat position, but no camera.
        ret[0] = -cx * cz;
        ret[1] = -cx * sz;
        ret[2] = -sx;

        // In first-person view, the origin is eye.
        if (this._firstPerson) {
            ret[0] = -ret[0];
            ret[1] = -ret[1];
            ret[2] = -ret[2];
        }

        return ret;
    };

    SceneCamera.prototype.setZoomMinMax = function(scale) {
        this._maxZoomOffset = this._initDistance * 0.025 * scale;
    };

    
    return SceneCamera;
})();
    
