//
// m3d_worker.js
// The webworker thread that computes the matrices of each drawable
//
//  

/*
var modelo3d = modelo3d || {};

var multiplyMat4 = function(mat, mat2, dest) {
	var a00 = mat[0], a01 = mat[1], a02 = mat[2], a03 = mat[3];
	var a10 = mat[4], a11 = mat[5], a12 = mat[6], a13 = mat[7];
	var a20 = mat[8], a21 = mat[9], a22 = mat[10], a23 = mat[11];
	var a30 = mat[12], a31 = mat[13], a32 = mat[14], a33 = mat[15];
	
	var b00 = mat2[0], b01 = mat2[1], b02 = mat2[2], b03 = mat2[3];
	var b10 = mat2[4], b11 = mat2[5], b12 = mat2[6], b13 = mat2[7];
	var b20 = mat2[8], b21 = mat2[9], b22 = mat2[10], b23 = mat2[11];
	var b30 = mat2[12], b31 = mat2[13], b32 = mat2[14], b33 = mat2[15];
	
	dest[0] = b00*a00 + b01*a10 + b02*a20 + b03*a30;
	dest[1] = b00*a01 + b01*a11 + b02*a21 + b03*a31;
	dest[2] = b00*a02 + b01*a12 + b02*a22 + b03*a32;
	dest[3] = b00*a03 + b01*a13 + b02*a23 + b03*a33;
	dest[4] = b10*a00 + b11*a10 + b12*a20 + b13*a30;
	dest[5] = b10*a01 + b11*a11 + b12*a21 + b13*a31;
	dest[6] = b10*a02 + b11*a12 + b12*a22 + b13*a32;
	dest[7] = b10*a03 + b11*a13 + b12*a23 + b13*a33;
	dest[8] = b20*a00 + b21*a10 + b22*a20 + b23*a30;
	dest[9] = b20*a01 + b21*a11 + b22*a21 + b23*a31;
	dest[10] = b20*a02 + b21*a12 + b22*a22 + b23*a32;
	dest[11] = b20*a03 + b21*a13 + b22*a23 + b23*a33;
	dest[12] = b30*a00 + b31*a10 + b32*a20 + b33*a30;
	dest[13] = b30*a01 + b31*a11 + b32*a21 + b33*a31;
	dest[14] = b30*a02 + b31*a12 + b32*a22 + b33*a32;
	dest[15] = b30*a03 + b31*a13 + b32*a23 + b33*a33;
	
	return dest;
};

var multiplyMat4Vec3 = function(mat, vec, dest) {
	var x = vec[0], y = vec[1], z = vec[2];
	
	dest[0] = mat[0]*x + mat[4]*y + mat[8]*z + mat[12];
	dest[1] = mat[1]*x + mat[5]*y + mat[9]*z + mat[13];
	dest[2] = mat[2]*x + mat[6]*y + mat[10]*z + mat[14];
	
	return dest;
};

var normalizeVec3 = function(v) {
    var inv = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (inv > 1e-4) {
        inv = 1.0 / inv;
        v[0] *= inv;
        v[1] *= inv;
        v[2] *= inv;
    } else {
        v[0] = 0;
        v[1] = 0;
        v[2] = 1;
    }
};

var myPostMessage = postMessage;

onmessage = function(e) {
    "use strict";

    if (e.origin.toLowerCase().indexOf("modelo") < 0) {
        return;
    }

    var data = e.data;

    var mat1 = new Float32Array(16);

    var tmp = new Uint32Array(data, 0, 1);
    var numDrawables = tmp[0];
    var vpMatrix = new Float32Array(data, 4, 16);
    var cameraPosition = new Float32Array(data, 68, 3);

    var offset = 80;

    var worldCenter = new Float32Array(3); // center in world space
    var look = new Float32Array(3);
    look[2] = 0;

    for (var i = 0; i < numDrawables; ++i) {
        var billboard   = new Uint32Array(data, offset, 1);
        var modelMatrix = new Float32Array(data, offset + 68, 16);
        
        var out_mvpMatrix = new Float32Array(data, offset + 68, 16);
        //var visible = new Uint32Array(data, offset, 1);

        if (billboard[0]) {
            var center = new Float32Array(data, offset + 4, 3);
            var radius = new Float32Array(data, offset + 16, 1);
            var out_modelMatrix = new Float32Array(data, offset + 4, 16);

            multiplyMat4Vec3(modelMatrix, center, worldCenter);
            
            look[0] = cameraPosition[0] - worldCenter[0];
            look[1] = cameraPosition[1] - worldCenter[1];
            normalizeVec3(look);

            mat1[0] = -look[1];
            mat1[1] = look[0];
            mat1[2] = 0;
            mat1[3] = 0;
            mat1[4] = -look[0];
            mat1[5] = -look[1];
            mat1[6] = 0;
            mat1[7] = 0;
            mat1[8] = 0;
            mat1[9] = 0;
            mat1[10] = 1;
            mat1[11] = 0;
            mat1[12] = worldCenter[0] - (mat1[0] * worldCenter[0] + mat1[4] * worldCenter[1]); 
            mat1[13] = worldCenter[1] - (mat1[1] * worldCenter[0] + mat1[5] * worldCenter[1]); 
            mat1[14] = 0;
            mat1[15] = 1;

            multiplyMat4(mat1, modelMatrix, out_modelMatrix);
            multiplyMat4(vpMatrix, out_modelMatrix, out_mvpMatrix);
        } else {
            multiplyMat4(vpMatrix, modelMatrix, out_mvpMatrix);
        }

        offset += 132;
    }

    myPostMessage(data, [data]);
};
*/