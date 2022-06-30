//
// m3d_load_texture.js
// Load the texture section in scene
//
//  

import Globals        from "../../m3d_globals.js";
import LoadMisc       from "../m3d_load_misc.js";

export default (function() {
    "use strict";

    function TextureLoader(sceneObject, resourceManager) {
        this._sceneObject     = sceneObject;
        this._resourceManager = resourceManager;
    };
    
    TextureLoader.prototype.destroy = function() {
        delete this._sceneObject;
        delete this._resourceManager;
    };

    function SamplerData() {
        this.filter = gl.LINEAR_MIPMAP_LINEAR;
        this.wrap = gl.REPEAT;
    };

    TextureLoader.prototype.load = function(modelPromises, sceneJson, sceneBin, progressTracker) {
        var $q = Globals.frontendCallbacks.getPromiseLibrary();

        // If there is no texture, return immediately
        if (sceneJson.textures.length === 0) {
            return $q.resolve("ok");
        }

        var that = this;

        // Collect samplers
        var samplersData = new Array(sceneJson.samplers.length);
        for (var i = 0, len = sceneJson.samplers.length; i < len; i++) {
            samplersData[i] = new SamplerData();

            var samplerData = sceneBin.readSampler(i);

            if (samplerData[0] === 1) { // linear or not
                // FIXME: if trilinear texture sampling drag down the performance
                // too much, revive following line.
                samplersData[i].filter = samplerData[2] === 1? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR;
            } else {
                samplersData[i].filter = samplerData[2] === 1? gl.NEAREST_MIPMAP_NEAREST : gl.NEAREST;
            }

            // repeat or not
            samplersData[i].wrap = samplerData[1] === 1? gl.REPEAT : gl.CLAMP_TO_EDGE;
        }

        var lowercasedModelPromises = getLowercasedModelPromises(modelPromises);

        // Load textures
        var loadTextureImage = function(textureIndex) {
            var textureName = sceneJson.textures[textureIndex].name;
            var lowercasedTextureName = textureName.toLowerCase();

            return lowercasedModelPromises[lowercasedTextureName].downloadFile().then(function(image){
                if (Globals.state !== modelo3d.LOADING) {
                    throw new Error("Loading is interrupted");
                }

                var textureData = sceneBin.readTexture(textureIndex);
                var samplerData = samplersData[textureData[1]];
                var textureObject = that._resourceManager.getTexture(textureName);

                var format = textureData[0] === 4? gl.RGBA : gl.RGB;

                textureObject.updateImage(image, format, gl.UNSIGNED_BYTE,
                    samplerData.filter, samplerData.wrap);

                if (!textureObject.ready) {
                    return $q.reject("modelo3d loader errors at creating texture object '" + 
                        textureName + "'."); 
                }
                    
                var onprogress = progressTracker.getSingleFileProgress();
                onprogress(sceneJson.textures[textureIndex].byteLength);
            });
        }

        // Fetch the textures.
        var prev = loadTextureImage(0);
        for (var i = 1, len = sceneJson.textures.length; i < len; i++) {
            prev = (function(textureIndex) {
                return prev.then(function() {
                    return loadTextureImage(textureIndex);
                });
            })(i);
        }

        return prev;
    };


    // lowercases the keys to make matching files work as expected
    function getLowercasedModelPromises(modelPromises) {
        var mappedModelPromises = {};

        Object.keys(modelPromises).forEach(function (name) {
            var lowercasedName = name.toLowerCase();

            mappedModelPromises[lowercasedName] = modelPromises[name];
        });

        return mappedModelPromises;
    }

    return TextureLoader;
})();
    
