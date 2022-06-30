//
// m3d_zeroarea_cull.js
// When a drawable's projection area is less than 2x2 pixels, we don't render (cull) it. 
// 
//  

import Globals from "../../m3d_globals.js";
import MyMath  from "../../00utility/m3d_math.js";

export default (function() {
    "use strict";

    function ZeroAreaCull(camera) {
        this._camera = camera;
        this._scene  = camera._scene;
        this._threshold = new Float32Array(1);
    };
    
    ZeroAreaCull.prototype.update = function() {
        var invx = 2.0 / Globals.width; 
        var invy = 2.0 / Globals.height;

        // 2x2 pixel size
        this._threshold = Math.min(invx, invy) * 4.0;
    };
    
    // precise bounding box projection
    // https://data.icg.tugraz.at/~dieter/publications/Schmalstieg_031.pdf
    var VERTICES_LUT = [
        0, 0, 0, 0, 0, 0, 0, // inside
        4, 0, 4, 7, 3, 0, 0, // left
        4, 1, 2, 6, 5, 0, 0, // right
        0, 0, 0, 0, 0, 0, 0, // -
        4, 0, 1, 5, 4, 0, 0, // bottom
        6, 0, 1, 2, 6, 5, 4, // bottom, right
        6, 0, 1, 2, 6, 5, 4, // bottom, right
        0, 0, 0, 0, 0, 0, 0, // -
        4, 2, 3, 7, 6, 0, 0, // top
        6, 4, 7, 6, 2, 3, 0, // top, left
        6, 2, 3, 7, 6, 5, 1, // top, right
        0, 0, 0, 0, 0, 0, 0, //-
        0, 0, 0, 0, 0, 0, 0, //-
        0, 0, 0, 0, 0, 0, 0, //-
        0, 0, 0, 0, 0, 0, 0, //-
        0, 0, 0, 0, 0, 0, 0, //-
        4, 0, 3, 2, 1, 0, 0, // front
        6, 0, 4, 7, 3, 2, 1, // front, left
        6, 0, 3, 2, 6, 5, 1, // front, right
        0, 0, 0, 0, 0, 0, 0, // -
        6, 0, 3, 2, 1, 5, 4, // front, bottom
        6, 1, 5, 4, 7, 3, 2, // front, bottom, left
        6, 0, 3, 2, 6, 5, 4, // front, bottom, right
        0, 0, 0, 0, 0, 0, 0, // -
        6, 0, 3, 7, 6, 2, 1, // front, top
        6, 0, 4, 7, 6, 2, 1, // front, top, left
        6, 0, 3, 7, 6, 5, 1, // front, top, right
        0, 0, 0, 0, 0, 0, 0, // -
        0, 0, 0, 0, 0, 0, 0, // -
        0, 0, 0, 0, 0, 0, 0, // -
        0, 0, 0, 0, 0, 0, 0, // -
        0, 0, 0, 0, 0, 0, 0, // -
        4, 4, 5, 6, 7, 0, 0, // back
        6, 4, 5, 6, 7, 3, 0, // back, left
        6, 1, 2, 6, 7, 4, 5, // back, right
        0, 0, 0, 0, 0, 0, 0, // -
        6, 0, 1, 5, 6, 7, 4, // back, bottom
        6, 0, 1, 5, 6, 7, 3, // back, bottom, left
        6, 0, 1, 2, 6, 7, 4, // back, bottom, right
        0, 0, 0, 0, 0, 0, 0, // -
        6, 2, 3, 7, 4, 5, 6, // back, top
        6, 0, 4, 5, 6, 2, 3, // back, top, left
        6, 1, 2, 3, 7, 4, 5, // back, top, right
    ];

    var vertices2D = [];
    vertices2D[0] = [0, 0, 0, 0];
    vertices2D[1] = [0, 0, 0, 0];
    vertices2D[2] = [0, 0, 0, 0];
    vertices2D[3] = [0, 0, 0, 0];
    vertices2D[4] = [0, 0, 0, 0];
    vertices2D[5] = [0, 0, 0, 0];

    var points = [
        [0, 0, 0, 1],
        [0, 0, 0, 1],
        [0, 0, 0, 1],
        [0, 0, 0, 1],
        [0, 0, 0, 1],
        [0, 0, 0, 1],
        [0, 0, 0, 1],
        [0, 0, 0, 1],
    ];
    function CalculateBoxAreaPrecisely(bbox, camera) {
        var eye = camera.eye;

        var pos = ((eye[0] < bbox[0])) + // 1 = left | compute 6-bit
                  ((eye[0] > bbox[3]) << 1) + // 2 = right | code to
                  ((eye[2] < bbox[2]) << 2) + // 4 = bottom | classify eye
                  ((eye[2] > bbox[5]) << 3) + // 8 = top |with respect to
                  ((eye[1] < bbox[1]) << 4) + // 16 = front | the 6 defining
                  ((eye[1] > bbox[4]) << 5); // 32 = back | planes
        var numVertices = VERTICES_LUT[pos * 7];
        if (numVertices === 0) {
            //return a large value if inside
            return 1000000000.0; // look up number of vertices
        }

        MyMath.aabb.points3(bbox, points);
        for(var i = 0; i < numVertices; i++) {
            var index = VERTICES_LUT[pos * 7 + 1 + i];
            vec4.transformMat4(vertices2D[i], points[index], camera.vpMatrix);
            vertices2D[i][0] /= vertices2D[i][3];
            vertices2D[i][1] /= vertices2D[i][3];
        }
        var sum = (vertices2D[0][0] - vertices2D[numVertices - 1][0]) * (vertices2D[numVertices - 1][1] + vertices2D[0][1]);
        for (var i = 0; i < numVertices - 1; i++) {
            sum += (vertices2D[i + 1][0] - vertices2D[i][0]) * (vertices2D[i][1] + vertices2D[i + 1][1]);
        }

        //console.log(sum);

        return sum; // return double of area of projected bbox.
    };

    var v0 = new Float32Array(3); // the vector from camera position to center of drawable.
    function CalculateBoxAreaApproximately(bsphere, camera) {
        var r = bsphere[3];
        var f = camera.projectMatrix[5]; // ctan(fov/2)
        vec3.subtract(v0, bsphere, camera.eye);
        // the distance from center of sphere to the eye in view direction.
        var d = -(v0[0] * camera.viewMatrix[2] +
                  v0[1] * camera.viewMatrix[6] +
                  v0[2] * camera.viewMatrix[10]);

        // The ratio of projected radius on the near over near plane size.
        return r * f / d;
    };


    ZeroAreaCull.prototype.isCulled = function(drawable) {
        // TODO: consider ortho view
        if (!this._camera.isPerspective()) {
            return false;
        }

        // The projection area computation about bbox is only valid when it is 
        // fully inside the frustum. If any corner of it is behind near plane,
        // it does not generate right answer.
        // On the other hand, when scene is intersecting the frustum, it means
        // camera is close. In this case, most of objects look large on the screen
        // and no need to do zero area culling.
        
        //if (//CalculateBoxAreaPrecisely(drawable.bbox, this._camera) < this._threshold) {
        //    CalculateBoxAreaApproximately(drawable.bsphere, this._camera)  < this._threshold) {
        //    return true;
        //}
        var ratio = CalculateBoxAreaApproximately(drawable.bsphere, this._camera);
        if (ratio > 0 && ratio < this._threshold) {
            return true;
        }
        
        // For instanced drawables, we see if their mesh bbox is too small to visible
        if (drawable.meshRadius) {
            var f = this._camera.projectMatrix[5]; // ctan(fov/2)
            if (drawable.meshRadius * f / this._camera._distance < this._threshold) {
                return true;
            }
        }

        return false;
    };

    return ZeroAreaCull;
})();
    

