//
// m3d_hatching.js
// real-time hatching (Microsoft paper). TODO
//
//  


(function () {
    "use strict";

    modelo3d.Hatching = function (scene, resourceManager) {
        // private:
        this._material   = null;
        this._shader     = null;
        this._texture    = [];
        this._ready      = false;
        this._scene      = scene;

        // initialization:
        var that = this;

        this._texture = resourceManager.getTexture("hatching");
        this._texture.createFromFile(modelo3d.ASSET_PATH + "images/hatch.jpg",
            gl.RGB, gl.LINEAR, gl.CLAMP_TO_EDGE);

        this._material = new modelo3d.Material("hatching");
        this._shader = resourceManager.getShader("hatching", []);

        var shaderSourceObject = resourceManager.getShaderSource("hatching");
        shaderSourceObject.createFromFile(modelo3d.ASSET_PATH + "shaders/hatching.mss", function() {
            if (!shaderSourceObject.ready) {
                console.warn("failed to load hatching.mss");
            } else {
                that.recompileShader(resourceManager, []);
            }
        });
    };

    modelo3d.Hatching.prototype.destroy = function() {
        this._material.destroy();
    };

    modelo3d.Hatching.prototype.bind = function(renderScene) {
        this._ready = this._texture.ready && this._shader.ready;
        if (this._ready) {
            renderScene.setOverridedMaterial(this._material, this._shader);
        } else {
            console.warn("hatching is not ready!");
        }
    };

    modelo3d.Hatching.prototype.unbind = function(renderScene) {
        renderScene.setOverridedMaterial(null, null);
    };

    modelo3d.Hatching.prototype.recompileShader = function(resourceManager, states) {
        var flags = [];
        if (states.section) {
            flags.push("CLIPPING");
        }
        this._shader= resourceManager.getShader("hatching", flags);
        if (!this._shader.ready) {
             var shaderSource = resourceManager.getShaderSource("hatching");
             this._shader.createFromShaderSource(shaderSource, flags);
        }  
        this._material.attachShader(this._shader);

        var o = this._scene.bbox;

        var w = this._scene.bbox[3] - this._scene.bbox[0];
        var d = this._scene.bbox[4] - this._scene.bbox[1];
        var h = this._scene.bbox[5] - this._scene.bbox[2];
        
        this._material.parameters["uTexture0"].value = this._texture;

        this._material.parameters["uPlaneOrigins[0]"].value = [
            o[0],     o[1],     o[2], 
            o[0] + w, o[1],     o[2], 
            o[0] + w, o[1] + d, o[2], 
            o[0],     o[1] + d, o[2]
         ];
        this._material.parameters["uPlanes[0]"].value = [
            0.0, -1.0,  0.0, o[1],
            1.0,  0.0,  0.0, -(o[0] + w),
            0.0,  1.0,  0.0, -(o[1] + d), 
            -1.0, 0.0,  0.0, o[0]
         ];

        this._material.parameters["uBoxSize"].value = [w, d, h];
    }

})();
