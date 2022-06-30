//
// m3d_orientation.js
// Device/screen orientation event wrapper
//
//  

import BaseCamera from "../../03scene/camera/m3d_base_camera.js";

export default (function() {
    "use strict";

    function Orientation() {
        // public:
        this.enabled = false;
        this.modulate = false; // override the camera view matrix if true
        
        // private:
        this._initialViewMatrix = mat4.create();
        this._rotationMatrix = mat4.create();        
        this._tmpMatrix = mat4.create();        

        this._camera = null;
        this._initAlpha = null;
        this._flip = false;
        this._deviceOrientation = {"alpha": 0, "beta": 0, "gamma": 0};
        this._screenOrientation = window.orientation || 0;
        this._quatRotate = quat.create();
        this._quatOrient = quat.create();
        this._prevValues = null;
        this._medianValues = null;

        // initialization:
        window.addEventListener('orientationchange', this.onScreenOrientationChangeEvent.bind(this));
        window.addEventListener('deviceorientation', this.onDeviceOrientationChangeEvent.bind(this));
    };

    Orientation.prototype.destroy = function() {
        this.detach();

        window.removeEventListener('orientationchange', this.onScreenOrientationChangeEvent, false);
        window.removeEventListener('deviceorientation', this.onDeviceOrientationChangeEvent, false);
    };
    
    Orientation.prototype.attach = function(camera) {
        this.onScreenOrientationChangeEvent(); // initialize screen orientation

        this._camera = camera;

        this.reset(camera);

        this.enabled = true;
    };
    
    Orientation.prototype.reset = function(camera, skip) {
        // Since the initial orientation coordinate is calibrated to 
        // phi = 0 (screen orthogonal to ground), we should also adjust the
        // camera view matrix according.

        // HACK: we should not touch the private member of SceneCamera
        if (!skip) {
            camera._theta = camera._targetTheta;
            camera._distance = camera._targetDistance; 
            camera._phi = 0;
            BaseCamera.prototype.update.apply(camera);
        }
        mat4.copy(this._initialViewMatrix, camera.viewMatrix);
        this._medianValues = null;
        this._prevValues = null;
    };
    
    Orientation.prototype.detach = function() {
        this._initAlpha  = null;
        this.enabled     = false;
        this._camera     = null;
        this._prevValues = null;
        this._medianValues = null;
    };
      
    Orientation.prototype.onDeviceOrientationChangeEvent = function(orientation) {
        if (!this.enabled || !orientation.alpha) {
            return;
        }
    
        this._deviceOrientation.alpha = orientation.alpha;
        this._deviceOrientation.beta  = orientation.beta;
        this._deviceOrientation.gamma = orientation.gamma;

        var deg2rad = Math.PI / 180.0;
        var alpha  = this._deviceOrientation.alpha ? deg2rad * this._deviceOrientation.alpha : 0; // Z
        var beta   = this._deviceOrientation.beta  ? deg2rad * this._deviceOrientation.beta  : 0; // X'
        var gamma  = this._deviceOrientation.gamma ? deg2rad * this._deviceOrientation.gamma : 0; // Y''
        var orient = this._screenOrientation       ? deg2rad * this._screenOrientation       : 0; // 
        
        if (this._initAlpha === null) {
            var a, b, c;
            switch(Math.sign(orient)) {
                case -1 :
                {
                    a = alpha;
                    b = alpha + Math.PI / 2;
                    c = alpha + Math.PI;
                }
                break;
                
                case 0 :
                {
                    a = alpha - Math.PI / 2;
                    b = alpha;
                    c = alpha + Math.PI / 2;
                }
                break;
                
                case 1 :
                {
                    a = alpha - Math.PI;
                    b = alpha - Math.PI / 2;
                    c = alpha;
                }
                break;
            }
            this._initAlpha = {
                '-1' : a,
                '0'  : b,
                '1'  : c
            };

            if (Math.sign(orient) != 0 && (Math.abs(beta) > Math.PI / 2)) {
                this._flip = true;
            }
        } 
        alpha = alpha + Math.sign(orient) * Math.PI / 2 - this._initAlpha[Math.sign(orient).toString()];
        alpha = this._flip ? alpha + Math.PI : alpha;

        quat.setAxisAngle(this._quatOrient, [0, 0, 1], -orient);
        
        quat.fromYXZ(this._quatRotate, alpha, beta, -gamma);
    
        quat.multiply(this._quatRotate, this._quatRotate, [-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)]);
        quat.multiply(this._quatRotate, this._quatRotate, this._quatOrient);
        
        quat.invert(this._quatRotate,this._quatRotate);
        mat4.fromQuat(this._rotationMatrix, this._quatRotate);
        this._antiJitterValues(this._rotationMatrix);
    };
    
    Orientation.prototype.update = function() {
        // current_view_matrix = scene_camera.view_matrix * orientation.rotation_matrix        
        if (this.modulate) {
            mat4.multiply(this._tmpMatrix, this._rotationMatrix, this._camera.viewMatrix);
            mat4.copy(this._camera.viewMatrix, this._tmpMatrix);
        } else {
            mat4.multiply(this._camera.viewMatrix, this._rotationMatrix, this._initialViewMatrix);
        }
            
        mat4.multiply(this._camera.vpMatrix, this._camera.projectMatrix, this._camera.viewMatrix);
    };

    Orientation.prototype.onScreenOrientationChangeEvent = function() {
        this._screenOrientation = window.orientation || 0;
    };
    
    //https://github.com/Kjos/XposedJitteryGyroFix
    Orientation.prototype._antiJitterValues = function(values) {
        // Note about values[]:
        // values[] contains the current sensor's value for each axis (there are 3 since it's in 3D).
        // The values are measured in rad/s.
        var nAxis = 16;
        var filterSize = 10;
        
        // stores the last sensor's values in each dimension (3D so 3 dimensions)
        if (this._medianValues === null) {
            this._medianValues = new Array(nAxis);
            for (var i = 0; i < nAxis; i++) {
                this._medianValues[i] = new Array(filterSize);
                for (var j = 0; j < filterSize; j++) {
                    this._medianValues[i][j] = values[i];
                }
            }
        }
        // stores the previous sensor's values to restore them if needed
        if (this._prevValues === null) {
            this._prevValues = new Array(nAxis);
            for (var i = 0; i < nAxis; i++) {
                this._prevValues[i] = values[i];
            }
        }
        
        // Init arrays
        var tmpArray = new Array(filterSize);  // used to temporarily copy medianValues to compute the median

        // Process the gyroscope's values (3D so 3 values)
        // for each of the 3 dimensions of the gyro Updating the medianValues array, 
        // which stores the last known values to be able to compute the median
        for (var k = 0; k < nAxis; k++) {
            // shift the values in the medianValues array
            for (var i = filterSize - 1; i > 0; i--) {
                this._medianValues[k][i] = this._medianValues[k][i - 1];
            }
            this._medianValues[k][0] = values[k];

            // -- Compute the median and replace the current gyroscope's value
            var filteredval = 0.0;
            
            // Moving average
            var sum = 0.0;
            for (var m = 0; m < this._medianValues[k].length; m++) {
                sum += this._medianValues[k][m];
            }
            filteredval = sum / this._medianValues[k].length;
            
            // Update the sensor's value for each axis
            values[k] = filteredval;
            
            // Remember the current sensor's value
            this._prevValues[k] = values[k];
        }
    };
    
    Orientation.prototype.setEnabled = function(enbaled) {
        this.enabled = enbaled;
    };

    return Orientation;
})();
    
