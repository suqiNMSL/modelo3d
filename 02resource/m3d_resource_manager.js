//
// m3d_resource_manager.js
// The OGL resource manager 
//
//  


import Globals      from "../m3d_globals.js";
import _Texture     from "./m3d_texture.js";
import _Mesh        from "./m3d_mesh.js";
import _Framebuffer from "./m3d_framebuffer.js";
import _Shader      from "./m3d_shader.js";
import _Buffer      from "./m3d_buffer.js";


export default (function() {
    "use strict";

    function ResourceManager() {
        this._shaders       = {};
        this._meshes        = {};
        this._textures      = {};
        this._framebuffers  = {};
        this._buffers       = {};
    
        // Create the default framebuffer.
        this._framebuffers["default"] = {
            ready:        true,         
            _name:        "default",
            _manager:     null,
            _framebuffer: null,
            destroy: function() {
            },
            use: function() { 
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            },
            resize: function(width, height) { 
            },
            discard: function() {
            },
            restore: function() {
            },
            getWidth: function() {
                return Globals.width;
            },
            getHeight: function() {
                return Globals.height;
            }
        };
    }; // end of ResourceManager

    ResourceManager.prototype.destroy = function() {
        for (var mesh in this._meshes) {
            this._meshes[mesh]._manager = null;
            this._meshes[mesh].destroy();
        }
        for (var framebuffer in this._framebuffers) {
            this._framebuffers[framebuffer]._manager = null;
            this._framebuffers[framebuffer].destroy();
        }
        for (var texture in this._textures) {
            // Prevent changing the this._textures inside texture.destroy().
            this._textures[texture]._manager = null;
            this._textures[texture].destroy();
        }
        for (var shader in this._shaders) {
            this._shaders[shader]._manager = null;
            this._shaders[shader].destroy();
        }
        for (var buffer in this._buffers) {
            this._buffers[buffer]._manager = null;
            this._buffers[buffer].destroy();
        }
        
        this._textures = null;
        this._meshes = null;
        this._framebuffers = null;
        this._buffers = null;
        this._shaders = null;

        delete this._textures;
        delete this._meshes;
        delete this._framebuffers;
        delete this._shaders;
        delete this._buffers;

    };

    ResourceManager.prototype.getTexture = function(name) {
        if (!this._textures[name]) {
            this._textures[name] = new _Texture(name, this);
        }
        return this._textures[name];
    };
    
    // name can be 
    // "default": the default window buffer
    // All above should be used a temporary framebuffer as they will be reused
    // in different modules.
    // "[module-function]": custom name beginning with module, e.g., shadow-src
    ResourceManager.prototype.getFramebuffer = function(name) {
        if (!this._framebuffers[name]) {
            this._framebuffers[name] = new _Framebuffer(name, this);
        }
        return this._framebuffers[name];
    };
    
    ResourceManager.prototype.getShader = function(name, flags) { 
        if (flags) {
            name = name + flags.join("_");
        }

        if (!this._shaders[name]) {
            this._shaders[name] = new _Shader(name, this);
        }
        return this._shaders[name];
    };
    
    ResourceManager.prototype.getBuffer = function(name) { 
        if (!this._buffers[name]) {
            this._buffers[name] = new _Buffer(name, this);
        }
        return this._buffers[name];
    };
    
    ResourceManager.prototype.getMesh = function(name) {
        if (!this._meshes[name]) {
            this._meshes[name] = new _Mesh(name, this);
        }
        return this._meshes[name];
    };
    
    ResourceManager.prototype.hasTexture = function(name) {
        return this._textures.hasOwnProperty(name);
    };
    
    ResourceManager.prototype.hasFramebuffer = function(name) {
        return this._framebuffers.hasOwnProperty(name);
    };
    
    ResourceManager.prototype.hasShader = function(name) {
        return this._shaders.hasOwnProperty(name);
    };

    ResourceManager.prototype.hasBuffer = function(name) {
        return this._buffers.hasOwnProperty(name);
    };
    
    ResourceManager.prototype.hasMesh = function(name) {
        return this._meshes.hasOwnProperty(name);
    };

    // This function will release GPU resources as much
    // as possible when called.
    ResourceManager.prototype.discard = function() {
        for (var framebuffer in this._framebuffers) {
            this._framebuffers[framebuffer].discard();
        };
    };

    // This function will re-upload resources from CPU to GPU.
    // It is the reverse function to pause().
    ResourceManager.prototype.restore = function() {
        for (var framebuffer in this._framebuffers) {
            this._framebuffers[framebuffer].restore();
        }
    };
    
    ResourceManager.prototype.openFile = function(file, onSuccess) {

        if (window.cordova) {
            this._openFileFromCordova(file, onSuccess);
        } else {
            this._openFileFromBrowser(file, onSuccess);
        }
    };
    
    ResourceManager.prototype._openFileFromCordova = function(file, onSuccess) {
        if (this.ready) {
            return onSuccess();
        }

        var fileReader = angular.element(document).find("body").injector().get("FileReaderService");
        var path = cordova.file.applicationDirectory + "www";

        var fileUse = file.replace("/", "");

        fileReader.readAsText(path, fileUse)
            .then(function(data) {
                if (onSuccess) {
                    onSuccess(data);
                }
            })
            .catch(function (error) {
                console.error(error);
            });
    };

    ResourceManager.prototype._openFileFromBrowser = function(file, onSuccess) {
        if (this.ready) {
            return onSuccess();
        }

        var xhr = new XMLHttpRequest();

        xhr.open("GET", file + "?t=" + cacheBuster);
        xhr.onload = function(eventData) {
            if (xhr.status === 200 || xhr.status === 206) {
                if (onSuccess) {
                    onSuccess(xhr.response);
                }
            } else {
                console.error("failed to load " + file + ", http status: " + xhr.status);
            }
        };

        xhr.send();
    };

    // NOTE: Very time consuming. Should be ony called every few seconds.
    ResourceManager.prototype.getMemStats = function(stats) {
        stats.textureKBytes = 0;
        stats.textureCount = 0;
        for (var texture in this._textures) {
            if (this._textures[texture].ready) {
                stats.textureKBytes += this._textures[texture].getSize();
                stats.textureCount++;
            }
        }
        stats.meshKBytes = 0;
        stats.meshCount = 0;
        for (var mesh in this._meshes) {
            if (this._meshes[mesh].ready) {
                stats.meshKBytes += (this._meshes[mesh].bytes) / 1024;
                stats.meshCount++;
            }
        }
        stats.framebufferCount = 0;
        for (var framebuffer in this._framebuffers) {
            if (this._framebuffers[framebuffer].ready) {
                stats.framebufferCount++;
            }
        }
        stats.shaderCount = 0;
        for (var shader in this._shaders) {
            if (this._shaders[shader].ready) {
                stats.shaderCount++;
            }
        }
    }; 

    return ResourceManager;
})();
    
        
