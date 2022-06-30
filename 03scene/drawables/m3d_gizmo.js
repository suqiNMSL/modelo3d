//
// m3d_gizmo.js
// A drawable used for 3D UI controller which uses simple material and doesn't
// associate to scene and layers.
//
//  

import Utils         from "../../00utility/m3d_utils.js";
import ShaderLibrary from "../../02resource/m3d_shader_library.js";
import MaterialAdhoc from "../materials/m3d_material_adhoc.js";
import Drawable          from "./m3d_drawable.js";

export default (function() {
    "use strict";

    function Gizmo(name, mesh, resourceManager) {
        var flag = [];
        flag.push("MODEL_TRANSFORM");
        var shader = resourceManager.getShader("gizmo", flag);
        if (!shader.ready) {
            shader.createFromShaderSource(ShaderLibrary["constant"], flag);
        }
        
        var material = new MaterialAdhoc(name);

        // Inheritance:
        Drawable.apply(this, [name, mesh, null, shader, material, null, null]);
    };
    
    // Gizmo inherits Drawable
    Gizmo.prototype = Object.create(Drawable.prototype);
    Gizmo.prototype.constructor = Gizmo;

    Gizmo.prototype.destroy = function() {
        Drawable.prototype.destroy.apply(this);
    };

    Gizmo.prototype.setColor = function(color) {
        this.material.setDiffuse(color);
    };

    Gizmo.prototype.setTransparent = function(alpha) {
        this.material.setTransparent(alpha);
    };

    return Gizmo;
})();
    
