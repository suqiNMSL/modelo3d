//
// m3d_background.js
// The backgroun of the scene.
//
// Copyright Modelo XX - 2018, All rights reserved.
//

import SkyBox from "./drawables/m3d_skybox.js";

export default (function() {
    "use strict";

    function Background(resourceManager) {
        this._resourceManager = resourceManager;

        this.mode   = SkyBox.SKYBOX_SOLIDCOLOR;
        this.color  = new Float32Array([1, 1, 1, 0]);
        this.skybox = null; 
    };

    Background.prototype.destroy = function() {
        if (this.skybox !== null) {
            this.skybox.destroy();
        }
        this.skybox = null;
        delete this.skybox;

        this.color = null;
        delete this.color;
    };
    
    Background.prototype.setColor = function(color) {
        this.color[0] = color[0];
        this.color[1] = color[1];
        this.color[2] = color[2];
        this.color[3] = color[3];
    };
    
    Background.prototype.setImages = function(images) {
        if (!this.skybox) {
            this.skybox = new SkyBox(this._resourceManager);
        }
        this.skybox.setImage(images);
    };
    
    Background.prototype.setBackgroundMode = function(mode) {
        if (this.mode !== SkyBox.SKYBOX_SOLIDCOLOR) {
            if (!this.skybox) {
                this.skybox = new SkyBox(this._resourceManager);
            }
            this.skybox.setMode(mode);
        }
        this.mode = mode;
    };

    return Background;
})();
