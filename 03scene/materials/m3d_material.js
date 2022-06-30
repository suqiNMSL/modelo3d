//
// m3d_material.js
// The material base class
//
//  
//

import MaterialParameter from "./m3d_material_parameter.js"


export default (function() {
    "use strict";
        
    function Material(name) {
        // public:
        this.name                = name;         // The name of this material.
        this.transparent         = false;
        this.hasMask             = false;        // Is this material having a alpha mask
        this.drawables           = [];           // The drawables that use this material
        this.hasTexture          = false;        // If the material contains a texture
        this.parameters          = {};           // The material parameters, like ambient.
        this.reservedParameters  = {};           // Reserved material
    }; 

    Material.prototype.attachShader = function(shader) {
        if (!shader || !shader.ready) {
            return;
        }
        
        // For each uniform in the shader, connect it to its value source.
        for (var uniform in shader.userUniforms) {
            // If it is not the first time for material to attach a shader.
            // If so, just update the associated uniform.
            if (this.parameters.hasOwnProperty(uniform)) {
                continue;
            }

            this.parameters[uniform] = new MaterialParameter();

            if (uniform.match(/uTexture\d/)) {
                this.hasTexture = true;
                var texId = parseInt(uniform.substr(8));
                if (texId > 2) {
                    console.error("can't support >3 user textures. See shader '" + shader.name + "'");
                    continue;
                }
                this.parameters[uniform].texUnit = texId;
                this.parameters[uniform].upload = this.parameters[uniform].uploadTexture;
            } else {
                this.parameters[uniform].upload = this.parameters[uniform].uploadValue;
            } 
        }

        // Remove parameters that are no more in shader uniforms.
        
        var parameter;
        for (parameter in this.parameters) {
            if (!shader.userUniforms[parameter]) {
                delete this.parameters[parameter];
            }
        }
        for (parameter in this.reservedParameters) {
            if (!shader.reservedUniforms[parameter]) {
                delete this.reservedParameters[parameter];
            }
        }
        
    }; 

    Material.prototype.destroy = function() {
        this.parameters = null;
        this.reservedParameters = null;
        delete this.parameters;
        delete this.reservedParameters;
    };

    Material.prototype.use = function(shader) {
        var parameter;
        for (parameter in this.reservedParameters) {
            this.reservedParameters[parameter].upload(shader.reservedUniforms[parameter]);
        }
        for (parameter in this.parameters) {
            this.parameters[parameter].upload(shader.userUniforms[parameter]);
        }
    };

    // Use the value from another material
    Material.prototype.absorb = function(other) {
        // TODO: absorb all information is not needed for now
        // only masked textures is needed for alpha test
        // use materialadhoc absorb

        var parameter;

        for (parameter in this.reservedParameters) {
            this.reservedParameters[parameter].value = other.reservedParameters[parameter].value;
            this.reservedParameters[parameter].texUnit = other.reservedParameters[parameter].texUnit;
        }
        for (parameter in this.parameters) {
            this.parameters[parameter].value = other.parameters[parameter].value;
            this.parameters[parameter].texUnit = other.parameters[parameter].texUnit;
        }
    };

    return Material;
})();
    
