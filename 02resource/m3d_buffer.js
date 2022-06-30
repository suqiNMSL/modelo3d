//
// m3d_buffer.js
// The array, element array buffer.
// Only used by m3d_mesh.js now.
//
// Copyright Modelo XX - 2018, All rights reserved.

export default (function() {
    "use strict";

    function Buffer(name, resourceManager) {
        // private:
        this._name = name;
        this._manager = resourceManager;
        this._target = gl.ARRAY_BUFFER;
        
        // public:
        this.buffer = gl.createBuffer();
        this.ready = false;
    };

    Buffer.prototype.destroy = function() {
        if (this.buffer !== null) {
            gl.deleteBuffer(this.buffer);
        }

        if (this.ready) {
            this.ready = false;
        
            if (this._manager) {
                delete this._manager._buffers[this._name];
                this._manager = null;
            }
        }
    };

    Buffer.prototype.create = function(target, data) {
        if (this.ready) {
            return ;
        }

        this._target = target;

        gl.bindBuffer(target, this.buffer);
        gl.bufferData(target, data, gl.STATIC_DRAW);

        if (gl.getError() === gl.NO_ERROR) {
            this.ready = true;
        } else {
            // It is very likely out of memory.
            // Clean at the exist.
            gl.deleteBuffer(this.buffer);
            this.buffer = null;
            this.ready = false;
        }
    };

    Buffer.prototype.update = function(data) {
        gl.bindBuffer(this._target, this.buffer);
        gl.bufferData(this._target, data, gl.STATIC_DRAW);

        if (gl.getError() === gl.NO_ERROR) {
            this.ready = true;
        } else {
            // It is very likely out of memory.
            // Clean at the exist.
            gl.deleteBuffer(this.buffer);
            this.buffer = null;
            this.ready = false;
        }
    };
    
    return Buffer;
})();
    
