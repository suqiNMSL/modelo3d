//
// m3d_label.js
// A label is a few decorated text characters
//
//  


var modelo3d = modelo3d || {};

(function() {
    "use strict";

    var canvasForLabels   = null; // font drawing
    var contextForLabels  = null;
    var canvasForLabels1  = null; // font metric measurement
    var contextForLabels1 = null;
    
    // options include
    // fontface, height, bold, color, bgcolor, facecamera, ("disk/"square")
    // when text begins with symbol, it draws a symbol, e.g., "symbol:disc" renders
    // a filled disk.
    modelo3d.Label = function(resourceManager, camera, text, options) {
        // Inheritance:
        modelo3d.Drawable.apply(this, [text, null, null, null, null, null]);

        // private:
        this._options         = options;
        this._texture         = null;
        this._resourceManager = resourceManager;
        this._position        = vec3.create();
        
        // initialization

        if (!this._options.hasOwnProperty("fontface")) {
            this._options.fontface = "Arial";
        }
        if (!this._options.hasOwnProperty("height")) {
            this._options.height = "24";
        }
        if (!this._options.hasOwnProperty("bold")) {
            this._options.bold = false;
        }
        if (!this._options.hasOwnProperty("color")) {
            this._options.color = [0.0, 0.0, 0.0, 1.0];
        }
        if (!this._options.hasOwnProperty("bgcolor")) {
            this._options.bgcolor = [1.0, 0.0, 0.0, 1.0];
        }
        if (!this._options.hasOwnProperty("facecamera")) {
            this._options.facecamera = false;
        }
        
        this._ready = this._create(camera);
    };

    modelo3d.Label.prototype.destroy = function() {
        modelo3d.Drawable.prototype.destroy.apply(this, arguments);
    };

    modelo3d.Label.prototype.update = function(camera) {
        if (this._options.facecamera) {
            this.transform.update(camera, this._position);
        }
    };
    
    modelo3d.Label.prototype.setFaceCameraEnabled = function(enabled) {
        if (this._options.facecamera !== enabled) {
            this._options.facecamera = enabled;
            var modelMatrix;
            if (this._options.facecamera) {
                modelMatrix = mat4.clone(this.transform.modelMatrix);
                this.transform = new modelo3d.SpriteTransform(modelMatrix);
            } else {
                modelMatrix = mat4.clone(this.transform._transformMatrix);
                this.transform = new modelo3d.Transform(modelMatrix);
            }
        };
    };

    // set the label position in the world space.
    modelo3d.Label.prototype.setPosition = function(position) {
        vec3.copy(this._position, position);
        this.transform.setTranslation(position[0], position[1], position[2]);
    };
    
    modelo3d.Label.prototype._compileShader = function() {
        var VSSOURCE = "precision highp float; " +
                       "struct PerNodeStruct" +
                       "{" +
                       "    mat4 mvpMatrix; " +
                       "};" +                   
                       "uniform PerNodeStruct uPerNode; " +                   
                       "attribute vec3 aPosition; " +
                       "attribute vec2 aTexCoord0; " +
                       "varying vec2 vTexCoord0; " +
                       "void main() " +
                       "{ " +
                       "    vec4 pos = uPerNode.mvpMatrix * vec4(aPosition, 1.0);\n" +
                       "    gl_Position = pos; " +
                       "    vTexCoord0 = aTexCoord0; " +
                       "}";
        var FSSOURCE = "precision highp float; " +
                       "uniform sampler2D uTexture0; " +
                       "varying vec2 vTexCoord0; " +
                       "void main() " +
                       "{ " +
                       "    gl_FragColor = texture2D(uTexture0, vTexCoord0.xy); " +
                       "}";
        
        this.shader = this._resourceManager.getShader("label", []);
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
    
    modelo3d.Label.prototype._create = function(camera) {
        // create 2D context
        if (!canvasForLabels1) {
            canvasForLabels1 = document.createElement('canvas');
        }
        if (!contextForLabels1) {
            contextForLabels1 = canvasForLabels1.getContext("2d");
        }

        // create the font bitmap
        contextForLabels1.font = (this._options.bold? "Bold " : "") + 
                                 (this._options.height + "pt ") + 
                                 (this._options.fontface);
    
        var metrics = contextForLabels1.measureText(this.name);
        
        var height = parseInt(this._options.height);
        var width = metrics.width? metrics.width : height;
        
        // create 2D context
        if (!canvasForLabels) {
            canvasForLabels = document.createElement('canvas');
        }
        if (!contextForLabels) {
            contextForLabels = canvasForLabels.getContext("2d");
        }
            
        canvasForLabels.width = width;
        canvasForLabels.height = height;

        contextForLabels.font = (this._options.bold? "Bold " : "") + 
                                (this._options.height + "pt ") + 
                                (this._options.fontface);

        contextForLabels.fillStyle = "rgba(" + Math.floor(this._options.bgcolor[0] * 255.0) + "," + 
                                               Math.floor(this._options.bgcolor[1] * 255.0) + "," +
                                               Math.floor(this._options.bgcolor[2] * 255.0) + "," +
                                               "0" + ")";
        contextForLabels.fillRect(0, 0, width, height);

        contextForLabels.fillStyle = "rgba(" + Math.floor(this._options.color[0] * 255) + "," + 
                                               Math.floor(this._options.color[1] * 255) + "," +
                                               Math.floor(this._options.color[2] * 255) + "," +
                                               Math.floor(this._options.color[3] * 255) + ")";

        //if (this._options.decoration === "disk") {
        //    contextForLabels.arc(Math.min(width / 2, height / 2), width / 2, height / 2, 0, 2 * Math.PI);
        //    contextForLabels.fill();
        //} 
        //if (this._options.decoration === "square") {
        //    contextForLabels.rect(0, 0, width, height);
        //    contextForLabels.fill();
        //} 

        contextForLabels.textAlign = "center";
        contextForLabels.textBaseline = "middle";
        contextForLabels.fillText(this.name, width / 2, height / 2);

        // Create GL resources
        this._texture = this._resourceManager.getTexture("label-" + this.name);
        this._texture.createFromCanvas(canvasForLabels, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR, gl.CLAMP_TO_EDGE);
        if (!this._texture.ready) {
            return false;
        }

        this.mesh = this._resourceManager.getMesh("label-" + this.name);
        this.mesh.createQuad();
        if (!this.mesh.ready) {
            return false;
        }
        
        this.material = new modelo3d.Material("label-" + this.name);
        if (!this._compileShader()) {
            return false;
        }
        this.material.parameters["uTexture0"].value = this._texture;

        // Setup the transform matrix.
        var xscale = width;
        var yscale = height;
        var aspect = xscale / yscale;

        var nearPlane = camera.getNearPlaneSize();

        var s = Math.min(xscale / (modelo3d.width / modelo3d.devicePixelRatio) * nearPlane[0], 
                         yscale / (modelo3d.height / modelo3d.devicePixelRatio) * nearPlane[1]);
        
        this.transform.setScaling(s * aspect, s, 1.0);
        this.transform.setRotation(Math.PI * 0.5, [1, 0, 0]);

        return true;
    };



})();

