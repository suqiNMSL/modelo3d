//
// m3d_material_blit.js
// The material of blit
//
//  

import Globals           from "../../m3d_globals.js";
import Utils             from "../../00utility/m3d_utils.js";
import MaterialParameter from "./m3d_material_parameter.js";
import Material          from "./m3d_material.js";

export default (function() {
    "use strict";

    function MaterialBlit(name) {
        // Inheritance
        Material.apply(this, arguments);
    };

    // MaterialAdhoc inherits Material
    MaterialBlit.prototype = Object.create(Material.prototype);
    MaterialBlit.prototype.constructor = MaterialBlit;
        
    MaterialBlit.prototype.attachShader = function(shader) {
        if (!shader || !shader.ready) {
            return;
        }
        
        // Apply the base class method
        Material.prototype.attachShader.apply(this, arguments);
        
        for (var uniform in shader.reservedUniforms) {
            // If it is not the first time for material to attach a shader.
            // If so, just update the associated uniform.
            if (this.reservedParameters.hasOwnProperty(uniform)) {
                continue;
            }

            if (uniform === "m_uBlitTexture") {
                this.reservedParameters[uniform] = new MaterialParameter();
                this.hasTexture = true;
                
                this.reservedParameters[uniform].texUnit = 4;
                this.reservedParameters[uniform].upload = this.reservedParameters[uniform].uploadTexture;
            } else if (uniform === "m_uBlitDepthTexture") {
                this.reservedParameters[uniform] = new MaterialParameter();
                this.hasTexture = true;
                
                this.reservedParameters[uniform].texUnit = 6;
                this.reservedParameters[uniform].upload = this.reservedParameters[uniform].uploadTexture;
            } else if (uniform === "m_uInvResolution") {
                this.reservedParameters[uniform] = new MaterialParameter();
                this.reservedParameters[uniform].upload = this.reservedParameters[uniform].uploadValue;
                this.reservedParameters[uniform].value = [1.0 / Globals.width, 1.0 / Globals.height];
            }
        }

    };

    MaterialBlit.prototype.setTexture = function(texture) {
        this.reservedParameters["m_uBlitTexture"].value = texture;
    };

    MaterialBlit.prototype.setDepthTexture = function(texture) {
        this.reservedParameters["m_uBlitDepthTexture"].value = texture;
    };

    MaterialBlit.prototype.setInvResolution = function(value) {
        if (this.reservedParameters["m_uInvResolution"]) {
            this.reservedParameters["m_uInvResolution"].value = value;
        }
    };

    return MaterialBlit;
})();
    
