//
// m3d_camera_utility.js
// The utilities about camera
//
//  

import Math           from "../../00utility/m3d_math.js";
import MeshAttributes from "../../02resource/m3d_mesh_attribute.js";

(function() {
    "use strict";

    var CameraUtility = {
        // Create the camera frustum wireframe
        "createFrustumWireframe": function(camera, resourceManager) {
            // FIXME: the mesh name is not unique.
            var ret = resourceManager.getMesh("camera-frustum");
                //var frustum = modelo3d.frustum.createFromMatrix(camera.projectMatrix);
                var frustum = Math.frustum.createFromMatrix(camera.vpMatrix);
                var points = Math.frustum.points(frustum);

                var vertices = new Float32Array(3 * 8);
                var indices = new Uint8Array(24);

                vertices[0] = points[0][0]; vertices[1] = points[0][1]; vertices[2] = points[0][2];
                vertices[3] = points[1][0]; vertices[4] = points[1][1]; vertices[5] = points[1][2];
                vertices[6] = points[2][0]; vertices[7] = points[2][1]; vertices[8] = points[2][2];
                vertices[9] = points[3][0]; vertices[10] = points[3][1]; vertices[11] = points[3][2];
                vertices[12] = points[4][0]; vertices[13] = points[4][1]; vertices[14] = points[4][2];
                vertices[15] = points[5][0]; vertices[16] = points[5][1]; vertices[17] = points[5][2];
                vertices[18] = points[6][0]; vertices[19] = points[6][1]; vertices[20] = points[6][2];
                vertices[21] = points[7][0]; vertices[22] = points[7][1]; vertices[23] = points[7][2];

                indices[0] = 0; indices[1] = 1;
                indices[2] = 1; indices[3] = 2;
                indices[4] = 2; indices[5] = 3;
                indices[6] = 3; indices[7] = 0;
                
                indices[8] = 4; indices[9] = 5;
                indices[10] = 5; indices[11] = 6;
                indices[12] = 6; indices[13] = 7;
                indices[14] = 7; indices[15] = 4;
                
                indices[16] = 0; indices[17] = 4;
                indices[18] = 1; indices[19] = 5;
                indices[20] = 2; indices[21] = 6;
                indices[22] = 3; indices[23] = 7;

            if (!ret.ready) {
                var attributes = new MeshAttributes();
                attributes.builtin(gl.FLOAT);
                ret.create(gl.LINES, attributes, vertices, indices, gl.UNSIGNED_BYTE);
            } else {
                ret.update(vertices, indices, gl.UNSIGNED_BYTE);
            }

            return ret;
        }
    };

})();
    
export default CameraUtility;
