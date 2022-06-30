//
// m3d_glow.js
// Screen-screen glow
//
//  


var modelo3d = modelo3d || {};

(function() {
    "use strict";

    modelo3d.Glow = function(fx) {
        this.fxhelper   = new modelo3d.FXHelper;
        this.ready      = false;
        this.enabled    = false;
        this.iterations = 3;
        this.parameters = {};
        this.dirty      = true;
    }; // end of modelo3d.FX.Glow

    modelo3d.Glow.prototype.initialize = function(resourceManager) {
        if (this.ready) {
            return this;
        }

        this.fxhelper.initialize(resourceManager);
        if (!this.fxhelper.ready) {
            return null;
        }

        this.parameters.color    = vec3.fromValues(1.0, 0.0, 0.0); 
        this.parameters.strength = 3.0;
        
        var GLOWXFSSOURCE = "precision mediump float; " +
                            "uniform sampler2D uTexture; " +
                            "uniform vec2 uInvResolution; " +
                            "uniform float uStep; " +
                            "void main() " +
                            "{ " +
                            "    vec4 color = vec4(0); " +
                            "    for (int dx = 0; dx < 5; ++dx) " +
                            "    { " +
                            "        vec2 coord = (gl_FragCoord.xy + vec2(float(dx - 2) * uStep, 0.0)) * uInvResolution; " +
                            "        color += texture2D(uTexture, coord); " +
                            "    } " +
                            "    color *= 0.2; " +
                            "    gl_FragColor = color; " +
                            "} ";
        var GLOWYFSSOURCE = "precision mediump float; " +
                            "uniform sampler2D uTexture; " +
                            "uniform vec2 uInvResolution; " +
                            "uniform float uStep; " +
                            "void main() " +
                            "{ " +
                            "    vec4 color = vec4(0); " +
                            "    for (int dy = 0; dy < 5; ++dy) " +
                            "    { " +
                            "        vec2 coord = (gl_FragCoord.xy + vec2(0.0, float(dy - 2) * uStep)) * uInvResolution; " +
                            "        color += texture2D(uTexture, coord); " +
                            "    } " +
                            "    color *= 0.2; " +
                            "    gl_FragColor = color; " +
                            "} ";
       
        var GLOWFSSOURCE = "precision mediump float; " +
                           "uniform sampler2D uDstTexture; " +
                           "uniform sampler2D uSrcTexture; " +
                           "uniform vec3 uGlowColor; " +
                           "uniform vec2 uInvResolution; " +
                           "void main() " +
                           "{ " +
                           "    vec4 dst = texture2D(uDstTexture, gl_FragCoord.xy * uInvResolution); " +
                           "    vec4 src = texture2D(uSrcTexture, gl_FragCoord.xy * uInvResolution); " +
                           "    float mask = max(src.a - dst.a, 0.0); " + 
                           "    gl_FragColor = vec4(uGlowColor * mask + dst.rgb * (1.0 - mask), max(mask, dst.a)); " +
                           "} ";
        
        this.blurxShader = resourceManager.getShader("glowblurx");
        this.bluryShader = resourceManager.getShader("glowblury");
        this.glowShader  = resourceManager.getShader("glow");
        
        this.blurxShader.createFromSource(this.fxhelper.VSSOURCE, GLOWXFSSOURCE);
        this.bluryShader.createFromSource(this.fxhelper.VSSOURCE, GLOWYFSSOURCE);
        this.glowShader.createFromSource(this.fxhelper.VSSOURCE, GLOWFSSOURCE);
        
        if (!this.blurxShader.ready ||
            !this.bluryShader.ready ||
            !this.glowShader.ready) {

            this.blurxShader.destroy();
            this.bluryShader.destroy();
            this.glowShader.destroy();
        } else {
            this.ready = true;
        }

        return this;
    }; // modelo3d.Glow.prototype.initialize

    modelo3d.Glow.prototype.set = function(parameter, value) {
        this.parameters[parameter] = value;
        this.dirty = true;
    }; // modelo3d.Glow.prototype.set
    
    modelo3d.Glow.prototype.resize = function() {
        this.fxhelper.resize();
        this.ready = this.fxhelper.ready;
        this.dirty = true;
    };
        
    modelo3d.Glow.prototype.apply = function(renderer, scene, resourceManager) {
        if (!this.enabled) {
            return ;
        }
        if (!this.ready) {
            console.error("Glow has not been initialized.");
            return ;
        }

        // Update shader uniforms.
        if (this.dirty) {
            var width = this.fxhelper.framebuffers[0].width;
            var height = this.fxhelper.framebuffers[0].height;

            this.blurxShader.bind();
            this.blurxShader.uniforms["uInvResolution"].upload([1.0 / width, 1.0 / height]);
            this.blurxShader.uniforms["uTexture"].upload(0);
            this.blurxShader.uniforms["uStep"].upload(this.parameters.strength); // This value affects the range of the glow.
            
            this.bluryShader.bind();
            this.bluryShader.uniforms["uInvResolution"].upload([1.0 / width, 1.0 / height]);
            this.bluryShader.uniforms["uTexture"].upload(0);
            this.bluryShader.uniforms["uStep"].upload(this.parameters.strength); // This value affects the range of the glow.
            
            this.glowShader.bind();
            this.glowShader.uniforms["uGlowColor"].upload(this.parameters.color);

            this.dirty = false;
        }

        this.fxhelper.apply(resourceManager, this.iterations, [this.blurxShader, this.bluryShader], this.glowShader);
    }; // modelo3d.Glow.overlay.initialize

})();

