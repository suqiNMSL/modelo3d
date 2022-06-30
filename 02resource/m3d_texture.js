//
// m3d_texture.js
// The texture wrapper
//
//  

export default (function() {
    "use strict";

    function Texture(name, resourceManager) {
        // private:
        this._name              = name;
        this._internalFormat    = gl.RGBA;
        this._format            = gl.RGBA;
        this._type              = gl.UNSIGNED_BYTE;
        this._wrap              = gl.CLAMP_TO_EDGE;
        this._filter            = gl.LINEAR;
        this._manager           = resourceManager;
        this._mipmap            = false;
        this._rbo               = false;
        this._target            = gl.TEXTURE_2D;

        // public:
        this.ready              = false;
        this.width              = 1;
        this.height             = 1;
        this.kbytes             = 0;
    };
    
    Texture.prototype.destroy = function() {
        if (this.ready) {
            if (this._rbo) {
                gl.deleteRenderBuffer(this._texture);
            } else {
                gl.deleteTexture(this._texture);
            }
            delete this._texture;
            this.ready = false;

            var err;
            if ((err = gl.getError()) !== gl.NO_ERROR) {
                console.log("GL error in texture.destroy(): " + err);
            }
        }
        if (this._manager) {
            delete this._manager._textures[this._name];
            this._manager = null;
        }
        //modelo3d.debug("texture %s is destroyed.", this._name);
    }; 

    Texture.prototype._create = function(image) {
        this._texture = gl.createTexture();

        var magFilter = gl.NEAREST;

        // derive magnify filter from minimizing filter.
        if (this._filter === gl.LINEAR_MIPMAP_NEAREST ||
            this._filter === gl.NEAREST_MIPMAP_LINEAR ||
            this._filter === gl.LINEAR_MIPMAP_LINEAR ||
            this._filter === gl.LINEAR) {
            magFilter = gl.LINEAR;
        } 

        // The texture unit 7 is reserved for temporary use. 
        // Do not use other units in order to avoid the unit
        // conflicts.
        gl.activeTexture(gl.TEXTURE0 + 7); 
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this._filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this._wrap);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this._wrap);

        if (image) {
            gl.texImage2D(gl.TEXTURE_2D, 0, this._format, this._format, this._type, image);
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, this._internalFormat, this.width, this.height, 0, this._format, this._type, null);
        }

        if (this._mipmap) {
            gl.generateMipmap(gl.TEXTURE_2D);
        }
        
        gl.bindTexture(gl.TEXTURE_2D, null);
    };
    
    Texture.prototype.updateImage = function(image, format, type, filter, wrap) {
        this.ready = false;
        
        this.createFromImage(image, format, type, filter, wrap);
    }; 
    
    Texture.prototype.createFromImage = function(image, format, type, filter, wrap) {
        if (this.ready) {
            return;
        }

        this._format = format;
        this._type   = type;
        this.width  = image.width;
        this.height = image.height;
        this._filter = filter;
        this._wrap   = wrap;

        if (this._filter === gl.LINEAR_MIPMAP_NEAREST ||
            this._filter === gl.NEAREST_MIPMAP_LINEAR ||
            this._filter === gl.LINEAR_MIPMAP_LINEAR ||
            this._filter === gl.NEAREST_MIPMAP_NEAREST) {
            this._mipmap = true;
        }

        this._create(image);

        if (gl.getError() === gl.NO_ERROR) {
            this.ready = true;
            
            //modelo3d.debug("texture %s is created.", this._name);
        } else {
            gl.deleteTexture(this._texture);
        }
    }; 
    
    Texture.prototype.createFromCanvas = function(image, format, type, filter, wrap) {
        if (this.ready) {
            return;
        }

        this._format = format;
        this._type   = type;
        this.width  = image.width;
        this.height = image.height;
        this._filter = filter;
        this._wrap   = wrap;

        if (this._filter === gl.LINEAR_MIPMAP_NEAREST ||
            this._filter === gl.NEAREST_MIPMAP_LINEAR ||
            this._filter === gl.LINEAR_MIPMAP_LINEAR ||
            this._filter === gl.NEAREST_MIPMAP_NEAREST) {
            this._mipmap = true;
        }

        this._texture = gl.createTexture();

        var magFilter = gl.NEAREST;

        // derive magnify filter from minimizing filter.
        if (this._filter === gl.LINEAR_MIPMAP_NEAREST ||
            this._filter === gl.NEAREST_MIPMAP_LINEAR ||
            this._filter === gl.LINEAR_MIPMAP_LINEAR ||
            this._filter === gl.LINEAR) {
            magFilter = gl.LINEAR;
        } 

        // The texture unit 7 is reserved for temporary use. 
        // Do not use other units in order to avoid the unit
        // conflicts.
        gl.activeTexture(gl.TEXTURE0 + 7); 
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this._filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this._wrap);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this._wrap);

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

        gl.texImage2D(gl.TEXTURE_2D, 0, this._format, this._format, this._type, image);

        if (this._mipmap) {
            gl.generateMipmap(gl.TEXTURE_2D);
        }
        
        gl.bindTexture(gl.TEXTURE_2D, null);

        if (gl.getError() === gl.NO_ERROR) {
            this.ready = true;
        } else {
            gl.deleteTexture(this._texture);
        }
    }; 

    // This method is especially used for creating a cubemap texture.
    // images is a array of 6 images. Each image has a name indicating which face this image should
    // be mapped to. If image.name contains posx, it should be mapped to right face; if it contains
    // negz, it should be mapped to bottom face. So on so forth.
    // suppose the images is an array which contains 6 images
    Texture.prototype.createFromImages = function(images, format, type, filter, wrap) {
        if (this.ready) {
            return;
        }

        this._target = gl.TEXTURE_CUBE_MAP;
        this._format = format;
        this._type   = type;
        this.width   = images[0].width;
        this.height  = images[0].height;
        this._filter = filter;
        this._wrap   = wrap;
    
        if (this._filter === gl.LINEAR_MIPMAP_NEAREST ||
            this._filter === gl.NEAREST_MIPMAP_LINEAR ||
            this._filter === gl.LINEAR_MIPMAP_LINEAR ||
            this._filter === gl.NEAREST_MIPMAP_NEAREST) {
            this._mipmap = true;
        }
        
        
        this._texture = gl.createTexture();

        var magFilter = gl.NEAREST;

        // derive magnify filter from minimizing filter.
        if (this._filter === gl.LINEAR_MIPMAP_NEAREST ||
            this._filter === gl.NEAREST_MIPMAP_LINEAR ||
            this._filter === gl.LINEAR_MIPMAP_LINEAR ||
            this._filter === gl.LINEAR) {
            magFilter = gl.LINEAR;
        } 

        // The texture unit 7 is reserved for temporary use. 
        // Do not use other units in order to avoid the unit
        // conflicts.
        gl.activeTexture(gl.TEXTURE0 + 7); 
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this._texture);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, this._filter);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, magFilter);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, this._wrap);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, this._wrap);
              
        // must be 6 !
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, this._format, this._format, this._type, images[0]);
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, this._format, this._format, this._type, images[1]);
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, this._format, this._format, this._type, images[2]);
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, this._format, this._format, this._type, images[3]);
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, this._format, this._format, this._type, images[4]);
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, this._format, this._format, this._type, images[5]);
        
        if (this._mipmap) {
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        }
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
        
        if (gl.getError() === gl.NO_ERROR) {
            this.ready = true;
        } else {
            gl.deleteTexture(this._texture);
        }
    };

    Texture.prototype.createFromFile = function(file, format, filter, wrap, onComplete) {
        if (this.ready) {
            return;
        }

        var image = new Image();
        var that = this;
        image.onload = function() { 
            // FIXME: check the pixel format of the file.
            that.createFromImage(image, format, gl.UNSIGNED_BYTE, filter, wrap);

            if (onComplete !== null) {
                onComplete(that);
            }
        };
        // Trigger the loading.
        image.src = file;
    }; 

    Texture.prototype.create = function(width, height, format, filter, wrap) {
        if (this.ready) {
            return ;
        }
        
        this.width  = width;
        this.height = height;
        
        var type = gl.UNSIGNED_BYTE;
        format = format || gl.RGBA;
        var internalFormat = format;
        
        if (format === "RGB32F" || format === "RGBA32F" || format === "R32F") {
            if (!gl.floatTextureExtension && !gl.isWebGL2) {
                console.error("current browser does not support float texture.");
                return ;
            }

            type = gl.FLOAT;
            if (format === "RGB32F") {
                format = gl.RGB;
                internalFormat = gl.RGB32F;
            } else if (format === "RGBA32F") {
                format = gl.RGBA;
                internalFormat = gl.RGBA32F;
            } else if (format === "R32F") {
                format = gl.RED;
                internalFormat = gl.R32F;
            } else {
                console.error("unsupported format: " + format);
                return;
            }
        } else if (format === gl.RED){
            internalFormat = gl.R8;
        } else if (format === gl.DEPTH_STENCIL) {
            if (!gl.depthTextureExtension && !gl.isWebGL2) {
                console.error("current browser does not support depth texture.");

                // Create a render buffer instead
                this._texture = gl.createRenderbuffer();
                gl.bindRenderbuffer(gl.RENDERBUFFER, this._texture);
                gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, width, height);
                
                // It is a renderbuffer, but not a texture, so it can not be bound, (this.ready == false).
                if (gl.getError() !== gl.NO_ERROR) {
                    gl.deleteRenderBuffer(this._texture);
                }

                this._type = gl.DEPTH_COMPONENT16;
                this._rbo  = true;
                this.ready = true;

                return;
            } else {
                type = gl.isWebGL2 ? gl.UNSIGNED_INT_24_8 : gl.depthTextureExtension.UNSIGNED_INT_24_8_WEBGL;
                internalFormat = gl.DEPTH24_STENCIL8;
            }
        }


        this._filter = filter || gl.LINEAR;
        this._wrap   = wrap || gl.CLAMP_TO_EDGE;
        this._format = format;
        this._internalFormat = gl.isWebGL2 ? internalFormat : format;
        this._type   = type;
        this._create(null);

        if (gl.getError() === gl.NO_ERROR) {
            this.ready = true;
        
            //modelo3d.debug("texture %s is created.", this._name);
        } else {
            gl.deleteTexture(this._texture);
        }
    }; 

    Texture.prototype.update = function(buffer) {
        gl.activeTexture(gl.TEXTURE0 + 7); 
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, this._internalFormat, this.width, this.height, 0, this._format, this._type, buffer);
        
        if (gl.getError() === gl.NO_ERROR) {
            this.ready = true;
        } else {
            gl.deleteTexture(this._texture);
        }
    };

    // Copy from the current framebuffer
    Texture.prototype.copy = function(x, y, width, height) {
        // Can't apply to renderbuffer
        if (this._rbo) {
            return;
        }

        this.ready = false;
        
        gl.activeTexture(gl.TEXTURE0 + 7);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGB, x, y, width, height, 0);
        
        if (gl.getError() === gl.NO_ERROR) {
            this.ready = true;
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
    }; 
    
    // Resize the texture. It will destroy the old content.
    Texture.prototype.resize = function(width, height) {
        if (!this.ready) {
            return;
        }

        if (this.width === width && this.height === height) {
            return;
        }

        if (width > 4096) {
            width = 4096;
        }
        if (height > 4096) {
            height = 4096;
        }

        this.width = width;
        this.height = height;

        this.ready = false;
            
        if (this._rbo) {
            // Create a render buffer instead
            gl.bindRenderbuffer(gl.RENDERBUFFER, this._texture);
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, width, height);
            if (gl.getError() === gl.NO_ERROR) {
                this.ready = true;
            } else {
                gl.deleteRenderBuffer(this._texture);
            }
            gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        } else {
            gl.deleteTexture(this._texture);
            this._create(null);

            if (gl.getError() === gl.NO_ERROR) {
                this.ready = true;
            } else {
                gl.deleteTexture(this._texture);
            }
        }
    }; 

    Texture.prototype.generateMipmap = function() {
        if (!this.ready || this._rbo || this._mipmap) {
            return;
        }
        
        this._mipmap = true;

        gl.activeTexture(gl.TEXTURE0 + 7);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }; 

    Texture.prototype.use = function(textureUnit) {
        if (this.ready && !this._rbo) {
            gl.activeTexture(gl.TEXTURE0 + textureUnit);
            gl.bindTexture(this._target, this._texture);
        } else {
            modelo3d.debug("texture " + this.name + " is either not ready or not bindable.");
        }
    }; 


    Texture.prototype.isFloating = function() {
        return this._type === gl.FLOAT || 
               this._type === gl.isWebGL2 ? gl.UNSIGNED_INT_24_8 : gl.depthTextureExtension.UNSIGNED_INT_24_8_WEBGL;
    };

    Texture.prototype.getSize = function() {
        if (!this.ready) {
            return 0;
        }
            
        var kbytes = this.width * this.height;
        switch (this._format) {
            case gl.RG: 
                kbytes *= 2;
                break;
            case gl.RGB: 
                kbytes *= 3;
                break;
            case gl.RGBA: 
                kbytes *= 4;
                break;
        }
        switch (this._type) {
            case gl.FLOAT:
            case gl.isWebGL2 ? gl.UNSIGNED_INT_24_8 : gl.depthTextureExtension.UNSIGNED_INT_24_8_WEBGL:
                kbytes *= 4;
                break;
            case gl.DEPTH_COMPONENT16:
                kbytes *= 2;
                break;
        }

        this.kbytes = kbytes / 1024;

        return this.kbytes;
    };
    
    Texture.prototype.discard = function() {
        if (this.ready) {
            if (this._rbo) {
                gl.deleteRenderBuffer(this._texture);
            } else {
                gl.deleteTexture(this._texture);
            }
                
            this._texture = null;
            //console.log("release " + this.kbytes + "KB tex mem");

            this.ready = false;
        }
    };
    
    Texture.prototype.restore = function() {
        if (!this.ready) {
            this._create(null);
            if (gl.getError() === gl.NO_ERROR) {
                this.ready = true;
            } else {
                gl.deleteTexture(this._texture);
            }
        }
    };

    return Texture;
})();
    
