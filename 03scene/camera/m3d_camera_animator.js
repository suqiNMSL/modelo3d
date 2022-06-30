//
// m3d_camera_animator.js
// The base class for animation of camera
//
//  


export default (function() {
    "use strict";

    function CameraAnimator() {
        this._camera = null; // The current associate camera
        this._saved  = null; // The previous animator that scene camera uses
    };

    CameraAnimator.prototype.bind = function(sceneCamera, forceReplace) {
        this._camera = sceneCamera;
        if(this._saved == null || forceReplace) {
            this._saved = this._camera.animator;
            this._camera.animator = this;
        }
    };
    
    CameraAnimator.prototype.unbind = function(sceneCamera) {
        this._camera.animator = this._saved;
        this._saved  = null;
        this._camera = null;
    };

    CameraAnimator.prototype.update = function() {
    };
    
    CameraAnimator.prototype._onStart = function() {
    };

    CameraAnimator.prototype._onEnd = function() {
    };
    return CameraAnimator;
})();
