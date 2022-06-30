//
// m3d_math.js
// math
//
//  


export default (function() {
    "use strict";

    var MyMath = {};

    // Cone
    MyMath.cone = {
        // Frustum cone
        _theta    : 0,
        _tanTheta : 0
    };

    MyMath.cone.create = function() {
        var ret = {
            tip             : vec3.create(),
            direction       : vec3.create(),
            cosThetaSquared : 0,
            sinThetaSquared : 0,
            invSinTheta     : 0
        };
        return ret;
    };

    MyMath.cone.updateShape = function(cone, fov, aspect) {
        this._theta = fov * 0.017453293 * 0.5;
        this._tanTheta = Math.tan(this._theta);
        this._tanTheta *= Math.sqrt(1 + aspect *  aspect);
        cone.cosThetaSquared = 1.0 / (this._tanTheta * this._tanTheta + 1.0);
        cone.sinThetaSquared = 1.0 - cone.cosThetaSquared;
        cone.invSinTheta = 1.0 / Math.sqrt(cone.sinThetaSquared);
    };

    //
    // Axis aligned bounding box
    //
    MyMath.aabb = {
        _vec: new Float32Array(3)
    };

    MyMath.aabb.createFromArray = function(from) {
        var out = new Float32Array(6);
        out[0] = from[0];
        out[1] = from[1];
        out[2] = from[2];
        out[3] = from[3];
        out[4] = from[4];
        out[5] = from[5];
        return out;
    };
    
    MyMath.aabb.createFromSphere = function(sphere) {
        var ret = new Float32Array(6);

        ret[0] = sphere[0] - sphere[3];
        ret[1] = sphere[1] - sphere[3];
        ret[2] = sphere[2] - sphere[3];
        ret[3] = sphere[0] + sphere[3];
        ret[4] = sphere[1] + sphere[3];
        ret[5] = sphere[2] + sphere[3];

        return ret;
    };

    // Find the aabb of 8 points' world position
    MyMath.aabb.createFromPoints = function(out, points) {
        out[0] = points[0][0];
        out[3] = points[0][0];
        
        out[1] = points[0][1];
        out[4] = points[0][1];
        
        out[2] = points[0][2];
        out[5] = points[0][2];
        
        for (var i = 1, len = points.length; i < len; i++) {
            if (out[0] > points[i][0]) {
                out[0] = points[i][0];
            }
            
            if (out[3] < points[i][0]) {
                out[3] = points[i][0];
            }
            
            if (out[1] > points[i][1]) {
                out[1] = points[i][1];
            }
            
            if (out[4] < points[i][1]) {
                out[4] = points[i][1];
            }
            
            if (out[2] > points[i][2]) {
                out[2] = points[i][2];
            }
            
            if (out[5] < points[i][2]) {
                out[5] = points[i][2];
            }
        }
        return out;
    };
    
    MyMath.aabb.copy = function(out, from) {
        out[0] = from[0];
        out[1] = from[1];
        out[2] = from[2];
        out[3] = from[3];
        out[4] = from[4];
        out[5] = from[5];

        return out;
    };
    
    var AABB_MIN = [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE];
    var AABB_MAX = [-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE];
    // create an invalid bbox.
    MyMath.aabb.create = function(min, max) {
        var out = new Float32Array(6);

        min = min || AABB_MIN; 
        max = max || AABB_MAX; 

        out[0] = min[0];
        out[1] = min[1];
        out[2] = min[2];
        out[3] = max[0];
        out[4] = max[1];
        out[5] = max[2];

        return out;
    };

    MyMath.aabb.min = function(aabb) {
        return vec3.fromValues(aabb[0], aabb[1], aabb[2]);
    };

    MyMath.aabb.max = function(aabb) {
        return vec3.fromValues(aabb[3], aabb[4], aabb[5]);
    };

    MyMath.aabb.length = function(aabb) {
        var x = aabb[3] - aabb[0];
        var y = aabb[4] - aabb[1];
        var z = aabb[5] - aabb[2];
        return Math.sqrt(x * x + y * y + z * z);
    };
    
    MyMath.aabb.isEqual = function(a, b) {
        return Math.abs(a[0] - b[0]) < 1e-6 &&
               Math.abs(a[1] - b[1]) < 1e-6 &&
               Math.abs(a[2] - b[2]) < 1e-6 &&
               Math.abs(a[3] - b[3]) < 1e-6 &&
               Math.abs(a[4] - b[4]) < 1e-6 &&
               Math.abs(a[5] - b[5]) < 1e-6;
    };

    MyMath.aabb.union = function(out, b1, b2) {
        out[0] = Math.min(b1[0], b2[0]);
        out[1] = Math.min(b1[1], b2[1]);
        out[2] = Math.min(b1[2], b2[2]);
        out[3] = Math.max(b1[3], b2[3]);
        out[4] = Math.max(b1[4], b2[4]);
        out[5] = Math.max(b1[5], b2[5]);
        return out;
    };

    // scale the aabb by a scaling factor
    MyMath.aabb.scale = function(out, src, scaling) {
        var t0 = 0.5 - scaling * 0.5;
        var t1 = 0.5 + scaling * 0.5;

        var lx = src[0] * t1 + src[3] * t0;
        var rx = src[0] * t0 + src[3] * t1;
        var ly = src[1] * t1 + src[4] * t0;
        var ry = src[1] * t0 + src[4] * t1;
        var lz = src[2] * t1 + src[5] * t0;
        var rz = src[2] * t0 + src[5] * t1;

        out[0] = lx;
        out[3] = rx;
        out[1] = ly;
        out[4] = ry;
        out[2] = lz;
        out[5] = rz;
    };

    MyMath.aabb.expand = function(out, value) {
        if (value === undefined) {
            value = 1e-4;
        }

        out[0] -= value;
        out[1] -= value;
        out[2] -= value;
        out[3] += value;
        out[4] += value;
        out[5] += value;
    };
    // Fetch 8 corners of AABB
    MyMath.aabb.points = function(aabb) {
        var points = [];

        points.push(vec3.fromValues(aabb[0], aabb[1], aabb[2]));
        points.push(vec3.fromValues(aabb[3], aabb[1], aabb[2]));
        points.push(vec3.fromValues(aabb[3], aabb[4], aabb[2]));
        points.push(vec3.fromValues(aabb[0], aabb[4], aabb[2]));
        points.push(vec3.fromValues(aabb[0], aabb[1], aabb[5]));
        points.push(vec3.fromValues(aabb[3], aabb[1], aabb[5]));
        points.push(vec3.fromValues(aabb[3], aabb[4], aabb[5]));
        points.push(vec3.fromValues(aabb[0], aabb[4], aabb[5]));

        return points;
    };

    MyMath.aabb.points2 = function(aabb, points) {
        points[0][0] = aabb[0]; points[0][1] = aabb[1]; points[0][2] = aabb[2];
        points[1][0] = aabb[3]; points[1][1] = aabb[1]; points[1][2] = aabb[2];
        points[2][0] = aabb[3]; points[2][1] = aabb[4]; points[2][2] = aabb[2];
        points[3][0] = aabb[0]; points[3][1] = aabb[4]; points[3][2] = aabb[2];
        points[4][0] = aabb[0]; points[4][1] = aabb[1]; points[4][2] = aabb[5];
        points[5][0] = aabb[3]; points[5][1] = aabb[1]; points[5][2] = aabb[5];
        points[6][0] = aabb[3]; points[6][1] = aabb[4]; points[6][2] = aabb[5];
        points[7][0] = aabb[0]; points[7][1] = aabb[4]; points[7][2] = aabb[5];

        return points;
    };
    
    MyMath.aabb.points3 = function(aabb, points) {
        points[0][0] = aabb[0]; points[0][1] = aabb[1]; points[0][2] = aabb[2];
        points[1][0] = aabb[3]; points[1][1] = aabb[1]; points[1][2] = aabb[2];
        points[2][0] = aabb[3]; points[2][1] = aabb[1]; points[2][2] = aabb[5];
        points[3][0] = aabb[0]; points[3][1] = aabb[1]; points[3][2] = aabb[5];

        points[4][0] = aabb[0]; points[4][1] = aabb[4]; points[4][2] = aabb[2];
        points[5][0] = aabb[3]; points[5][1] = aabb[4]; points[5][2] = aabb[2];
        points[6][0] = aabb[3]; points[6][1] = aabb[4]; points[6][2] = aabb[5];
        points[7][0] = aabb[0]; points[7][1] = aabb[4]; points[7][2] = aabb[5];

        return points;
    };

    // return 6 planes of aabb
    MyMath.aabb.planes = function(aabb) {
        var planes = [];

        // aabb planes: left, near, bottom, right, far, top
        planes.push(vec4.fromValues(-1, 0,  0, aabb[0]));
        planes.push(vec4.fromValues(0, -1,  0, aabb[1]));
        planes.push(vec4.fromValues(0,  0, -1, aabb[2]));
        planes.push(vec4.fromValues(1,  0,  0, -aabb[3]));
        planes.push(vec4.fromValues(0,  1,  0, -aabb[4]));
        planes.push(vec4.fromValues(0,  0,  1, -aabb[5]));

        return planes;
    };

    MyMath.aabb.volume = function(aabb) {
        var width =  aabb[3] - aabb[0];
        var height = aabb[4] - aabb[1];
        var depth =  aabb[5] - aabb[2];
        return width * height * depth;
    };

    var aabbSize_ret = {
            width:  0,
            height: 0,
            depth:  0,
    };
    MyMath.aabb.size = function(aabb) {
        aabbSize_ret.width  = aabb[3] - aabb[0];
        aabbSize_ret.height = aabb[4] - aabb[1];
        aabbSize_ret.depth  = aabb[5] - aabb[2];

        return aabbSize_ret;
    };

    MyMath.aabb.center = function(aabb) {
        return [(aabb[0] + aabb[3]) * 0.5,
                (aabb[1] + aabb[4]) * 0.5,
                (aabb[2] + aabb[5]) * 0.5];
    };

    
    /**
     * @description Transform the box with a SRT matrix. 
     * @param {object} box - the box in aabb format.
     * @param {array} transform - a 4x4 transform matrix.
     */
    var aabb_transform_points = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]];
    MyMath.aabb.transform = function(out, aabb, transform) {
        MyMath.aabb.points2(aabb, aabb_transform_points);

        vec3.transformMat4(aabb_transform_points[0], aabb_transform_points[0], transform);
        vec3.transformMat4(aabb_transform_points[1], aabb_transform_points[1], transform);
        vec3.transformMat4(aabb_transform_points[2], aabb_transform_points[2], transform);
        vec3.transformMat4(aabb_transform_points[3], aabb_transform_points[3], transform);
        vec3.transformMat4(aabb_transform_points[4], aabb_transform_points[4], transform);
        vec3.transformMat4(aabb_transform_points[5], aabb_transform_points[5], transform);
        vec3.transformMat4(aabb_transform_points[6], aabb_transform_points[6], transform);
        vec3.transformMat4(aabb_transform_points[7], aabb_transform_points[7], transform);

        out[0] = aabb_transform_points[0][0];
        out[3] = aabb_transform_points[0][0];
        out[1] = aabb_transform_points[0][1];
        out[4] = aabb_transform_points[0][1];
        out[2] = aabb_transform_points[0][2];
        out[5] = aabb_transform_points[0][2];
        
        for (var i = 1; i < 8; i++) {
            if (out[0] > aabb_transform_points[i][0]) {
                out[0] = aabb_transform_points[i][0];
            }
            
            if (out[3] < aabb_transform_points[i][0]) {
                out[3] = aabb_transform_points[i][0];
            }
            
            if (out[1] > aabb_transform_points[i][1]) {
                out[1] = aabb_transform_points[i][1];
            }
            
            if (out[4] < aabb_transform_points[i][1]) {
                out[4] = aabb_transform_points[i][1];
            }
            
            if (out[2] > aabb_transform_points[i][2]) {
                out[2] = aabb_transform_points[i][2];
            }
            
            if (out[5] < aabb_transform_points[i][2]) {
                out[5] = aabb_transform_points[i][2];
            }
        }
    };

    //
    // Plane
    //
    MyMath.plane = {};
    
    MyMath.plane.create = function(pt0, pt1, pt2) {
        var e10x = pt1[0] - pt0[0];
        var e10y = pt1[1] - pt0[1];
        var e10z = pt1[2] - pt0[2];
        var e20x = pt2[0] - pt0[0];
        var e20y = pt2[1] - pt0[1];
        var e20z = pt2[2] - pt0[2];

        var plane = vec4.create();
        plane[0] = e10y * e20z - e10z * e20y;
        plane[1] = e10z * e20x - e10x * e20z;
        plane[2] = e10x * e20y - e10y * e20x;

        plane[3] = -(plane[0] * pt0[0] + plane[1] * pt0[1] + plane[2] * pt0[2]); 
        
        this.normalize(plane);

        return plane;
    }; 

    MyMath.plane.createABCD = function(A, B, C, D) {
        var plane = vec4.fromValues(A, B, C, D);
        this.normalize(plane);
        return plane;
    };

    MyMath.plane.normalize = function(plane) {
        var len = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
        plane[0] /= len;
        plane[1] /= len;
        plane[2] /= len;
        plane[3] /= len;
    };

    //
    // Sphere
    //
    MyMath.sphere = {};

    MyMath.sphere.createFromAABB = function(aabb) {
        var ret = new Float32Array(4);
        ret[0] = (aabb[0] + aabb[3]) * 0.5;
        ret[1] = (aabb[1] + aabb[4]) * 0.5;
        ret[2] = (aabb[2] + aabb[5]) * 0.5;
        ret[3] = MyMath.aabb.length(aabb) * 0.5;

        return ret;
    };

    //
    // Frustum
    //
    MyMath.frustum = {};

    var invVpMatrix = mat4.create();

    // create 6 planes in world space of a frustum given the view-projection matrix.
    // http://ruh.li/CameraViewFrustum.html
    MyMath.frustum.createFromMatrix = function(vpMatrix) {
        var frustum = [];
        var i;
        for (i = 0; i < 14; ++i) {
            frustum.push(vec4.create());
        }

        mat4.invert(invVpMatrix, vpMatrix);
        vec4.transformMat4(frustum[6],  [-1, -1, -1, 1], invVpMatrix);
        vec4.transformMat4(frustum[7],  [1, -1, -1, 1], invVpMatrix);
        vec4.transformMat4(frustum[8],  [1, -1,  1, 1], invVpMatrix);
        vec4.transformMat4(frustum[9],  [-1, -1,  1, 1], invVpMatrix);
        vec4.transformMat4(frustum[10], [-1,  1, -1, 1], invVpMatrix);
        vec4.transformMat4(frustum[11], [1,  1, -1, 1], invVpMatrix);
        vec4.transformMat4(frustum[12], [1,  1,  1, 1], invVpMatrix);
        vec4.transformMat4(frustum[13], [-1,  1,  1, 1], invVpMatrix);

        // 6-13 are 8 corners of frustum
        for (i = 6; i < 14; ++i) {
            vec4.scale(frustum[i], frustum[i], 1.0 / frustum[i][3]);
        }

        // 0-5 are 6 planes of frustum : near, far, top, bottom, left, right
        // The plane normals point to the outside of frustum.
        var a = -vpMatrix[3];
        var b = -vpMatrix[7];
        var c = -vpMatrix[11];
        var d = -vpMatrix[15];
        frustum[0] = MyMath.plane.createABCD(a - vpMatrix[2],
                                               b - vpMatrix[6],
                                               c - vpMatrix[10],
                                               d - vpMatrix[14]);
        frustum[1] = MyMath.plane.createABCD(a + vpMatrix[2],
                                               b + vpMatrix[6],
                                               c + vpMatrix[10],
                                               d + vpMatrix[14]);
        frustum[2] = MyMath.plane.createABCD(a + vpMatrix[1],
                                               b + vpMatrix[5],
                                               c + vpMatrix[9],
                                               d + vpMatrix[13]);
        frustum[3] = MyMath.plane.createABCD(a - vpMatrix[1],
                                               b - vpMatrix[5],
                                               c - vpMatrix[9],
                                               d - vpMatrix[13]);
        frustum[4] = MyMath.plane.createABCD(a - vpMatrix[0],
                                               b - vpMatrix[4],
                                               c - vpMatrix[8],
                                               d - vpMatrix[12]);
        frustum[5] = MyMath.plane.createABCD(a + vpMatrix[0],
                                               b + vpMatrix[4],
                                               c + vpMatrix[8],
                                               d + vpMatrix[12]);

        //var frustum0 = MyMath.plane.create(frustum[11], frustum[10], frustum[7]);
        //var frustum1 = MyMath.plane.create(frustum[13], frustum[12], frustum[8]);
        //var frustum2 = MyMath.plane.create(frustum[11], frustum[12], frustum[13]);
        //var frustum3 = MyMath.plane.create(frustum[9],  frustum[8],  frustum[7]);
        //var frustum4 = MyMath.plane.create(frustum[10], frustum[13], frustum[9]);
        //var frustum5 = MyMath.plane.create(frustum[12], frustum[11], frustum[7]);
        
        return frustum;
    };

    // find 8 corners of frustum in world space 
    MyMath.frustum.points = function(frustum) {
        return frustum.slice(6);
    };

    //find 6 planes of frustum
    MyMath.frustum.planes = function(frustum){
        var planes = [];
        planes.push(frustum[0]);
        planes.push(frustum[1]);
        planes.push(frustum[2]);
        planes.push(frustum[3]);
        planes.push(frustum[4]);
        planes.push(frustum[5]);
        return planes;
    };

    //
    // Intersection test
    //
    MyMath.intersect = {
        // Temporary variables
        _temp : [0, 0, 0],
        _U    : [0, 0, 0],
        _D    : [0, 0, 0],
        _vec  : [0, 0, 0],
        _diff : [0, 0, 0],
        _v0   : [0, 0, 0],
        _v1   : [0, 0, 0],
        _v2   : [0, 0, 0]
    };

    MyMath.intersect.line_plane = function(point1, point2, plane) {
        vec3.subtract(this._diff, point1, point2);
        vec3.normalize(this._vec, this._diff);
        
        var tmp2 = vec3.dot(this._vec, plane);
        if (Math.abs(tmp2) <= 1e-3) { // parallel
            return null;
        }
        
        var m = -(vec3.dot(point2, plane) + plane[3]) / tmp2;

        for (var i = 0; i < 3; ++i) {
            if (m * this._vec[i] / this._diff[i] < 0 || 
                m * this._vec[i] / this._diff[i] > 1) {
                return null;
            }
        }
        var intersection = vec3.create();
        intersection[0] = point2[0] + m * this._vec[0];
        intersection[1] = point2[1] + m * this._vec[1];
        intersection[2] = point2[2] + m * this._vec[2];

        return intersection;
    };

    MyMath.intersect.line_frustum = function(point1, point2, frustum, intersections) {
        var pointIdx = [[0, 1, 5, 4],
                        [2, 3, 7, 6],
                        [4, 5, 6, 7],
                        [0, 3, 2, 1],
                        [0, 4, 7, 3],
                        [1, 2, 6, 5]];
        var isIntersect = false;

        for (var i = 0; i < 6; i++) {
            var plane = frustum[i]; // frustum planes stars from frustum[0]

            // get the four points of the ith plane
            // frustum points starts from frustum[6]
            var planePoints = []; 
            planePoints.push(frustum[pointIdx[i][0] + 6]);
            planePoints.push(frustum[pointIdx[i][1] + 6]);
            planePoints.push(frustum[pointIdx[i][2] + 6]);
            planePoints.push(frustum[pointIdx[i][3] + 6]); 

            var p = MyMath.intersect.line_frustum_quad(point1, point2, plane, planePoints);
            if (p !== null) {
                intersections.push(p);
                isIntersect = true;
            }
        }

        return isIntersect;
    };

    MyMath.intersect.line_aabb = function(point1, point2, aabb, intersections) {
        var aabbPlanes = MyMath.aabb.planes(aabb);
        var isIntersect = false;

        for (var i = 0; i < 6; i++) {
            var p = MyMath.intersect.line_aabb_quad(
                point1, point2, aabbPlanes[i], aabb, i);
            if (p != null) {
                intersections.push(p);
                isIntersect = true;
            }
        }

        return isIntersect;
    };
 
    MyMath.intersect.line_frustum_quad = function(point1, point2, plane, planePoints) {
        var p = null;
        p = MyMath.intersect.line_plane(point1, point2, plane);
        if (p == null) {
            return null;
        }

        if (MyMath.inside.point_triangle(planePoints[0], planePoints[1], planePoints[2], p) || 
            MyMath.inside.point_triangle(planePoints[2], planePoints[3], planePoints[0], p)) {
            return p;
        } else {
            return null;
        }
    };

    MyMath.intersect.line_aabb_quad = function(point1, point2, plane, aabb, planeId) {
        var p = null;
        p = MyMath.intersect.line_plane(point1, point2, plane);
        if (p === null) {
            return null;
        }

        var isInPlane = false;
        switch (planeId) {
            case 1: // near
            case 4: // far 
                isInPlane = MyMath.inside.point_slab(p[0], aabb[0], aabb[3]) && 
                            MyMath.inside.point_slab(p[2], aabb[2], aabb[5]); 
            break;

            case 5: // top
            case 2: // bottom 
                isInPlane = MyMath.inside.point_slab(p[0], aabb[0], aabb[3]) && 
                            MyMath.inside.point_slab(p[1], aabb[1], aabb[4]);   
            break;

            case 0: // left
            case 3: // right
                isInPlane = MyMath.inside.point_slab(p[1], aabb[1], aabb[4]) && 
                            MyMath.inside.point_slab(p[2], aabb[2], aabb[5]);                
            break;
        }
        if (isInPlane) {
            return p;
        } else {
            return null;
        }
    };

    var ray_aabb_intersection = new Array(4);

    // Compute the ray-box intersection.
    // http://www.siggraph.org/education/materials/HyperGraph/raytrace/rtinter3.htm
    // return: the intersection point and the intersection plane
    // [x, y, z, planeIndex]. 
    // planeIndex: 0 : -x, 1 : +x, 2: -y, 3: +y, 4: -z, 5: +z
    MyMath.intersect.ray_aabb = function(point, direction, aabb) {
        var tnearMax = Number.NEGATIVE_INFINITY;
        var tfarMin = Number.POSITIVE_INFINITY;
        var intersected = true;
        var intersectPlane = -1;
        for (var i = 0; i < 3; i++) {
            var d = direction[i];
            var o = point[i];
            var n = aabb[i];
            var f = aabb[i + 3];

            if (d !== 0) {
                var t0 = (n - o) / d;
                var t1 = (f - o) / d;
                var inc = 0;
                if (t0 > t1) {
                    var c = t1;
                    t1 = t0;
                    t0 = c;
                    inc = 1;
                }
                if (t0 > tnearMax) {
                    tnearMax = t0;
                    intersectPlane = i * 2 + inc;
                }
                tnearMax = Math.max(t0, tnearMax);
                tfarMin = Math.min(t1, tfarMin);

                if (tnearMax > tfarMin) {
                    intersected = false;
                    break;
                } 
                if (tfarMin < 0) {
                    intersected = false;
                    break;
                }

            } else {
                if (d < n || d > f) {
                    intersected = false;
                    break;
                }
            } 
        }

        if (intersected) {
            ray_aabb_intersection[0] = point[0] + direction[0] * tnearMax; 
            ray_aabb_intersection[1] = point[1] + direction[1] * tnearMax; 
            ray_aabb_intersection[2] = point[2] + direction[2] * tnearMax; 
            ray_aabb_intersection[3] = intersectPlane;

            return ray_aabb_intersection;
        }

        return null;
    };
    // See if sphere intersects frustum. Only returns true or false.
    MyMath.intersect.sphere_frustum = function(sphere, frustum) {
        return vec3.dot(frustum[0], sphere) + frustum[0][3] < sphere[3] &&
               vec3.dot(frustum[1], sphere) + frustum[1][3] < sphere[3] &&
               vec3.dot(frustum[2], sphere) + frustum[2][3] < sphere[3] &&
               vec3.dot(frustum[3], sphere) + frustum[3][3] < sphere[3] &&
               vec3.dot(frustum[4], sphere) + frustum[4][3] < sphere[3] &&
               vec3.dot(frustum[5], sphere) + frustum[5][3] < sphere[3];
    };

    // http://www.geometrictools.com/Documentation/IntersectionSphereCone.pdf
    MyMath.intersect.sphere_cone = function(sphere, cone) {
        vec3.scale(this._temp, cone.direction, cone.invSinTheta * sphere[3]);
        vec3.subtract(this._U, cone.tip, this._temp);
        vec3.subtract(this._D, sphere, this._U);
        var DSquared = vec3.dot(this._D, this._D);
        var e = vec3.dot(cone.direction, this._D);
        if (e > 0 && e * e >= DSquared * cone.cosThetaSquared) {
            vec3.subtract(this._D, sphere, cone.tip);
            DSquared = vec3.dot(this._D, this._D);
            e = -vec3.dot(cone.direction, this._D);
            if (e > 0 && e * e >= DSquared * cone.sinThetaSquared) {
                return DSquared <= sphere[3] * sphere[3];
            } else {
                return true;
            }
        }
        return false;
    };

    // return culled frustum by aabb
    MyMath.intersect.aabb_frustum = function(aabb, frustum) {
        var segmentPair = [[0, 1], [1, 2], [2, 3], [3, 0],
                           [4, 5], [5, 6], [6, 7], [7, 4],
                           [0, 4], [1, 5], [2, 6], [3, 7]];

        var aabbPoints = MyMath.aabb.points(aabb);
        var frustumPoints = MyMath.frustum.points(frustum);
        var intersections = [];
        var i;
        // Check the intersection of 12 lines in aabb with frustum.
        for (i = 0; i < 12; i++) {
            MyMath.intersect.line_frustum(aabbPoints[segmentPair[i][0]],
                                          aabbPoints[segmentPair[i][1]],
                                          frustum, 
                                          intersections);
        }

        // Check the intersections of 12 lines in frustum with aabb
        for (i = 0; i < 12; i++) {
            MyMath.intersect.line_aabb(frustumPoints[segmentPair[i][0]],
                                       frustumPoints[segmentPair[i][1]],
                                       aabb, 
                                       intersections);
        }

        // Check if 8 corners of aabb is inside frustum
        for (i = 0; i < 8; i++) {
            var ap = aabbPoints[i];
            if (MyMath.inside.point_frustum(ap, frustum)) {
                intersections.push(ap);
            }
        }

        // Check if 8 corners of frustum is inside aabb
        for (i = 0; i < 8; i++) {
            var fp = frustumPoints[i];
            if (MyMath.inside.point_aabb(fp, aabb)) {
                intersections.push(fp);
            }
        }

        return intersections;
    };

    MyMath.intersect.aabb_aabb = function(aabb1, aabb2) {
                // does 1st touch 2nd or inside 2nd
        return ((MyMath.inside.point_slab(aabb1[0], aabb2[0], aabb2[3]) ||
                 MyMath.inside.point_slab(aabb1[3], aabb2[0], aabb2[3])) &&
                (MyMath.inside.point_slab(aabb1[1], aabb2[1], aabb2[4]) ||
                 MyMath.inside.point_slab(aabb1[4], aabb2[1], aabb2[4])) &&
                (MyMath.inside.point_slab(aabb1[2], aabb2[2], aabb2[5]) ||
                 MyMath.inside.point_slab(aabb1[5], aabb2[2], aabb2[5]))) ||
               // does 2nd touch 1st or inside 1st
               ((MyMath.inside.point_slab(aabb2[0], aabb1[0], aabb1[3]) ||
                 MyMath.inside.point_slab(aabb2[3], aabb1[0], aabb1[3])) &&
                (MyMath.inside.point_slab(aabb2[1], aabb1[1], aabb1[4]) ||
                 MyMath.inside.point_slab(aabb2[4], aabb1[1], aabb1[4])) &&
                (MyMath.inside.point_slab(aabb2[2], aabb1[2], aabb1[5]) ||
                 MyMath.inside.point_slab(aabb2[5], aabb1[2], aabb1[5])));
    };
    
    //
    // Inside test
    //
    MyMath.inside = {
        _v0 : new Float32Array(3),
        _v1 : new Float32Array(3),
        _v2 : new Float32Array(3)
    };

    // If P is in triangle ABC
    MyMath.inside.point_triangle = function(A, B, C, P) {
        vec3.subtract(this._v0, C, A);
        vec3.subtract(this._v1, B, A);
        vec3.subtract(this._v2, P, A);
       
        var dot00 = vec3.dot(this._v0, this._v0);
        var dot01 = vec3.dot(this._v0, this._v1);
        var dot02 = vec3.dot(this._v0, this._v2);
        var dot11 = vec3.dot(this._v1, this._v1);
        var dot12 = vec3.dot(this._v1, this._v2);

        var inverDeno = 1 / (dot00 * dot11 - dot01 * dot01) ;

        var u = (dot11 * dot02 - dot01 * dot12) * inverDeno ;
        if (u < 0 || u > 1) { // if u out of range, return directly
            return false;
        }

        var v = (dot00 * dot12 - dot01 * dot02) * inverDeno ;
        if (v < 0 || v > 1) { // if v out of range, return directly
            return false;
        }

        return u + v <= 1;
    };

    MyMath.inside.point_aabb = function(point, aabb) {
        return point[0] > aabb[0] && 
               point[1] > aabb[1] && 
               point[2] > aabb[2] &&
               point[0] < aabb[3] && 
               point[1] < aabb[4] && 
               point[2] < aabb[5];
    };

    MyMath.inside.point_frustum = function(point, frustum) {
        return vec3.dot(frustum[0], point) + frustum[0][3] < 0 &&
               vec3.dot(frustum[1], point) + frustum[1][3] < 0 &&
               vec3.dot(frustum[2], point) + frustum[2][3] < 0 &&
               vec3.dot(frustum[3], point) + frustum[3][3] < 0 &&
               vec3.dot(frustum[4], point) + frustum[4][3] < 0 &&
               vec3.dot(frustum[5], point) + frustum[5][3] < 0;
    };

    MyMath.inside.sphere_frustum = function(sphere, frustum) {
        return vec3.dot(frustum[0], sphere) + frustum[0][3] < -sphere[3] &&
               vec3.dot(frustum[1], sphere) + frustum[1][3] < -sphere[3] &&
               vec3.dot(frustum[2], sphere) + frustum[2][3] < -sphere[3] &&
               vec3.dot(frustum[3], sphere) + frustum[3][3] < -sphere[3] &&
               vec3.dot(frustum[4], sphere) + frustum[4][3] < -sphere[3] &&
               vec3.dot(frustum[5], sphere) + frustum[5][3] < -sphere[3];
    };

    MyMath.inside.point_slab = function(v, min0, max0) {
        return v < max0 && v > min0;
    };

    MyMath.inside.aabb_frustum = function(aabb, frustum) {
        var points = MyMath.aabb.points(aabb);
        return MyMath.inside.point_frustum(points[0], frustum) &&
               MyMath.inside.point_frustum(points[1], frustum) &&
               MyMath.inside.point_frustum(points[2], frustum) &&
               MyMath.inside.point_frustum(points[3], frustum) &&
               MyMath.inside.point_frustum(points[4], frustum) &&
               MyMath.inside.point_frustum(points[5], frustum) &&
               MyMath.inside.point_frustum(points[6], frustum) &&
               MyMath.inside.point_frustum(points[7], frustum);
    };
    
    MyMath.outside = {};
    
    MyMath.outside.point_frustum = function(point, frustum) {
        // Interesting thing is inlining this function 
        return vec3.dot(frustum[0], point) + frustum[0][3] > 0 ||
               vec3.dot(frustum[1], point) + frustum[1][3] > 0 ||
               vec3.dot(frustum[2], point) + frustum[2][3] > 0 ||
               vec3.dot(frustum[3], point) + frustum[3][3] > 0 ||
               vec3.dot(frustum[4], point) + frustum[4][3] > 0 ||
               vec3.dot(frustum[5], point) + frustum[5][3] > 0;
    };
    
    MyMath.outside.sphere_frustum = function(sphere, frustum) {
        return vec3.dot(frustum[0], sphere) + frustum[0][3] > sphere[3] ||
               vec3.dot(frustum[1], sphere) + frustum[1][3] > sphere[3] ||
               vec3.dot(frustum[2], sphere) + frustum[2][3] > sphere[3] ||
               vec3.dot(frustum[3], sphere) + frustum[3][3] > sphere[3] ||
               vec3.dot(frustum[4], sphere) + frustum[4][3] > sphere[3] ||
               vec3.dot(frustum[5], sphere) + frustum[5][3] > sphere[3];
    };

    // see if aabb is entirely at the position side of plane.
    
    
    MyMath.outside.aabb_frustum = function(aabb, frustum) {
        // See if the aabb is outside of frustum 
        for (var i = 0; i < 6; i++) {
            // Brute force way. It is 40% slower than p-vertex, so we comment it out. 
            //if (frustum[i][0] * aabb[0][0] + frustum[i][1] * aabb[0][1] + frustum[i][2] * aabb[0][2] + frustum[i][3] > 0 &&
            //    frustum[i][0] * aabb[1][0] + frustum[i][1] * aabb[0][1] + frustum[i][2] * aabb[0][2] + frustum[i][3] > 0 &&
            //    frustum[i][0] * aabb[0][0] + frustum[i][1] * aabb[1][1] + frustum[i][2] * aabb[0][2] + frustum[i][3] > 0 &&
            //    frustum[i][0] * aabb[1][0] + frustum[i][1] * aabb[1][1] + frustum[i][2] * aabb[0][2] + frustum[i][3] > 0 &&
            //    frustum[i][0] * aabb[0][0] + frustum[i][1] * aabb[0][1] + frustum[i][2] * aabb[1][2] + frustum[i][3] > 0 &&
            //    frustum[i][0] * aabb[1][0] + frustum[i][1] * aabb[0][1] + frustum[i][2] * aabb[1][2] + frustum[i][3] > 0 &&
            //    frustum[i][0] * aabb[0][0] + frustum[i][1] * aabb[1][1] + frustum[i][2] * aabb[1][2] + frustum[i][3] > 0 &&
            //    frustum[i][0] * aabb[1][0] + frustum[i][1] * aabb[1][1] + frustum[i][2] * aabb[1][2] + frustum[i][3] > 0) {
            //    return true;
            //}
            
            // Use p-vertex
            // http://www.txutxi.com/?p=584
            var x = (frustum[i][0] > 0? aabb[0] : aabb[3]);
            var y = (frustum[i][1] > 0? aabb[1] : aabb[4]);
            var z = (frustum[i][2] > 0? aabb[2] : aabb[5]);

            if (frustum[i][0] * x + frustum[i][1] * y + frustum[i][2] * z + frustum[i][3] > 0) {
                return true;
            }
        }
        
        // if frustum is outside of aabb
        for (var i = 0; i < 3; i++) {
            if (frustum[6][i] > aabb[1][i] &&
                frustum[7][i] > aabb[1][i] &&
                frustum[8][i] > aabb[1][i] &&
                frustum[9][i] > aabb[1][i] &&
                frustum[10][i] > aabb[1][i] &&
                frustum[11][i] > aabb[1][i] &&
                frustum[12][i] > aabb[1][i] &&
                frustum[13][i] > aabb[1][i]) {
                return true;
            }
            if (frustum[6][i] < aabb[0][i] &&
                frustum[7][i] < aabb[0][i] &&
                frustum[8][i] < aabb[0][i] &&
                frustum[9][i] < aabb[0][i] &&
                frustum[10][i] < aabb[0][i] &&
                frustum[11][i] < aabb[0][i] &&
                frustum[12][i] < aabb[0][i] &&
                frustum[13][i] < aabb[0][i]) {
                return true;
            }
        }

        return false;
    };
    
    MyMath.outside.aabb_aabb = function(aabb1, aabb2) {
        return aabb1[3] <= aabb2[0] || aabb1[0] >= aabb2[3] ||
               aabb1[4] <= aabb2[1] || aabb1[1] >= aabb2[4] ||
               aabb1[5] <= aabb2[2] || aabb1[2] >= aabb2[5];
    };

    MyMath.clamp = function(val, min, max) {
        return Math.min(Math.max(val, min), max);
    };
    
    MyMath.lerp = function(start, end, ratio) {
        return start + (end - start) * ratio;
    };
    
    return MyMath;
})();

