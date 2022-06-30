//
// m3d_gizmo.js
// A drawable used for 3D UI controller which uses simple material and doesn't
// associate to scene and layers.
//
//  

import Utils         from "../../00utility/m3d_utils.js";
import ShaderLibrary from "../../02resource/m3d_shader_library.js";
import MaterialBlit  from "../materials/m3d_material_blit.js";
import Drawable          from "./m3d_drawable.js";

export default (function() {
    "use strict";

    function Gizmo2D(name, mesh, resourceManager) {
        // private:
        this._resourceManager = resourceManager;

        // initialization
        var shader = resourceManager.getShader("gizmo2d");
        if (!shader.ready) {
            shader.createFromShaderSource(ShaderLibrary["constant2d"]);
        }
        var material = new MaterialBlit(name);
        material.attachShader(shader);
        
        // Inheritance:
        Drawable.apply(this, [name, mesh, null, shader, material, null, null]);

        this._textured = false; // using texture or not. 
    };
    
    // Gizmo2D inherits Drawable
    Gizmo2D.prototype = Object.create(Drawable.prototype);
    Gizmo2D.prototype.constructor = Gizmo2D;

    Gizmo2D.prototype.setColor = function(color) {
        if (this._textured) {
            this.shader = this._resourceManager.getShader("gizmo2d");
            if (!this.shader.ready) {
                this.shader.createFromShaderSource(ShaderLibrary["constant2d"]);
            }
            this.material.attachShader(this.shader);

            this._textured = false;
        } 

        this.material.parameters["uColor"].value = color;
    };

    Gizmo2D.prototype.setTransparent = function(alpha) {
        if (this._textured) {
            this.shader = this._resourceManager.getShader("gizmo2d");
            if (!this.shader.ready) {
                this.shader.createFromShaderSource(ShaderLibrary["constant2d"]);
            }
            this.material.attachShader(this.shader);

            this._textured = false;
        } 

        // TODO: transparency is not supported yet.
        //this.material.setTransparent(alpha);
    };

    Gizmo2D.prototype.setTexture = function(texture) {
        if (!this._textured) {
            this.shader = this._resourceManager.getShader("blit");
            if (!this.shader.ready) {
                this.shader.createFromShaderSource(ShaderLibrary["blit"]);
            }
            this.material.attachShader(this.shader);

            this._textured = true;
        } 

        this.material.setTexture(texture);
    };

    return Gizmo2D;
})();
    
