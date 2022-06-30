//
// m3d_rendertarget.js
// A render target is the 
//
//  


export default (function() {
    "use strict";

    //
    // options: { 
    //   clearColor:  [R, G, B, A], # a vec4, the background of the color buffer
    //   colorMask:   [true, true, true, true], # a boolean vec4, whether color buffer is writable 
    //   depthTest: true, # enable depth testing
    //   depthMask: true, # enable depth writing
    //   depthFunc: gl.LESS, # the default depth testing function
    //   clearDepth: 1.0, # the depth buffer background value
    //   stencilTest: true, # enable stencil testing
    //
    //   colorFormat: the color format 
    //   colorBuffer: an integer. It gives the id of this color buffer. When another color with 
    //   same id and same resolution+format is found in current resource pool, it will be reused
    //   for this render target. By default, it is -1, and this color buffer will not be shared with
    //   others. The common practice is when a color buffer should be resident in the memory, e.g.,
    //   used in next frame or valid during the entire frame, it should be set to -1. If it is only
    //   a temporary rendertarget, set to an incremental ID series in one rendering effect.
    //   colorFilter: the texture filtering of the buffer. Linear by default.
    //   colorWrap: the texture filtering of the buffer. Using clamp to edge by default.
    //
    //   depthXXXX: ditto for the depth buffer
    //   }
    //
    //   By default if options is empty. We can will create an
    //   RGBA color buffer with wrapping mode of clamp-to-edge and filtering mode of linear, and 
    //   DEPTH24 depth buffer with wrapping mode of clamp-to-edge and filtering mode of linear.
    function RenderTarget(name, resourceManager, width, height, options) {
        // public:
        this.ready = false;
        this.always = false; // always applied

        // private:
        this._name        = name;
        this._options     = options || {};
        this._framebuffer = null;
        
        if (!this._options.hasOwnProperty("clearColor")) {
            this._options.clearColor = new Float32Array([1.0, 1.0, 1.0, 0.0]);
        }
        if (!this._options.hasOwnProperty("colorMask")) {
            this._options.colorMask = new Int32Array([1, 1, 1, 1]);
        }
        if (!this._options.hasOwnProperty("depthTest")) {
            this._options.depthTest = true;
        }
        if (!this._options.hasOwnProperty("depthMask")) {
            this._options.depthMask = true;
        }
        if (!this._options.hasOwnProperty("clearDepth")) {
            this._options.clearDepth = true;
        }
        if (!this._options.hasOwnProperty("depthFunc")) {
            this._options.depthFunc = gl.LESS;
        }
        if (!this._options.hasOwnProperty("blend")) {
            this._options.blend = false;
        }
        if (!this._options.hasOwnProperty("stencilTest")) {
            this._options.stencilTest = false;
        }
        if (!this._options.hasOwnProperty("stencilOp")) {
            this._options.stencilOp = [gl.KEEP, gl.KEEP, gl.REPLACE];
        }
        if (!this._options.hasOwnProperty("stencilFunc")) {
            this._options.stencilFunc = [gl.ALWAYS, 0, -1];
        }
        
        this._framebuffer = resourceManager.getFramebuffer(this._name);
        // Only create the framebuffer object when it does not exist.
        if (!this._framebuffer.ready) {
            var colorBuffer = -1;
            if (options.hasOwnProperty("colorBuffer")) {
                colorBuffer = options.colorBuffer;
            } 
            var depthBuffer = -1;
            if (options.hasOwnProperty("depthBuffer")) {
                depthBuffer = options.depthBuffer;
            } 

            var colorFormat = options.colorFormat || gl.RGBA;
            var depthFormat = options.depthFormat || gl.DEPTH_STENCIL;
            if (this._options.stencilTest) {
                depthFormat = gl.DEPTH_STENCIL;
            }

            var bufferName;
            // Convert color buffer ID to a string.
            if (colorBuffer === -1) {
                bufferName = name + "-cbuf";
            } else {
                // NOTE: All shared framebuffer textures will resize at the same time, so it is safe to use their resolution to 
                // identify them.
                bufferName = "c" + colorBuffer.toString() + "-" + width.toString() + "x" + height.toString() + "-" + colorFormat;
            }
            var colorBufferObject = resourceManager.getTexture(bufferName);
            if (!colorBufferObject.ready) {
                colorBufferObject.create(width, height, colorFormat, options.colorFilter, options.colorWrap);
                if (!colorBufferObject.ready) {
                    colorBufferObject.destroy();
                    this.ready = false;
                    return ;
                }
            }
            
            if (depthBuffer === -1) {
                bufferName = name + "-dbuf";
            } else {
                bufferName = "d" + depthBuffer.toString() + "-" + width.toString() + "x" + height.toString() + "-" + depthFormat;
            }
            var depthBufferObject = resourceManager.getTexture(bufferName);
            if (!depthBufferObject.ready) {
                depthBufferObject.create(width, height, depthFormat, options.depthFilter, options.depthWrap);
                if (!depthBufferObject.ready) {
                    depthBufferObject.destroy();
                    this.ready = false;
                    return ;
                }
            }

            this._framebuffer.create(colorBufferObject, depthBufferObject);
        }
    
        this.ready = this._framebuffer.ready;
    };

    RenderTarget.prototype.destroy = function() {
        if (this._name !== "default") {
            this._framebuffer.destroy();
            delete this._framebuffer;
        }
    };

    RenderTarget.prototype.render = function(renderState) {
        if (!this.ready) {
            console.log("render target '" + this._name + "' is not ready.");
            return;
        }

        renderState.useFramebuffer(this._framebuffer);

        renderState.blend(this._options.blend);

        renderState.clearColor(this._options.clearColor);
        renderState.colorMask(this._options.colorMask);
        renderState.depthTest(this._options.depthTest,
                              this._options.clearDepth,
                              this._options.depthFunc);
        renderState.depthMask(this._options.depthMask);
        renderState.stencilTest(this._options.stencilTest,
                                this._options.stencilFunc,
                                this._options.stencilOp);
    };
    
    RenderTarget.prototype.resize = function(width, height) {
        if (!this.ready) {
            console.log("render target '" + this._name + "' is not ready.");
            return;
        }

        this.ready = false;

        this._framebuffer.resize(width, height);

        this.ready = this._framebuffer.ready;
    };
    
    RenderTarget.prototype.setClearColor = function(color) {
        if (!this.ready) {
            console.log("render target " + this._name + " is not ready.");
            return;
        }

        this._options.clearColor[0] = color[0];
        this._options.clearColor[1] = color[1];
        this._options.clearColor[2] = color[2];
        this._options.clearColor[3] = color[3];
    };

    RenderTarget.prototype.getColorBuffer = function() {
        return this._framebuffer.getColorBuffer();
    };

    RenderTarget.prototype.getDepthBuffer = function() {
        return this._framebuffer.getDepthBuffer();
    };

    RenderTarget.prototype.getWidth = function() {
        return this._framebuffer.getWidth();
    };
    
    RenderTarget.prototype.getHeight = function() {
        return this._framebuffer.getHeight();
    };

    return RenderTarget;
})();

