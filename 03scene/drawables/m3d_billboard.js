//
// m3d_billboard.js
// The billboard 
//
//  


import Drawable               from "./m3d_drawable.js";
import BillboardTransform from "./m3d_billboard_transform.js";
import Math               from "../../00utility/m3d_math.js";
import Utils              from "../../00utility/m3d_utils.js";
import ShaderLibrary      from "../../02resource/m3d_shader_library.js";


export default (function() {
    "use strict";

    // billboard inherites drawable
    function Billboard(name, mesh, layer, shader, material, transform, bbox) {
        // Inheritance:
        Drawable.apply(this, arguments);
        
        // public:
        this.billboard = true;
        this.transform = new BillboardTransform(transform);
        
        // private:
        
        // Initialization:
        // Relax the bounding box so we don't need update the bbox
        // every frame for the culling computation.
        this.bbox = Math.aabb.createFromSphere(this.bsphere);
        this.center = Math.aabb.center(this.bbox);
        this.isShadowReceiver = false;
    };
    
    // Billboard inherits Drawable
    Billboard.prototype = Object.create(Drawable.prototype);
    Billboard.prototype.constructor = Billboard;

    Billboard.prototype.isShadowCaster = function() {
        // Billboard should be always cast shadow since it is just tree leaves
        // or people.
        return true;
    };
    
    Billboard.prototype.update = function(camera) {
        this.transform.update(camera, this.center);
    };

    Billboard.prototype.recompileShader = function(resourceManager, states) {
        var flags = [];

        flags.push("MODEL_TRANSFORM");
        if (this.layer.name.match(/glass/i)) {
            flags.push("GLASS");
        }
        if (states.section) {
            flags.push("CLIPPING");
        }

        var shaderType = this.shader.shaderSource.name;

        var shader = resourceManager.getShader(shaderType, flags);
        if (!shader.ready) {
            var shaderSource = ShaderLibrary[shaderType];
            shader.createFromShaderSource(shaderSource, flags);
            if (!shader.ready) {
                throw ("modelo3d error at creating shader '" + shaderType + "'!");
            }
        }
       
        // Rebind the drawable's shader
        this.shader = shader;
        // Rebind the material's shader 
        this.material.attachShader(this.shader);
    };

    return Billboard;
})();
    
