//
// m3d_load_texture.js
// Load the texture section in scene
//
//  

import Globals        from "../../m3d_globals.js";

export default (function() {
    "use strict";

    function TextureLoader(sceneObject, renderer, resourceManager) {
        this._sceneObject     = sceneObject;
        this._resourceManager = resourceManager;
        this._renderer        = renderer;
    };
    
    TextureLoader.prototype.destroy = function() {
        delete this._sceneObject;
        delete this._resourceManager;
        delete this._renderer;
    };

    TextureLoader.prototype.load = function(modelPromises, sceneData, progressTracker) {
        // If there is no texture, return immediately
        var hasTextures = false;
        for (var texture in sceneData.textures) {
            hasTextures = true;
            break;
        }
        var $q = Globals.frontendCallbacks.getPromiseLibrary();
        if (!hasTextures) {
            return $q.resolve("ok");
        }

        var that = this;

        // Collect samplers
        var samplersData = {};
        for (var sampler in sceneData.samplers) {
            samplersData[sampler] = {};

            if (sceneData.samplers[sampler].filter === "linear") {
                if (sceneData.samplers[sampler].mipmap) {
                    samplersData[sampler].filter = gl.LINEAR_MIPMAP_LINEAR;
                    // FIXME: if trilinear texture sampling drag down the performance
                    // too much, revive following line.
                    // samplersData[sampler].filter = gl.LINEAR_MIPMAP_NEAREST;
                } else {
                    samplersData[sampler].filter = gl.LINEAR;
                }
            } else {
                if (sceneData.samplers[sampler].mipmap) {
                    samplersData[sampler].filter = gl.NEAREST_MIPMAP_NEAREST;
                } else {
                    samplersData[sampler].filter = gl.NEAREST;
                }
            }

            if (sceneData.samplers[sampler].wrap == "repeat") {
                samplersData[sampler].wrap = gl.REPEAT;
            } else {
                samplersData[sampler].wrap = gl.CLAMP_TO_EDGE;
            }
        }

        // Load textures
        var loadTextureImage = function(textureName) {
            var imageUrl = sceneData.textures[textureName].uri;

            var promise = modelPromises[imageUrl];
            return promise.downloadFile().then(function(image){
                var textureData = sceneData.textures[textureName];

                var imageUrl = sceneData.textures[textureName].uri;

                var samplerData = samplersData[textureData.sampler];
                var textureObject = that._resourceManager.getTexture(textureName);
                var format = textureData.format === "rgba"? gl.RGBA : gl.RGB;
                textureObject.updateImage(image, format, gl.UNSIGNED_BYTE,
                    samplerData.filter, samplerData.wrap);

                if (!textureObject.ready) {
                    return $q.reject("modelo3d loader errors at creating texture object '" + 
                        textureName + "'."); 
                }
                
                var onprogress = progressTracker.getSingleFileProgress();
                onprogress(512 * 1024); // we simply think each image is 512KB
            });
        }

        // Fetch the textures.
        var textures = _.keys(sceneData.textures);
        var prev = loadTextureImage(textures[0]);
        for (var i = 1, len = textures.length; i < len; i++) {
            prev = (function(texture) {
                return prev.then(function() {
                    loadTextureImage(texture);
                });
            })(textures[i]);
        }

        return prev;
    };

    return TextureLoader;
})();
    
