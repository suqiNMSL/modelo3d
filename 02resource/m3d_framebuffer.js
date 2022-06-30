//
// m3d_framebuffer.js
// The OGL resource manager (debug version)
//
//  

export default (function() {
    "use strict";
        
    function Framebuffer(name, resourceManager) {
        // private:
        this._name         = name;
        this._framebuffer  = null;
        this._colorBuffer  = null;
        this._depthBuffer  = null;
        this._manager      = resourceManager;

        // public:
        this.ready         = false;
    };

    Framebuffer.prototype.create = function(colorBuffer, depthBuffer) {
        if (this.ready) {
            return;
        }
        if (!colorBuffer.ready || (depthBuffer && !depthBuffer.ready)) {
            return;
        }
        
        this._colorBuffer = colorBuffer;
        this._depthBuffer = depthBuffer;

        this._framebuffer = gl.createFramebuffer();

        gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
        
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._colorBuffer._texture, 0);
        if (!this._depthBuffer) {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D, null, 0);
        } else if (this._depthBuffer._rbo) {
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this._depthBuffer._texture);
        } else {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D, this._depthBuffer._texture, 0);
        }

        this.ready = this._checkCompleteness();
    };
    
    Framebuffer.prototype._destroy = function() {
        if (this.ready) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D, null, 0);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, null);

            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, null);
            gl.deleteFramebuffer(this._framebuffer);
            delete this._framebuffer;
        }

        var err;
        if ((err = gl.getError()) !== gl.NO_ERROR) {
            console.log("GL error in framebuffer._destroy(): " + err);
        }
    };

    Framebuffer.prototype.destroy = function() {
        if (this.ready) {
            this._destroy();

            this.ready = false;
            
            //modelo3d.debug("framebuffer %s is destroyed.", this._name);
        }
            
        if (this._manager) {
            delete this._manager._framebuffers[this._name];
            this._manager = null;
        }
    };

    Framebuffer.prototype.resize = function(width, height) {
        if (!this.ready) {
            return;
        }

        // Don't add duplication check here such as if the color buffer and depth
        // buffer are already as the same as required resolution. Since framebuffers
        // can share textures with other framebuffers, these textures may get 
        // updated elsewhere and need to rebind to this framebuffer.

        // 4096 is the max resolution in WebGL 1.0.
        if (width > 4096 || height > 4096) {
            if (width >= height) {
                height = Math.floor(height * 4096 / width);
                width  = 4096;
            } else {
                width  = Math.floor(width * 4096 / height);
                height = 4096;
            }
        } 

        this.ready = false;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
        
        // Resize the textures. Note that textures may be shared by multiple framebuffer,
        // but since we are in a single thread, we won't resize the same texture twice given
        // the sanity check in the beginning of texture.resize().
        this._colorBuffer.resize(width, height);
        this._depthBuffer.resize(width, height);
        if (!this._colorBuffer.ready || !this._depthBuffer.ready) {
            this.destroy();
            return ;
        }

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._colorBuffer._texture, 0);
        if (this._depthBuffer._rbo) {
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this._depthBuffer._texture);
        } else {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D, this._depthBuffer._texture, 0);
        }

        this.ready = this._checkCompleteness();
    }; 

    Framebuffer.prototype._checkCompleteness = function() {
        var completed = false;
        var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        switch (status) {
            case gl.FRAMEBUFFER_COMPLETE:
                completed = true;
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
                console.log("Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_ATTACHMENT");
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
                console.log("Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT");
                break;
            case gl.FRAMEBUFFER_INCOMPLETEDIMENSIONS:
                console.log("Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_DIMENSIONS");
                break;
            case gl.FRAMEBUFFER_UNSUPPORTED:
                console.log("Incomplete framebuffer: FRAMEBUFFER_UNSUPPORTED");
                break;
            default:
                console.log("Incomplete framebuffer: " + status);
                break;
        }

        if (gl.getError() !== gl.NO_ERROR) {
            completed = false;
        }

        return completed;
    };

    Framebuffer.prototype.getWidth = function() {
        if (!this.ready) {
            return -1;
        }

        return this._colorBuffer.width;
    };
    Framebuffer.prototype.getHeight = function() {
        if (!this.ready) {
            return -1;
        }

        return this._colorBuffer.height;
    };

    Framebuffer.prototype.use = function() {
        if (!this.ready) {
            console.error("framebuffer " + this._name + " is not ready.");
            return;
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
    }; 
        
    Framebuffer.prototype.getColorBuffer = function() {
        if (this.ready) {
            return this._colorBuffer;
        }
        return null;
    };
    Framebuffer.prototype.getDepthBuffer = function() {
        if (this.ready) {
            return this._depthBuffer;
        }
        return null;
    };

    Framebuffer.prototype.discard = function() {
        if (this.ready) {
            if (this._depthBuffer) {
                this._depthBuffer.discard();
            }
            this._colorBuffer.discard();

            gl.deleteFramebuffer(this._framebuffer);
            this._framebuffer = null;
            this.ready = false;
        }
    };
    
    Framebuffer.prototype.restore = function() {
        if (!this.ready) {
            if (this._depthBuffer) {
                this._depthBuffer.restore();
            }
            this._colorBuffer.restore();

            if (!this._colorBuffer.ready || (this._depthBuffer && !this._depthBuffer.ready)) {
                return ;
            }
        
            this._framebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
        
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._colorBuffer._texture, 0);
            if (!this._depthBuffer) {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D, null, 0);
            } else if (this._depthBuffer._rbo) {
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this._depthBuffer._texture);
            } else {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D, this._depthBuffer._texture, 0);
            }

            this.ready = this._checkCompleteness();
        }
    };

    return Framebuffer;
})();
    
