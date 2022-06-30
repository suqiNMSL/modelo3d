//
// m3d_sprite_transform.js
// The sprite of transform. The difference of sprite it is always facing
// the camera while billboard still rotates with x axis.
//
//  

var modelo3d = modelo3d || {};

modelo3d.Transform = require("../m3d_transform.js");

(function() {
    "use strict";

    modelo3d.SpriteTransform = function(matrix) {
        // Inheritance:
        modelo3d.Transform.apply(this, arguments);

        // private:
        this._lookAtMatrix    = mat4.create();
        this._lookAt          = vec3.fromValues(0, 0, 0);
        this._transformMatrix = mat4.create();
        
        // public:
        this.matrix      = mat4.create();

        // initialization:
        if (matrix) {
            mat4.copy(this._transformMatrix, matrix);
            mat4.copy(this.matrix, matrix);
        } 
    };
    
    modelo3d.SpriteTransform.prototype.setTranslation = function(x, y, z) {
        // apply transformation to transformMatrix
        mat4.copy(this.matrix, this._transformMatrix);
        modelo3d.Transform.setTranslation.apply(this, arguments);
        mat4.copy(this._transformMatrix, this.matrix);
    };

    modelo3d.SpriteTransform.prototype.setRotation = function(angle, axis) {
        // apply transformation to transformMatrix
        mat4.copy(this.matrix, this._transformMatrix);
        modelo3d.Transform.setScaling.apply(this, arguments);
        mat4.copy(this._transformMatrix, this.matrix);
    };

    modelo3d.SpriteTransform.prototype.setScaling = function(x, y, z) {
        // apply transformation to transformMatrix
        mat4.copy(this.matrix, this._transformMatrix);
        modelo3d.Transform.setScaling.apply(this, arguments);
        mat4.copy(this._transformMatrix, this.matrix);
    };
    
    modelo3d.SpriteTransform.prototype.update = function(camera) {
        var mat1 = this._lookAtMatrix;
        
        var tx = this._transformMatrix[12];
        var ty = this._transformMatrix[13];
        var tz = this._transformMatrix[14];
        
        this._lookAt[0] = camera.eye[0] - tx;
        this._lookAt[1] = camera.eye[1] - ty;
        this._lookAt[2] = camera.eye[2] - tz;
        vec3.normalize(this._lookAt, this._lookAt);

        var left = vec3.fromValues(-this._lookAt[1], this._lookAt[0], 0.0);
        vec3.normalize(left, left);
        
        var up = vec3.fromValues(-this._lookAt[0] * this._lookAt[2],
                                 -this._lookAt[1] * this._lookAt[2],
                                 this._lookAt[1] * this._lookAt[1] + this._lookAt[0] * this._lookAt[0]);
        vec3.normalize(up, up);

        mat1[0] = left[0];
        mat1[1] = left[1];
        mat1[2] = 0
        mat1[3] = 0;
        mat1[4] = -this._lookAt[0];
        mat1[5] = -this._lookAt[1];
        mat1[6] = -this._lookAt[2];
        mat1[7] = 0;
        mat1[8] = up[0];
        mat1[9] = up[1];
        mat1[10] = up[2];
        mat1[11] = 0;
        mat1[12] = tx - (mat1[0] * tx + mat1[4] * ty + mat1[8] * tz);
        mat1[13] = ty - (mat1[1] * tx + mat1[5] * ty + mat1[9] * tz);
        mat1[14] = tz - (mat1[2] * tx + mat1[6] * ty + mat1[10] * tz);
        mat1[15] = 1;

        mat4.multiply(this.matrix, mat1, this._transformMatrix);
    };

    modelo3d.SpriteTransform.prototype.attachShader = function(shader) {
        modelo3d.Transform.prototype.attachShader.apply(this, arguments);
    };
    
    modelo3d.SpriteTransform.prototype.use = function(camera, overridedTransform) {
        modelo3d.Transform.prototype.use.apply(this, arguments);
    };

    module.exports = modelo3d.SpriteTransform;
})();

