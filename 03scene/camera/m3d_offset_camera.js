//
// m3d_offset_camera.js
// The offset camera for VR display
//
//  


import BaseCamera from "./m3d_base_camera.js";
import Utils      from "../../00utility/m3d_utils.js";
import Cull       from "../culling/m3d_cull.js";

export default (function() {
    "use strict";

    function OffsetCamera(scene) {
        // Call base camera constructor:
        BaseCamera.apply(this);
        
        this._scene = scene;
        this._cull = new Cull(this);
        this._centerOffset = [0.5, 0.5];
    };
    
    OffsetCamera.prototype = Object.create(BaseCamera.prototype);
    OffsetCamera.prototype.constructor = OffsetCamera;

    OffsetCamera.prototype.update = function(sceneCamera, convergence, separation) {
        mat4.copy(this.viewMatrix, sceneCamera.viewMatrix);
        mat4.copy(this.projectMatrix, sceneCamera.projectMatrix);

        this._phi           = sceneCamera._phi;
        this._theta         = sceneCamera._theta;
        this._at            = sceneCamera._at;
        this.eye            = sceneCamera.eye;
        this._distance      = sceneCamera._distance;
        this._fov           = sceneCamera._fov;
        this._znear         = sceneCamera._znear;
        this._zfar          = sceneCamera._zfar;
        this._aspect        = sceneCamera._aspect;
        this._perspective   = sceneCamera._perspective;
        
        // skew projection matrix
        separation = separation * 0.001 / ((this._scene && this._scene.scaleRatio) || 1.0); // 0.001 converts millimeter to meter
                                                                        // divide by scaleRatio because <0.3.3 models are scaled to 1x1 bbox.
        this.projectMatrix[0] = this.projectMatrix[0] * 2;              // zero-parallax plane is zfar
        this.projectMatrix[8] = separation / sceneCamera._zfar;         // zero-parallax plane is zfar
        this.projectMatrix[12] = separation;                            // parallax at eye = IPD (separation)
        
        // adjust projection center to real IPD -- this depends on screen size
        this.projectMatrix[8] -= convergence * 0.1;                 // 1x convergence offset = 0.1x offset in screen size unit
        
        // for computing postprocessing warp
        this._centerOffset[0] = 0.5 + 0.5 * convergence * 0.1;
        /*
        if (orientation) {
            //Object.assign(this.viewMatrix, orientation.getRotationMatrix());
            mat4.multiply(this.viewMatrix, orientation.getRotationMatrix(), this.viewMatrix);    
        }*/
        
        mat4.multiply(this.vpMatrix, this.projectMatrix, this.viewMatrix);
        this._cull.update();
    };
    
    OffsetCamera.prototype.getNearPlaneSize = function() {
        return BaseCamera.prototype.getNearPlaneSize.apply(this, arguments);
    };
    
    OffsetCamera.prototype.isPerspective = function() {
        return this._perspective;
    };
    
    OffsetCamera.prototype.setViewport = function(viewport) {
        var width = viewport[2];
        var height = viewport[3];

        if (width > 4096 || height > 4096) {
            if (width >= height) {
                height = Math.floor(height * 4096 / width);
                width = 4096;
            } else {
                width = Math.floor(width * 4096 / height);
                height = 4096;
            }
        }
        this.viewport[0] = viewport[0];
        this.viewport[1] = viewport[1];
        this.viewport[2] = width;
        this.viewport[3] = height;
    };
    
    OffsetCamera.prototype.setBimCullingEnabled = function(enabled) {
        // do nothing 
    };
    
    OffsetCamera.prototype.getViewDirection = function() {
        var ret = [];
        ret[0] = -this.viewMatrix[2];
        ret[1] = -this.viewMatrix[6];
        ret[2] = -this.viewMatrix[10];
        return ret;
    };
    
    OffsetCamera.prototype.cull = function(drawable, indices) {
        return this._cull.isCulled(drawable, indices);
    };

    OffsetCamera.prototype.setCullingEnabled = function (enabled) {
        this._cull.setEnabled(enabled);
    };

    return OffsetCamera;
})();
