//
// m3d_base_camera.js
// The base camera
//
//  

import Globals from "../../m3d_globals.js";
import MyMath  from "../../00utility/m3d_math.js";

export default (function() {
    "use strict";

    function BaseCamera(scene, eventEmitter) {
        // private:
        this._at          = [0, 0, 0];//vec3.fromValues(0, 0, 0);       // The position where we look at currently

        this._theta       = Math.PI; // The theta in the spherical coordinate.
        this._phi         = 0;
        this._distance    = 15.0; // The distance from eye to lookat position.

        this._firstPerson = false; // By default, it is 3rd-person

        this._fov         = 46; // Field of view. 46 is the field of view angle of single human eye.
        this._invTanFov   = 1.0 / Math.tan(this._fov * 0.00872665);// Math.PI / 180 / 2 = 0.00872665
        this._znear       = 0.1; // The near plane.
        this._zfar        = 1000.0; // The far plane.
        this._aspect      = Globals.width / Globals.height;
        this._eventEmitter= eventEmitter;
        
        this._perspective = true;
        this._height      = 1.0; // the height of parallel frustum 

        // public:
        this.viewport      = vec4.fromValues(0, 0, Globals.width, Globals.height);
        this.viewMatrix    = mat4.create(); // Camera matrix.
        this.projectMatrix = mat4.create(); // Projection matrix.
        this.vpMatrix      = mat4.create(); // ProjectionMatrix * CameraMatrix 
        this.eye           = new Float32Array([15, 0, 0, 1.0]);    // The camera position. It is a homogeneous coordinate.

        // initialization:
        mat4.perspective(this.projectMatrix, this._fov * Math.PI / 180, this._aspect, this._znear, this._zfar);
        mat4.identity(this.viewMatrix);
        if (gl.isWebGL2) {
            this.uniformBlock = new Float32Array(36);
        }
    }; 
    
    BaseCamera.prototype.update = function() {
        // Rotate with x first and then with z
        var sx = Math.sin(this._phi);
        var cx = Math.cos(this._phi);
        var sz = Math.sin(this._theta);
        var cz = Math.cos(this._theta);

        var m = this.viewMatrix;

        // NOTE: The theta and phi are in the spherical coordinate whose
        // origin is at the lookat position, but no camera.
        var l;
        var invL;

        m[2] = cx * cz;
        m[6] = cx * sz;
        m[10] = sx;
            
        if (this._firstPerson) {
            m[2] = -m[2];
            m[6] = -m[6];
            m[10] = -m[10];
        }
            
        if (Math.abs(this._phi) >= 0.499999 * Math.PI) {
            // up = (-sz, cz, 0);
            m[0] = cz * m[10];
            m[4] = sz * m[10];
            m[8] = -sz * m[6] - cz * m[2];
        } else {
            m[0] = -m[6];
            m[4] = m[2];
            m[8] = 0;
        }

        l = BaseCamera.prototype._length.call(this, m[0], m[4], m[8]);
        if (l > 0) {
            invL = 1.0 / l;
            m[0] *= invL;
            m[4] *= invL;
            m[8] *= invL;
        }

        m[1] = -m[10] * m[4];
        m[5] =  m[10] * m[0];
        m[9] =  m[2] * m[4] - m[6] * m[0];
        l = BaseCamera.prototype._length.call(this, m[1], m[5], m[9]);
        if (l > 0) {
            invL = 1.0 / l;
            m[1] *= invL;
            m[5] *= invL;
            m[9] *= invL;
        }
        
        if (this._firstPerson) {
            // Note that (m[2], m[6], m[10]) is from at and pointing to 
            // eye.
            this._at[0] = this.eye[0] - m[2] * this._distance;
            this._at[1] = this.eye[1] - m[6] * this._distance;
            this._at[2] = this.eye[2] - m[10] * this._distance;
        } else {
            this.eye[0] = this._at[0] + m[2] * this._distance;
            this.eye[1] = this._at[1] + m[6] * this._distance;
            this.eye[2] = this._at[2] + m[10] * this._distance;
        }
        
        m[12] = -(m[0] * this.eye[0] + m[4] * this.eye[1] + m[8] * this.eye[2]);
        m[13] = -(m[1] * this.eye[0] + m[5] * this.eye[1] + m[9] * this.eye[2]);
        m[14] = -(m[2] * this.eye[0] + m[6] * this.eye[1] + m[10] * this.eye[2]);
        
        mat4.multiply(this.vpMatrix, this.projectMatrix, this.viewMatrix);
    }; 

    BaseCamera.prototype.cull = function() {
        return false;
    };

     // Create an orthogonal matrix used for shadow map; seeing from light.
    BaseCamera.prototype.createFromLight = function(lightDirection, scene, upDir) {
        this._at = scene.clipping.getCenter();
        this._distance = scene.radius;

        this.eye = [];
        this.eye[0] = -lightDirection[0] * this._distance + this._at[0];
        this.eye[1] = -lightDirection[1] * this._distance + this._at[1];
        this.eye[2] = -lightDirection[2] * this._distance + this._at[2];

        if (!upDir) {
            mat4.lookAt(this.viewMatrix, this.eye, this._at, [0, 0, 1]);
        } else {
            mat4.lookAt(this.viewMatrix, this.eye, this._at, upDir);
        }

        var bbox = scene.clipping.get();
        var radius = Math.min(MyMath.aabb.length(bbox) / 2,scene.radius) * 1.01;
        var w = radius;    
        var h = radius;
        this._znear = this._distance - radius * 1.02;
        this._zfar  = this._distance + radius * 1.02;
        this._height = h;
        this._aspect = 1.0;
        this._perspective = false;
        mat4.ortho(this.projectMatrix, -w, w, -h, h, this._znear, this._zfar);

        mat4.multiply(this.vpMatrix, this.projectMatrix, this.viewMatrix);
    };

    BaseCamera.prototype.createFromLightTight = function(lightDirection, scene, intersections) {
        var _min = [Number.MAX_VALUE,  Number.MAX_VALUE,  Number.MAX_VALUE];
        var _max = [-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE];
        var _tmp = vec3.create();
        var i;
        for (i = 0; i < intersections.length; i++) {
            vec3.min(_min, _min, intersections[i]);
            vec3.max(_max, _max, intersections[i]);
        }
        vec3.lerp(this._at, _min, _max, 0.5);
        this._distance = scene.radius;

        var bbox = scene.clipping.get();
        var radius = Math.min(MyMath.aabb.length(bbox) / 2,scene.radius) * 1.01;

        this.eye = [];
        this.eye[0] = -lightDirection[0] * this._distance + this._at[0];
        this.eye[1] = -lightDirection[1] * this._distance + this._at[1];
        this.eye[2] = -lightDirection[2] * this._distance + this._at[2];

        mat4.lookAt(this.viewMatrix, this.eye, this._at, [0, 0, 1]);

        _min = [Number.MAX_VALUE,  Number.MAX_VALUE];
        _max = [-Number.MAX_VALUE, -Number.MAX_VALUE];

        for (i = 0; i < intersections.length; i++) {
            if (intersections[i] !== null) {
                //1. change space to light camera
                _tmp[0] = this.viewMatrix[0] * intersections[i][0] + this.viewMatrix[4] * intersections[i][1] + 
                    this.viewMatrix[8]  * intersections[i][2] + this.viewMatrix[12];
                _tmp[1] = this.viewMatrix[1] * intersections[i][0] + this.viewMatrix[5] * intersections[i][1] + 
                    this.viewMatrix[9]  * intersections[i][2] + this.viewMatrix[13];

                vec2.min(_min, _min, _tmp);
                vec2.max(_max, _max, _tmp);
            }
        } 

        this._znear = this._distance - radius * 1.02;
        this._zfar  = this._distance + radius * 1.02;
        //this._height = h;
        this._aspect = 1.0;
        this._perspective = false;
        mat4.ortho(this.projectMatrix, _min[0], _max[0], _min[1], _max[1], this._znear, this._zfar);
        mat4.multiply(this.vpMatrix, this.projectMatrix, this.viewMatrix);
    };

    BaseCamera.prototype.resize = function(width, height) {
        if (height < 1) {
            height = 1;
        }
        this._aspect = width / height;

        if (this._perspective) {
            this.projectMatrix[0] = this._invTanFov / this._aspect;
            this.projectMatrix[5] = this._invTanFov;
        } else {
            var w = this._height * this._aspect;
            var h = this._height;

            this.projectMatrix[0] = 1 / w;
            this.projectMatrix[5] = 1 / h;
        }
        
        this.viewport[0] = 0;
        this.viewport[1] = 0;
        this.viewport[2] = width;
        this.viewport[3] = height;
        
        mat4.multiply(this.vpMatrix, this.projectMatrix, this.viewMatrix);
    }; 
    
    BaseCamera.prototype.setViewport = function(viewport) {
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
    
    BaseCamera.prototype.isPerspective = function() {
        return this._perspective;
    };
    
    BaseCamera.prototype.setPerspective = function(perspective) {
        
        if (this._perspective === perspective) {
            return;
        }

        this._perspective = perspective;
        if (this._perspective) {

            this.projectMatrix[1] = 
            this.projectMatrix[2] = 
            this.projectMatrix[3] = 
            this.projectMatrix[4] = 
            this.projectMatrix[6] = 
            this.projectMatrix[7] = 
            this.projectMatrix[8] = 
            this.projectMatrix[9] = 
            this.projectMatrix[12] = 
            this.projectMatrix[13] = 
            this.projectMatrix[15] = 0;
            this.projectMatrix[11] = -1;
            
            this.projectMatrix[0] = this._invTanFov / this._aspect;
            this.projectMatrix[5] = this._invTanFov;
        } else {
            this.projectMatrix[1] = 
            this.projectMatrix[2] = 
            this.projectMatrix[3] = 
            this.projectMatrix[4] = 
            this.projectMatrix[6] = 
            this.projectMatrix[7] = 
            this.projectMatrix[8] = 
            this.projectMatrix[9] = 
            this.projectMatrix[11] = 0;
            this.projectMatrix[12] = 0;
            this.projectMatrix[13] = 0;
            this.projectMatrix[15] = 1;
            var w = this._height * this._aspect;
            var h = this._height;

            this.projectMatrix[0] = 1 / w;
            this.projectMatrix[5] = 1 / h;
        }

        mat4.multiply(this.vpMatrix, this.projectMatrix, this.viewMatrix);

        if (this._eventEmitter) {
            this._eventEmitter.emit("orthoViewChanged", !this._perspective);
        }
    };
    
    BaseCamera.prototype._setFov = function(fov) {
        if (this._fov !== fov) {
            this._fov = fov;
            this._invTanFov = 1.0 / Math.tan(this._fov * 0.00872665);

            if (this._perspective) {
                this.projectMatrix[0] = this._invTanFov / this._aspect;
                this.projectMatrix[5] = this._invTanFov;
            }
        }
    };

    BaseCamera.prototype._setHeight = function(height) {
        if (this._height !== height) {
            this._height = height;

            if (!this._perspective) {
                var w = this._height * this._aspect;
                var h = this._height;

                this.projectMatrix[0] = 1 / w;
                this.projectMatrix[5] = 1 / h;
            }
        }
    };

    BaseCamera.prototype._updateProjection = function(znear, zfar) {
        this._znear   = znear || this._znear;
        this._zfar    = zfar || this._zfar;

        // Update the project matrix.
        // Using our own code instead of glMatrix for caching tan(fov).
        var nf;
        if (this._perspective) {
            nf = 1 / (this._znear - this._zfar);
            this.projectMatrix[10] = (this._zfar + this._znear) * nf;
            this.projectMatrix[14] = 2 * this._zfar * this._znear * nf;
        } else {
            nf = 1 / (this._znear - this._zfar);
            this.projectMatrix[10] = 2 * nf;
            this.projectMatrix[14] = (this._znear + this._zfar) * nf;
        }
        
        mat4.multiply(this.vpMatrix, this.projectMatrix, this.viewMatrix);
    }; 
    
    BaseCamera.prototype.reset = function() {
        this._firstPerson = false;

        this._theta       = Math.PI; // The theta in the spherical coordinate.
        this._phi         = 0;
        this._distance    = 15.0; // The distance from eye to lookat position.

        this._fov         = 46;
        this._invTanFov   = 1.0 / Math.tan(this._fov * 0.00872665);
        this._perspective = true;
        mat4.perspective(this.projectMatrix, this._fov * Math.PI / 180, this._aspect, this._znear, this._zfar);
        
        this._at[0] = 0;
        this._at[1] = 0;
        this._at[2] = 0;

        this.eye[0] = -this._distance;
        this.eye[1] = 0;
        this.eye[2] = 0;
    }; 

    var unproject_p = [0, 0, 0];
    var unproject_ret = [0, 0, 0];
    // Find a screen point's position on the near plane in world space.
    // @param {Number} x x-coordinate obtained directly by mouse or cursor
    // @param {Number} y y-coordinate obtained directly by mouse or cursor
    // @param {Number} z the distance between this point and camera, default value is znear
    BaseCamera.prototype.unproject = function(x, y, z) {
        x = Math.floor(x * Globals.devicePixelRatio);
        y = Math.floor(y * Globals.devicePixelRatio);
        var width = Globals.width;
        var height = Globals.height;
        var zPlane;
        if (z !== undefined) {
            zPlane = z;
        } else {
            zPlane = this._znear;
        }

        var nx = x / width * 2.0 - 1.0;
        var ny = (height - 1 - y) / height * 2.0 - 1.0;
         
        var nw, nh;
        var p;
        if (this._perspective) {
            nw = zPlane / this.projectMatrix[0];
            nh = zPlane / this.projectMatrix[5];
        } else {
            nw  = 1 / this.projectMatrix[0];
            nh  = 1 / this.projectMatrix[5];
        }
            
        unproject_p[0] = this.eye[0] - this.viewMatrix[2]  * zPlane;
        unproject_p[1] = this.eye[1] - this.viewMatrix[6]  * zPlane;
        unproject_p[2] = this.eye[2] - this.viewMatrix[10] * zPlane;

        unproject_ret[0] = unproject_p[0] + nx * nw * this.viewMatrix[0] + ny * nh * this.viewMatrix[1];
        unproject_ret[1] = unproject_p[1] + nx * nw * this.viewMatrix[4] + ny * nh * this.viewMatrix[5];
        unproject_ret[2] = unproject_p[2] + nx * nw * this.viewMatrix[8] + ny * nh * this.viewMatrix[9];

        return unproject_ret;
    }; 
    
    // Project a position into screen space
    BaseCamera.prototype.project = function(modelPosition, modelMatrix) {
        var worldPosition = vec4.fromValues();
        if (!(modelMatrix === null || modelMatrix === undefined)) {
            vec3.transformMat4(worldPosition, modelPosition, modelMatrix);
        } else {
            worldPosition[0] = modelPosition[0];
            worldPosition[1] = modelPosition[1];
            worldPosition[2] = modelPosition[2];
        }
        worldPosition[3] = 1.0;

        var windowPosition = vec4.fromValues();
        vec4.transformMat4(windowPosition,worldPosition, this.vpMatrix);

        windowPosition[0] /= windowPosition[3];
        windowPosition[1] /= windowPosition[3];
        windowPosition[2] /= windowPosition[3];

        // The comment div position 
        var x = (windowPosition[0] + 1) / 2.0 * this.viewport[2] + this.viewport[0];
        var y = (windowPosition[1] + 1) / 2.0 * Globals.height;

        x = x / Globals.devicePixelRatio;
        y = (Globals.height - 1 - y) / Globals.devicePixelRatio;
        
        return [x, y, Math.sign(worldPosition[3])];
    };

    BaseCamera.prototype.setFirstPerson = function(enabled) {
        if (this._firstPerson !== enabled) {
            // transfer the theta and phi
            this._theta = Math.PI + this._theta;
            this._phi = -this._phi;

            this._firstPerson = enabled;
        }
    };
    
    BaseCamera.prototype._length = function(x, y, z) {
        return Math.sqrt(x * x + y * y + z * z);
    };
    
    var getViewDirection_ret = new Float32Array([0, 0, 0, 0]);
    BaseCamera.prototype.getViewDirection = function() {
        getViewDirection_ret[0] = -this.viewMatrix[2];
        getViewDirection_ret[1] = -this.viewMatrix[6];
        getViewDirection_ret[2] = -this.viewMatrix[10];

        return getViewDirection_ret;
    };
    
    BaseCamera.prototype.jitter = function(dx, dy) {
        if (this._perspective) {
            this.projectMatrix[8] = 2.0 * dx;
            this.projectMatrix[9] = 2.0 * dy;
        } else {
            this.projectMatrix[12] -= 2.0 * dx;
            this.projectMatrix[13] -= 2.0 * dy;
        }
    };
    
    BaseCamera.prototype.getNearPlaneSize = function() {
        if (this._perspective) {
            var tanFov = Math.tan(this._fov * 0.017453293 * 0.5);
            var nearHeight = tanFov * this._znear;
            var nearWidth = nearHeight * this._aspect;
            return [nearWidth, nearHeight, -this._znear];
        } else {
            return [1 / this.projectMatrix[0], 1 / this.projectMatrix[5], 1.0];
        }
    };
    
    BaseCamera.prototype.getFarPlaneSize = function() {
        if (this._perspective) {
            var tanFov = Math.tan(this._fov * 0.017453293 * 0.5);
            var farHeight = tanFov * this._zfar;
            var farWidth = farHeight * this._aspect;
            return [farWidth, farHeight, -this._zfar];
        } else {
            return [1 / this.projectMatrix[0], 1 / this.projectMatrix[5], 1.0];
        }
    };

    BaseCamera.prototype.transformPerspectiveToOrthogonal = function() {
        if (this._perspective) {
            //use far plane to cover most of the range
            var farPlane = this.getFarPlaneSize();
            this.setPerspective(false);
            this._setHeight(farPlane[1]);
            //make a shuffle to update the camera
            this._distance += 1.5e-4;
        }
    }; 

    /**
     * @description generate a ray starting from eye and hitting the point on near plane which corresponds
     * to screen coordinate (x, y)
     * @param {integer} x - the hit point coordinate in the screen space
     * @param {integer} y - ditto.
     * @param {vec3} point - the output ray's starting position
     * @param {vec3} direction - the output ray's normalized direction
     */
    BaseCamera.prototype.shootRay = function(x, y, point, direction) {
        var hit = this.unproject(x, y);

        if (this._perspective) {
            point[0] = this.eye[0];
            point[1] = this.eye[1];
            point[2] = this.eye[2];

            direction[0] = hit[0] - point[0];
            direction[1] = hit[1] - point[1];
            direction[2] = hit[2] - point[2];
        } else {
            point[0] = hit[0];
            point[1] = hit[1];
            point[2] = hit[2];

            direction[0] = -this.viewMatrix[2];
            direction[1] = -this.viewMatrix[6];
            direction[2] = -this.viewMatrix[10];
        }

        vec3.normalize(direction, direction);
    };

    BaseCamera.prototype.transformOrthogonalToPerspective = function() {
        if(!this._perspective) {
            this.setPerspective(true);
            //make a shuffle to update the camera
            this._distance += 1.5e-4;
        }
    };

    return BaseCamera;
})();
    
