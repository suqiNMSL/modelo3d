//
// m3d_transform.js
// The transform of drawable
//
//  

export default (function() {
    "use strict";

    function Transform(matrix) {
        // private:
        
        // public:
        this.identity = true;
        this.count    = 1;    // we only have one transform

        // initialization:
        if (matrix) {
            this.identity = false;
            this.matrix = mat4.clone(matrix);
        } else {
            this.matrix = new Float32Array(16);
            mat4.identity(this.matrix);
        } 
        this._buffer = this.matrix;
    };

    Transform.prototype.destroy = function() {
        this._buffer = null;
        delete this._buffer;

        this.matrix = null;
        delete this.matrix;
    };

    Transform.prototype.use = function(camera, shader) {
        var uniform = null;

        var parameter = gl.isWebGL2? "m_uPerNode" : "m_uPerNode.modelMatrix";
        uniform = shader.reservedUniforms[parameter];
        if (uniform) {
            uniform.upload(this._buffer);
        }
    };

    Transform.prototype._setTranslation = function(x, y, z) {
        this.identity = false;

        this.matrix[12] = x;
        this.matrix[13] = y;
        this.matrix[14] = z;
    }; 
        
    var identityMatrix = mat4.create();

    Transform.prototype._setRotation = function(angle, axis) {
        this.identity = false;

        // Compute the scaling factor.
        var c0 = [this.matrix[0], this.matrix[1], this.matrix[2]];
        var c1 = [this.matrix[4], this.matrix[5], this.matrix[6]];
        var c2 = [this.matrix[8], this.matrix[9], this.matrix[10]];

        var sx = Math.sqrt(vec3.dot(c0, c0));
        var sy = Math.sqrt(vec3.dot(c1, c1));
        var sz = Math.sqrt(vec3.dot(c2, c2));
        
        mat4.rotate(this.matrix, identityMatrix, angle, axis);

        // Multiply the scaling factor
        this.matrix[0]  *= sx;
        this.matrix[1]  *= sx;
        this.matrix[2]  *= sx;

        this.matrix[4]  *= sy;
        this.matrix[5]  *= sy;
        this.matrix[6]  *= sy;

        this.matrix[8]   *= sz;
        this.matrix[9]   *= sz;
        this.matrix[10]  *= sz;
    }; 

    Transform.prototype._setScaling = function(x, y, z) {
        this.identity = false;

        var c0 = [this.matrix[0], this.matrix[1], this.matrix[2]];
        var c1 = [this.matrix[4], this.matrix[5], this.matrix[6]];
        var c2 = [this.matrix[8], this.matrix[9], this.matrix[10]];

        var oldx = Math.sqrt(vec3.dot(c0, c0));
        var oldy = Math.sqrt(vec3.dot(c1, c1));
        var oldz = Math.sqrt(vec3.dot(c2, c2));

        // Compute the current scaling factor.
        var ratiox = x / oldx;
        var ratioy = y / oldy;
        var ratioz = z / oldz;

        this.matrix[0]  *= ratiox;
        this.matrix[1]  *= ratiox;
        this.matrix[2]  *= ratiox;

        this.matrix[4]  *= ratioy;
        this.matrix[5]  *= ratioy;
        this.matrix[6]  *= ratioy;

        this.matrix[8]  *= ratioz;
        this.matrix[9]  *= ratioz;
        this.matrix[10] *= ratioz;
    }; 

    // Set the transformation matrix directly, i.e., 4x4 matrix in column major.
    Transform.prototype.setTransform = function(matrix) {
        if (matrix) {
            this.identity = false;
            mat4.copy(this.matrix, matrix);
        } else {
            this.matrix = new Float32Array(16);
            mat4.identity(this.matrix);
        } 
    };

    Transform.prototype.reset = function() {
        this.identity = true;
        mat4.identity(this.matrix);
    };

    Transform.prototype.getInvertedTransform = function(output) {
        mat4.invert(output, this.matrix);
    };

    Transform.prototype.accumulate = function(otherMatrix) {
        if (this.identity) {
            return this.matrix;
        } else {
            var out = mat4.create();
            mat4.multiply(out, this.matrix, otherMatrix);
            return out;
        }
    };

    var inverse_ret = [0, 0, 0];
    Transform.prototype.inverse = function(vec) {
        if (!this.identity) {
            mat4.invert(inv, this.matrix);
            mat4.multiplyVector3(inverse_ret, inv, vec);
            return inverse_ret;
        }

        return vec;
    };

    return Transform;
})();
    
