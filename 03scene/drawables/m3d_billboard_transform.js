//
// m3d_billboard_transform.js
// The transform of billboard drawable
//
//  

import Transform from "./m3d_transform.js";

export default (function() {
    "use strict";

    function BillboardTransform(matrix) {
        // Inheritance:
        Transform.apply(this, arguments);

        // private:
        this._transformMatrix = mat4.create();
        
        // initialization:
        if (this.matrix) {
            mat4.copy(this._transformMatrix, this.matrix);
            mat4.copy(this.matrix, this.matrix);
        } 
    };
    
    BillboardTransform.prototype.setTranslation = function(x, y, z) {
        // apply transformation to transformMatrix
        mat4.copy(this.matrix, this._transformMatrix);
        Transform.setTranslation.apply(this, arguments);
        mat4.copy(this._transformMatrix, this.matrix);
    };

    BillboardTransform.prototype.setRotation = function(angle, axis) {
        // apply transformation to transformMatrix
        mat4.copy(this.matrix, this._transformMatrix);
        Transform.setRotation.apply(this, arguments);
        mat4.copy(this._transformMatrix, this.matrix);
    };

    BillboardTransform.prototype.setScaling = function(x, y, z) {
        // apply transformation to transformMatrix
        mat4.copy(this.matrix, this._transformMatrix);
        Transform.setScaling.apply(this, arguments);
        mat4.copy(this._transformMatrix, this.matrix);
    };

    var lookAt = vec3.fromValues(0, 0, 0);
    var lookAtMatrix = mat4.create();
    
    BillboardTransform.prototype.update = function(camera, center) {
        var mat1 = lookAtMatrix;

        lookAt[0] = camera.eye[0] - center[0];
        lookAt[1] = camera.eye[1] - center[1];
        lookAt[2] = 0;
        vec3.normalize(lookAt, lookAt);

        mat1[0] = -lookAt[1]
        mat1[1] = lookAt[0];
        mat1[2] = 0;
        mat1[3] = 0;
        mat1[4] = -lookAt[0];
        mat1[5] = -lookAt[1];
        mat1[6] = 0;
        mat1[7] = 0;
        mat1[8] = 0;
        mat1[9] = 0;
        mat1[10] = 1;
        mat1[11] = 0;
        mat1[12] = center[0] - (mat1[0] * center[0] + mat1[4] * center[1]); 
        mat1[13] = center[1] - (mat1[1] * center[0] + mat1[5] * center[1]); 
        mat1[14] = 0;
        mat1[15] = 1;
        
        mat4.multiply(this.matrix, mat1, this._transformMatrix);

        if (gl.isWebGL2) {
            gl.bindBuffer(gl.UNIFORM_BUFFER, this._buffer);
            gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.matrix, 0, 16);
            gl.bindBuffer(gl.UNIFORM_BUFFER, null);
        }
    };

    BillboardTransform.prototype.attachShader = function(shader) {
        Transform.prototype.attachShader.apply(this, arguments);
    };
    
    BillboardTransform.prototype.use = function(camera, overridedTransform) {
        Transform.prototype.use.apply(this, arguments);
    };

    return BillboardTransform;
})();
    
