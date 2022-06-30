//
// m3d_material_adhoc.js
// The material of adhoc one <= 0.5.6 modelo3d
//
//  

import Material          from "./m3d_material.js";
import MaterialParameter from "./m3d_material_parameter.js";
import Utils             from "../../00utility/m3d_utils.js";

export default (function() {
    "use strict";

    function MaterialAdhoc(name) {
        // Inheritance
        Material.apply(this, arguments);
        
        // Private
        this._reservedParameters2 = {};
        this._materialParameters  = null;
    };

    // MaterialAdhoc inherits Material
    MaterialAdhoc.prototype = Object.create(Material.prototype);
    MaterialAdhoc.prototype.constructor = MaterialAdhoc;
        
    var defaultMaterialValues = [1.0, 0.0, 1.0, 0.5, 100.0, 0.0, 0, 0]; // The last two 0s are for 4-alignment.

    MaterialAdhoc.hash = function(parameters) {
        var s = "";
        s = s + parameters[0].toString() + parameters[1].toString() + parameters[2].toString()+ parameters[3].toString();
        return s;
    };
    
    MaterialAdhoc.prototype.attachShader = function(shader) {
        if (!shader || !shader.ready) {
            return;
        }

        // Apply the base class method
        Material.prototype.attachShader.apply(this, arguments);

        // Default values:
        // diffuse: 255, 255, 255
        // transparent: 0.0
        // roughness: 100.0
        // metallic: 0.0 
        
        for (var uniform in shader.reservedUniforms) { // If it is not the first time for material to attach a shader.
            // If so, just update the associated uniform.
            if (this.reservedParameters.hasOwnProperty(uniform)) {
                continue;
            }

            if (uniform === "m_uDiffuseTexture") {
                this.reservedParameters[uniform] = new MaterialParameter();
                this.hasTexture = true;
                
                this.reservedParameters[uniform].texUnit = 5;
                this.reservedParameters[uniform].upload = this.reservedParameters[uniform].uploadTexture;
            } else if (uniform.indexOf("m_uMaterial") >= 0) {
                this.reservedParameters[uniform] = new MaterialParameter();
                this.reservedParameters[uniform].upload = this.reservedParameters[uniform].uploadValue;
                    
                this._materialParameters = new Float32Array(defaultMaterialValues);

                this.reservedParameters[uniform].value = this._materialParameters;
            } 
        }
    };

    MaterialAdhoc.prototype.equal = function(parameters) {
        return (this._materialParameters[0] === parameters[0]) && (this._materialParameters[0] === parameters[0]) && 
               (this._materialParameters[2] === parameters[2]) && (this._materialParameters[3] === parameters[3]);
    };
    
    MaterialAdhoc.prototype.hash = function() {
        var s = "";
        var dst = this._materialParameters;
        s = s + dst[0].toString() + dst[1].toString() + dst[2].toString()+ dst[3].toString();
        return s;
        
    };
    
    MaterialAdhoc.prototype.setDiffuse = function(color) {
        var dst = this._materialParameters;
        dst[0] = color[0];
        dst[1] = color[1];
        dst[2] = color[2];
    };
    
    MaterialAdhoc.prototype.setTransparent = function(alpha) {
        this._materialParameters[3] = alpha;
        this.transparent = (alpha < 0.99);
    };
    
    MaterialAdhoc.prototype.setDiffuseTexture = function(texture) {
        this.reservedParameters["m_uDiffuseTexture"].value = texture;
    };

    MaterialAdhoc.prototype.setShininess= function(shininess) {
        this._materialParameters[4] = shininess;
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.reservedParameters["m_uMaterial"].value);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this._materialParameters);
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    };

    MaterialAdhoc.prototype.getDiffuse = function() {
        return this._materialParameters;
    };
    
    MaterialAdhoc.prototype.getTransparent = function() {
        return this._materialParameters[3];
    };
    
    MaterialAdhoc.prototype.getShininess = function() {
        return this._materialParameters[4];
    };
    
    MaterialAdhoc.prototype.getDiffuseTexture = function() {
        return this.reservedParameters["m_uDiffuseTexture"].value;
    };

    // Copy special parameters from other material.
    MaterialAdhoc.prototype.absorb = function(other) {

        if (other.hasMask) {    
            var dst = this.reservedParameters["m_uDiffuseTexture"];
            var src = other.reservedParameters["m_uDiffuseTexture"];

            if (dst && src) {
                dst.value = src.value;
            }
        }

        if (other.transparent) {
            this.setTransparent(other.getTransparent());
        }
    };
        
    return MaterialAdhoc;
})();

