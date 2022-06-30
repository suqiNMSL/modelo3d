//
// m3d_transform_instanced.js
// The transform of instancing drawable
//
//  

export default (function() {
    "use strict";

    // The model matrices length must be smaller than 32
    function TransformInstanced(matrices) {
        //matrices = new Float32Array(
        //    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 11.636218070983887, 3.897318124771118, 0, 1, 
        //     1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 11.36070442199707, 6.775900840759277, 0, 1, 
        //     1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 14.993080139160156, 3.6942176818847656, 0, 1]);

        // public:
        this.count      = matrices.byteLength / 64;
        this.identity   = false;
        
        // private
        this._matricesBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, this._matricesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, matrices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    };

    TransformInstanced.prototype.destroy = function() {
        gl.deleteBuffer(this._matricesBuffer);
    };

    TransformInstanced.prototype.use = function(camera, shader, base) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this._matricesBuffer);

        // matrices will be used as a per-instance transformation
        // matrix. Note that a mat4 consumes 4 consecutive locations, so
        // this will actually sit in locations, 6, 7, 8 and 9. 

        // Loop over each column of the matrix.
        var offset = base * 64;

        gl.enableVertexAttribArray(6);
        gl.enableVertexAttribArray(7);
        gl.enableVertexAttribArray(8);
        gl.enableVertexAttribArray(9);
        gl.vertexAttribPointer(6, 4, gl.FLOAT, false, 64, offset + 0);              
        gl.vertexAttribPointer(7, 4, gl.FLOAT, false, 64, offset + 16);              
        gl.vertexAttribPointer(8, 4, gl.FLOAT, false, 64, offset + 32);              
        gl.vertexAttribPointer(9, 4, gl.FLOAT, false, 64, offset + 48);              
        gl.vertexAttribDivisor(6, 1);
        gl.vertexAttribDivisor(7, 1);
        gl.vertexAttribDivisor(8, 1);
        gl.vertexAttribDivisor(9, 1);
    };
    
    // Create a new tranform of transform data at indices of this one.
    TransformInstanced.prototype.slice = function(indices) {
        var newModelMatrices = new Float32Array(indices.length * 16);

        var bufferOffset = 0;
        // TODO: optimize the copy to reduce the copy times. Consecutive transform can be copied once.
        gl.bindBuffer(gl.ARRAY_BUFFER, this._matricesBuffer);
        for (var i = 0, len = indices.length; i < len; i++) {
            gl.getBufferSubData(gl.ARRAY_BUFFER, indices[i] * 64, newModelMatrices, bufferOffset, 16);
            bufferOffset += 16;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        return new TransformInstanced(newModelMatrices);
    };

    TransformInstanced.prototype.append = function(transform) {
        this.count += 1;

        var newBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, newBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.count * 16), gl.STATIC_DRAW);

        // Copy the old buffer to the new one
        var offset = (this.count - 1) * 64;
        gl.bindBuffer(gl.COPY_READ_BUFFER, this._matricesBuffer);
        gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.ARRAY_BUFFER, 0, 0, offset);

        // Add the new transform to the tail of new buffer.
        gl.bufferSubData(gl.ARRAY_BUFFER, offset, transform);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.COPY_READ_BUFFER, null);

        // Replace the buffer object.
        gl.deleteBuffer(this._matricesBuffer);
        this._matricesBuffer = newBuffer;
    };

    TransformInstanced.prototype.getTransformData = function(index) {
        var retBuffer = new Float32Array(16);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._matricesBuffer);
        gl.getBufferSubData(gl.ARRAY_BUFFER, index * 64, retBuffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        return retBuffer;
    };

    return TransformInstanced;
})();
    
