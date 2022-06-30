//
// m3d_sprite.js
// A sprite is a textued point.
//
//  


var modelo3d = modelo3d || {};

modelo3d.Drawable = require("./m3d_drawable.js");

(function() {
    "use strict";

    var canvasForSprites   = null; // font drawing
    var contextForSprites  = null;
    
    // By default is renders a square.
    modelo3d.Sprite = function(name, size, resourceManager, camera) {
        // Inheritance:
        modelo3d.Drawable.apply(this, [name, null, null, null, null, null]);

        // private:
        this._size            = size;
        this._texture         = null;
        this._color           = [1, 0, 0];
        this._resourceManager = resourceManager;
        this._position        = vec3.create();
        
        this._ready = this._create(camera);
    };

    modelo3d.Sprite.prototype.destroy = function() {
        modelo3d.Drawable.prototype.destroy.apply(this, arguments);
    };

    // set the label position in the world space.
    modelo3d.Sprite.prototype.setPosition = function(position) {
        vec3.copy(this._position, position);
        this.transform.setTranslation(position[0], position[1], position[2]);
    };
    
    modelo3d.Sprite.prototype._recompileShader = function(flags) {
        var VSSOURCE = "precision highp float; " +
                       "struct PerNodeStruct" +
                       "{" +
                       "    mat4 mvpMatrix; " +
                       "};" +                   
                       "uniform PerNodeStruct uPerNode; " +                   
                       "uniform float uPointSize; " +                   
                       "attribute vec3 aPosition; " +
                       "void main() " +
                       "{ " +
                       "    vec4 pos = uPerNode.mvpMatrix * vec4(aPosition, 1.0);\n" +
                       "    gl_Position = pos; " +
                       "    gl_PointSize = uPointSize; " +
                       "}";
        var FSSOURCE = "precision highp float;\n" +
                       "#if TEXTURE\n" +
                       "uniform sampler2D uTexture0;\n" +
                       "#else\n" +
                       "uniform vec3 uColor;\n" +
                       "#endif\n" +
                       "void main() " +
                       "{\n" +
                       "#if DISC\n" +
                       "vec2 cxy = 2.0 * gl_PointCoord - 1.0;\n" +
                       "if (dot(cxy, cxy) > 1.0)\n" +
                       "{\n" +
                       "    discard;\n" +
                       "}\n" +
                       "#endif\n" +
                       "#if DISC || SQUARE\n" +
                       "    gl_FragColor = vec4(uColor, 1.0);\n" +
                       "#else\n" +
                       "    gl_FragColor = texture2D(uTexture0, gl_PointCoord);\n" +
                       "#endif\n" +
                       "}";
        
        this.shader = this._resourceManager.getShader("sprite", flags);
        if (!this.shader.ready) {
            this.shader.createFromSourceFlags(VSSOURCE, FSSOURCE, flags);
        }
        if (!this.shader.ready) {
            this._ready = false;
            return false;
        } 
        this.material.attachShader(this.shader);
        return true;
    };
    
    modelo3d.Sprite.prototype.update = function() {
    };

    modelo3d.Sprite.prototype.setTexture = function(texture) {
        this._recompileShader(["TEXTURE"]);
        this._texture = texture;
        this.material.parameters["uTexture0"].value = this._texture;
        this.material.parameters["uPointSize"].value = this._size;
    };

    modelo3d.Sprite.prototype.setColor = function(color) {
        this._recompileShader(["COLOR"]);
        this._color = color.slice(0);
        this.material.parameters["uPointSize"].value = this._size;
        this.material.parameters["uColor"].value = this._color;
    };
    
    // either "square" or "disc"
    modelo3d.Sprite.prototype.setShape = function(shape) {
        this._recompileShader([shape.toUpperCase()]);
    };
    
    modelo3d.Sprite.prototype._create = function(camera) {
        this.mesh = this._resourceManager.getMesh("sprite-" + this.name);
        this.mesh.createPoint();
        if (!this.mesh.ready) {
            return false;
        }
        
        this.material = new modelo3d.Material("sprite-" + this.name);
        if (!this._recompileShader(["SQUARE"])) {
            return false;
        }
        this.material.parameters["uColor"].value = this._color;
        this.material.parameters["uPointSize"].value = this._size;

        return true;
    };

    module.exports = modelo3d.Sprite;

})();

