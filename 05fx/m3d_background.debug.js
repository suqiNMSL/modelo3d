//
// m3d_background.js
// The background
//
//  


var modelo3d = modelo3d || {};

(function() {
    "use strict";
    
    modelo3d.Background = function(resourceManager) {
        // private:
        this._ready          = false;
        this._enabled        = false;
        this._material       = null;
        this._texture        = null;
        this._textureScaling = new Float32Array([1.0, 1.0]);

        // initialization
        var VSSOURCE = "precision highp float; " +
                       "attribute vec3 aPosition; " +
                       "attribute vec2 aTexCoord0; " +
                       "varying mediump vec2 vTexCoord;" +
                       "void main() " + 
                       "{ " +
                       "    gl_Position = vec4(aPosition.xy, 0.9999, 1.0); " +
                       "    vTexCoord = aTexCoord0; " +
                       "}";

        var FSSOURCE =  "precision mediump float; " +
                        "uniform sampler2D uTexture;" +
                        "uniform vec2 uTextureScaling; " +
                        "varying mediump vec2 vTexCoord;" +
                        "void main()  " +
                        "{" +
                        "    gl_FragColor = texture2D(uTexture, vec2(vTexCoord.x, 1.0 - vTexCoord.y) * uTextureScaling);" +
                        "} ";

        var shader = resourceManager.getShader("background");
        shader.createFromSource(VSSOURCE, FSSOURCE);  
        
        if (!shader.ready) {
            return;
        }
        this._material = new modelo3d.Material("background");
        this._material.attachShader(shader);

        this._texture = resourceManager.getTexture("background");

        this._renderTarget = new modelo3d.RenderTarget("default", resourceManager,
                modelo3d.width, modelo3d.height, { depthMask: false });
    };

    modelo3d.Background.prototype.destroy = function() {
        if (this._ready) {
            this._texture.destroy();
            this._material.destroy();
            this._renderTarget.destroy();
        }
    };

    modelo3d.Background.prototype.setImage = function(image) {
        var that = this;

        if (image) {
            this._enabled = true;

            that._texture.createFromImage(image, gl.RGB, gl.UNSIGNED_BYTE, gl.LINEAR, gl.CLAMP_TO_EDGE);
            that._ready = that._texture.ready;
            that.resize(modelo3d.width, modelo3d.height);
        } else {
            this._enabled = false;
        }
    };

    modelo3d.Background.prototype.resize = function() {
        if (this._ready) {
            var width = modelo3d.width;
            var height = modelo3d.height;

            var xscaling = width / this._texture.width;
            var yscaling = height / this._texture.height;

            // Stretch the _texture to fill the window. 
            // 1) when _texture is larger than window, it only shows the portion of it with aspect ratio kept.
            // 2) when _texture is smaller than window, it is stretched to fill the window with aspect ratio kept.
            var scaledWidth;
            var scaledHeight;
            if (xscaling > yscaling) {
                scaledWidth = Math.max(width, this._texture.width);
                scaledHeight = this._texture.height * scaledWidth / this._texture.width;
            } else {
                scaledHeight = Math.max(height, this._texture.height);
                scaledWidth = this._texture.width * scaledHeight / this._texture.height;
            }

            this._textureScaling = new Float32Array([width / scaledWidth, height / scaledHeight]);
        }
    };

    modelo3d.Background.prototype.render = function(renderer) {
        if (!this._ready || !this._enabled) {
            return ;
        }

        var renderCore = renderer.renderCore;
        
        this._texture.use(0);
        renderCore.renderState.useMaterial(this._material);
        var uniforms = this._material.shader.uniforms;
        uniforms["uTexture"].upload(0);
        uniforms["uTextureScaling"].upload(this._textureScaling);
        
        renderCore.drawScreen(this._renderTarget, this._material, 0);
    };

})();


