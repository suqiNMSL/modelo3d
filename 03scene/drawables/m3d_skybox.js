//
// m3d_skybox.js
// The sky dome or planar background
//
//  

import Globals        from "../../m3d_globals.js";
import Utils          from "../../00utility/m3d_utils.js";
import ShaderLibrary  from "../../02resource/m3d_shader_library.js";
import MaterialSkybox from "../materials/m3d_material_skybox.js";
import BaseCamera     from "../camera/m3d_base_camera.js";
import Drawable           from "./m3d_drawable.js";

export default (function() {
    "use strict";

    function SkyBox(resourceManager, name) {
        this._name = name || "skybox";
        // Inheritance:
        Drawable.apply(this, [this._name, null, null, null, null, null, null]);
        
        // public:
        this.enabled          = false; 

        // private:
        this._texture         = null;
        this._resourceManager = resourceManager;
        this._mode            = -1;
        this._flipY           = false;
        this.camera          = new BaseCamera();

        // Initialization:
        this.material = new MaterialSkybox(this._name);
        this.setMode(SkyBox.SKYBOX_EQUIRECTANGLE);
    };

    SkyBox.SKYBOX_SOLIDCOLOR        = 0;
    SkyBox.SKYBOX_WALLPAPER         = 1;
    SkyBox.SKYBOX_EQUIRECTANGLE     = 2;   // Equirectangle panorama
    SkyBox.SKYBOX_CUBEMAP           = 3;   // Cubemap panorama
    SkyBox.SKYBOX_WALLPAPER_TILED   = 4;
    
    // Skybox inherits Drawable
    SkyBox.prototype = Object.create(Drawable.prototype);
    SkyBox.prototype.constructor = SkyBox;

    SkyBox.prototype.destroy = function() {
        Drawable.prototype.destroy.apply(this);

        if (this._texture) {
            this._texture.destroy();
        }
    };

    SkyBox.prototype.update = function(viewMatrix) {
        if (this._mode === SkyBox.SKYBOX_WALLPAPER_TILED && this.enabled) {
            // Stretch the bg image to the window left/right border
            // and move the bg image to the top.
            var aspect = (this._texture.height / this._texture.width) * (Globals.width / Globals.height);
            this.transform._setScaling(1.0, aspect, 1.0);
            this.transform._setTranslation(0.0, 1.0 - aspect, 1.0);
        } else {
            mat4.copy(this.camera.viewMatrix, viewMatrix);
            
            this.camera.viewMatrix[12] = 0;
            this.camera.viewMatrix[13] = 0;
            this.camera.viewMatrix[14] = 0;

            mat4.multiply(this.camera.vpMatrix, this.camera.projectMatrix, viewMatrix);
        }
    };

    SkyBox.prototype.resize = function(width, height) {
        this.camera.resize(width, height);
    };
    
    SkyBox.prototype.setImage = function(images) {
        if (!images) {
            this.enabled = false;
            return;
        }
            
        if (this._texture && this._texture.ready) {
            this._texture.destroy();
        }
        this._texture = this._resourceManager.getTexture(this._name); 
        if (images && Utils.isArray(images)) { // cubemap
            this._texture.createFromImages(images, gl.RGB, gl.UNSIGNED_BYTE, 
                    gl.LINEAR, gl.CLAMP_TO_EDGE);
        } else { // single image, e.g., equirectangle
            this._texture.createFromImage(images, gl.RGB, gl.UNSIGNED_BYTE, 
                    gl.LINEAR, gl.CLAMP_TO_EDGE);
        }

        this.enabled = this._texture.ready;
        if (!this.enabled) {
            console.warn("skybox sees a corrupted image.");
        } else {
            this.material.setTexture(this._texture);
        }
    };

    var SPHERE_RINGS = 64;
    var SPHERE_SEGMENTS = 128;

    SkyBox.prototype.setMode = function(mode) {
        if (this._mode === mode) {
            return ;
        }

        this._mode = mode;

        var shaderSource = ShaderLibrary["skybox"];
        if (this._mode === SkyBox.SKYBOX_WALLPAPER) {
            this.mesh = this._resourceManager.getMesh("quad");
            if (!this.mesh.ready) {
                this.mesh.createQuad();
            }

            this.shader = this._resourceManager.getShader("skybox", ["WALLPAPER"]);
            if (!this.shader.ready) {
                this.shader.createFromShaderSource(shaderSource, ["WALLPAPER"]);
            }

            this.transform.reset();
        } else if (this._mode === SkyBox.SKYBOX_WALLPAPER_TILED) {
            this.mesh = this._resourceManager.getMesh("quad");
            if (!this.mesh.ready) {
                this.mesh.createQuad();
            }

            this.shader = this._resourceManager.getShader("skybox", ["WALLPAPER", "MODEL_TRANSFORM"]);
            if (!this.shader.ready) {
                this.shader.createFromShaderSource(shaderSource, ["WALLPAPER", "MODEL_TRANSFORM"]);
            }
            
            this.transform.reset();
        } else if (this._mode === SkyBox.SKYBOX_EQUIRECTANGLE) {

            this.mesh = this._resourceManager.getMesh("sphere-" + SPHERE_RINGS + "-" + SPHERE_SEGMENTS);
            if (!this.mesh.ready) {
                this.mesh.createSphere(SPHERE_RINGS, SPHERE_SEGMENTS);
            }
        
            this.shader = this._resourceManager.getShader("skybox", ["EQUIRECTANGLE"]);
            if (!this.shader.ready) {
                this.shader.createFromShaderSource(shaderSource, ["EQUIRECTANGLE"]);
            }
        } else if (this._mode === SkyBox.SKYBOX_CUBEMAP) {
            this.mesh = this._resourceManager.getMesh("sphere-" + SPHERE_RINGS + "-" + SPHERE_SEGMENTS);
            if (!this.mesh.ready) {
                this.mesh.createSphere(SPHERE_RINGS, SKYBOX_CUBEMAP);
            }
            var flags = ["CUBEMAP"];
            if (this._flipY) {
                flags.push("FLIP");
            }
            this.shader = this._resourceManager.getShader("skybox", flags);
            if (!this.shader.ready) {
                this.shader.createFromShaderSource(shaderSource, flags);
            }
        } 
            
        this.material.attachShader(this.shader);
        this.material.setTexture(this._texture);
        this.material.setTransparency(1.0);
    };

    SkyBox.prototype.setTransparency = function(value) {
        this.material.setTransparency(value);
    };
    
    //Flip Y axis, only works for panorama, which means the cubemap
    SkyBox.prototype.setFlipYEnabled = function(enabled) {
        this._flipY = enabled;
        this._mode  = -1;
        this.setMode(SkyBox.SKYBOX_CUBEMAP);
    };
    
    
    
    return SkyBox;
    
})();
    
