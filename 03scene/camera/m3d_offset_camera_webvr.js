//
// m3d_offset_camera.js
// The offset camera for VR display
//
//  

import MyMath  from "../../00utility/m3d_math.js";
import Globals from "../../m3d_globals.js";
import BaseCamera from "./m3d_base_camera.js";
import Cull       from "../culling/m3d_cull.js";

export default (function() {
    "use strict";

    var _eyeMat = mat4.create();

    function OffsetCameraWebVR(scene) {
        this.viewport      = vec4.fromValues(0, 0, Globals.width, Globals.height);
        this.viewMatrix    = mat4.create(); // Camera matrix.
        this.projectMatrix = mat4.create(); // Projection matrix.
        this.vpMatrix      = mat4.create(); // ProjectionMatrix * CameraMatrix 
        this.eye           = vec3.create(); // The camera position.
        
        this._aspect        = 1.0;
        this._znear = 0.1;
        this._zfar = 1024;
        this._scene = scene;
        this._perspective = true;

        this._centerOfScene = null;
        this._sceneBoxDiagHalfLen = 0;
    };

    var tmpVec3 = vec3.create();

    OffsetCameraWebVR.prototype._updateProjection = function (projectMatrix, sceneCamera) {
        
        // currently only update the near and far when rendering scene, not panorama
        if (this._scene) {
            this._centerOfScene = MyMath.aabb.center(this._scene.bbox);
            this._sceneBoxDiagHalfLen = 0.5 * MyMath.aabb.length(this._scene.bbox);       

            vec3.subtract(tmpVec3, sceneCamera.eye, this._centerOfScene);
            var disEye2Center = vec3.length(tmpVec3);

            var n = Math.max(disEye2Center - this._sceneBoxDiagHalfLen, 0.1);
            var f = Math.min(disEye2Center + this._sceneBoxDiagHalfLen, 1024) * 1.1;

            this._znear = n;
            this._zfar = f;
        }
        

    };

    OffsetCameraWebVR.prototype.update = function (sceneCamera, eyeParam, viewMatrix) {
        this._scene = sceneCamera._scene;

        // this._phi           = sceneCamera._phi;
        // this._theta         = sceneCamera._theta;
        this._at            = sceneCamera._at;
        vec3.add(this.eye, sceneCamera.eye, eyeParam.offset);  // not really


        this._distance      = sceneCamera._distance;
        this._fov           = Math.max(eyeParam.fieldOfView.downDegrees, eyeParam.fieldOfView.upDegrees, 
                                       eyeParam.fieldOfView.leftDegrees, eyeParam.fieldOfView.rightDegrees); //

        mat4.multiply(this.viewMatrix, viewMatrix, sceneCamera.viewMatrix);

        this._updateProjection(this.projectMatrix, sceneCamera);

        mat4.perspectiveFromFieldOfView(this.projectMatrix, eyeParam.fieldOfView, this._znear, this._zfar);
        
        mat4.multiply(this.vpMatrix, this.projectMatrix, this.viewMatrix);
        
    };

    OffsetCameraWebVR.prototype.getNearPlaneSize = function() {
        return BaseCamera.prototype.getNearPlaneSize.apply(this, arguments);
    };
    
    OffsetCameraWebVR.prototype.isPerspective = function() {
        return this._perspective;
    };
    
    OffsetCameraWebVR.prototype.setViewport = function(viewport) {
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
    
    OffsetCameraWebVR.prototype.getViewDirection = function() {
        var ret = [];
        ret[0] = -this.viewMatrix[2];
        ret[1] = -this.viewMatrix[6];
        ret[2] = -this.viewMatrix[10];
        return ret;
    };

    OffsetCameraWebVR.prototype.getViewRightDirection = function() {
        var ret = [];
        ret[0] = this.viewMatrix[0];
        ret[1] = this.viewMatrix[4];
        ret[2] = this.viewMatrix[8];
        return ret;
    };
    
    OffsetCameraWebVR.prototype.cull = function(drawable) {
        // do not use culling for webvr
        return false;
    };

    OffsetCameraWebVR.prototype.resize = function(width, height) {
        BaseCamera.prototype.resize.apply(this, arguments);
    };

    OffsetCameraWebVR.prototype.setCullingEnabled = function (enabled) {
        this._cull.setEnabled(enabled);
    };

    return OffsetCameraWebVR;
})();

