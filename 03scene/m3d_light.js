//
// m3d_light.js
// Lights
//
//  

export default (function() {
    "use strict";

    function Light() {
        // private:
        this._initialDirection     = vec3.clone([0.81961, -0.28627, -0.49804]); // The position of the sun
        this._latitude             = Math.asin(-this._initialDirection[2]);
        this._longitude           = Math.atan2(-this._initialDirection[1], -this._initialDirection[0]);
        this._constantEnvmapMatrix = null;
        this._initialEnvmapMatrix  = null;

        // public:
        this.direction      = vec3.clone(this._initialDirection);
        this.intensity      = 1.05;
        this.shinness      = 100.0;
        this.envmapMatrix   = mat4.create();

        
        // initializatoin.
        
        // http://www.cs.berkeley.edu/~ravir/papers/envmap/envmap.pdf
        // The diffuse light matrix (Y is up)
        var matrixR = mat4.clone([
                     1.586253, -0.725169,  0.704410, -2.300680,
                    -0.725169, -1.586253, -0.359456,  1.623691,
                     0.704410, -0.359456, -0.237555, -0.893975,
                    -2.300680,  1.623691, -0.893975,  6.141995
                ]);
        var matrixG = mat4.clone([
                 1.329145, -0.730669,  0.591031, -2.126058, 
                -0.730669, -1.329145, -0.403495,  1.890295,
                 0.591031, -0.403495, -0.159067, -0.888839,
                -2.126058,  1.890295, -0.888839,  6.193693
                ]);
        var matrixB = mat4.clone([
                 0.870924, -0.654664,  0.433506, -1.748137,
                -0.654664, -0.870924, -0.440849,  2.254821,
                 0.433506, -0.440849, -0.109753, -0.848042,
                -1.748137,  2.254821, -0.848042,  6.301804
                ]);
        // Merge three RGB matrices into a luminance matrix.
        var SCALING = 0.1;
        mat4.multiplyScalar(matrixR, matrixR, 0.299 * SCALING);
        mat4.multiplyScalar(matrixG, matrixG, 0.587 * SCALING);
        mat4.multiplyScalar(matrixB, matrixB, 0.114 * SCALING);
        
        mat4.add(this.envmapMatrix, matrixR, matrixG);
        mat4.add(this.envmapMatrix, this.envmapMatrix, matrixB);
        
        this._constantEnvmapMatrix = mat4.clone(this.envmapMatrix);
        this._initialEnvmapMatrix = mat4.clone(this.envmapMatrix);

        this._initialDirection = vec3.clone([0.81961, -0.49804, 0.28627]);
        this._initialEnvmapMatrix = mat4.clone(this._constantEnvmapMatrix);
        
        this._setFlipYZ(false);
        
        // FIXME: the numbers are from initial values of the lighting sliders
        // in model-effects-services.js
        this.setLatitude(0.17 * Math.PI);
        this.setLongitude(0.89 * 2 * Math.PI);
        
        
    }; // end of Light

    Light.prototype._setFlipYZ = function(enabled) {
        // By default z is up
        this._flipYZ = enabled;
        if (!enabled) {
            this._initialDirection     = vec3.clone([0.81961, -0.28627, -0.49804]); 

            var zUpMatrix = mat4.clone([
                    1, 0, 0, 0,
                    0, 0, -1, 0,
                    0, 1, 0, 0,
                    0, 0, 0, 1
                    ]);
            var zUpMatrixT = mat4.create();
            mat4.transpose(zUpMatrixT, zUpMatrix);
            var tempMatrix = mat4.create();
            mat4.multiply(this._initialEnvmapMatrix, mat4.multiply(tempMatrix, zUpMatrixT, this._constantEnvmapMatrix), zUpMatrix);
        } else {
            this._initialDirection = vec3.clone([0.81961, -0.49804, 0.28627]);
            this._initialEnvmapMatrix = mat4.clone(this._constantEnvmapMatrix);
        }
    };
    
    Light.prototype.setIntensity = function(intensity) {
        this.intensity = intensity;
    };

    Light.prototype.getIntensity = function () {
        return this.intensity;
    };

    Light.prototype.setSpecularShinness = function(intensity) {
        this.shinness = intensity;
    };

    Light.prototype.getIntensity = function () {
        return this.intensity;
    };

    Light.prototype.setLatitude = function(angle) {
        this._latitude = angle;
        
        // Update the light direction.
        var c = Math.cos(this._latitude);
        this.direction[0] = -(c * Math.cos(this._longitude));
        this.direction[1] = -(c * Math.sin(this._longitude));
        this.direction[2] = -(Math.sin(this._latitude));

        this._updateEnvmapMatrix();
    };

    Light.prototype.setLongitude = function(angle) {
        this._longitude = angle;
        
        // Update the light direction.
        var c = Math.cos(this._latitude);
        this.direction[0] = -(c * Math.cos(this._longitude));
        this.direction[1] = -(c * Math.sin(this._longitude));
        this.direction[2] = -Math.sin(this._latitude);

        this._updateEnvmapMatrix();
    };

    Light.prototype.getLongitude = function() {
        return this._longitude;
    };
    
    Light.prototype.getLatitude = function() {
        return this._latitude;
    };
    
    Light.prototype._updateEnvmapMatrix = function() {
        // Quaternion to vector from one to another
        // http://stackoverflow.com/questions/1171849/finding-quaternion-representing-the-rotation-from-one-vector-to-another
        var q = quat.create();
        var a = vec3.create();
        // The rotation matrix of the environmap is inverted to the rotation of the light.
        vec3.cross(a, this.direction, this._initialDirection);
        q[0] = a[0];
        q[1] = a[1];
        q[2] = a[2];
        q[3] = 1.0 + vec3.dot(this.direction, this._initialDirection);
        quat.normalize(q, q);
        
        var rotMat = mat4.create();
        mat4.fromQuat(rotMat, q);
            
        var rotMatT = mat4.create();
        mat4.transpose(rotMatT, rotMat);
            
        var tempMat = mat4.create();
        mat4.multiply(this.envmapMatrix, mat4.multiply(tempMat, rotMatT, this._initialEnvmapMatrix), rotMat);
    };

    return Light;
})();
    
