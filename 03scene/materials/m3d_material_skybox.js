//
// m3d_material_skybox.js
// The material of skybox
//
//  

import Utils             from "../../00utility/m3d_utils.js";
import Material          from "./m3d_material.js";
import MaterialParameter from "./m3d_material_parameter.js";

export default (function() {
    "use strict";

    function MaterialSkybox(name) {
        // Inheritance
        Material.apply(this, arguments);
    };
    
    // MaterialSkybox inherits Material
    MaterialSkybox.prototype = Object.create(Material.prototype);
    MaterialSkybox.prototype.constructor = MaterialSkybox;
    
    MaterialSkybox.prototype.attachShader = function(shader) {
        if (!shader || !shader.ready) {
            return;
        }

        // For each uniform in the shader, connect it to its value source.
        for (var uniform in shader.reservedUniforms) {
            // If it is not the first time for material to attach a shader.
            // If so, just update the associated uniform.
            if (this.reservedParameters.hasOwnProperty(uniform)) {
                continue;
            }

            if (uniform === "m_uSkyTexture") {
                this.reservedParameters[uniform] = new MaterialParameter();
                this.hasTexture = true;
                
                this.reservedParameters[uniform].texUnit = 4;
                this.reservedParameters[uniform].upload = this.reservedParameters[uniform].uploadTexture;
            } 
            if (uniform === "m_uTransparency") {
                this.reservedParameters[uniform] = new MaterialParameter();

                this.reservedParameters[uniform].value = 1.0;
                this.reservedParameters[uniform].upload = function UploadScalars(uniform) {
                    if (uniform) {
                        uniform.upload(this.value);
                    }
                };
            }
        }
        
        // Remove parameters that are no more in shader uniforms.
        for (var parameter in this.reservedParameters) {
            if (!shader.reservedUniforms[parameter]) {
                delete this.reservedParameters[parameter];
            }
        }
    };

    MaterialSkybox.prototype.setTexture = function(texture) {
        this.reservedParameters["m_uSkyTexture"].value = texture;
    };
    
    MaterialSkybox.prototype.texture = function() {
        return this.reservedParameters["m_uSkyTexture"].value;
    };

    MaterialSkybox.prototype.setTransparency = function(value) {
        this.reservedParameters["m_uTransparency"].value = value;
    };

    return MaterialSkybox;
})();
    
