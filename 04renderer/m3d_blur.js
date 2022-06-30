// m3d_blur.js
// smooth a floating texture, used in SSAO and HBAO (not avaiable on mobile)
//
//  

import Globals       from "../m3d_globals.js";
import ShaderLibrary from "../02resource/m3d_shader_library.js";
import ShaderSource  from "../02resource/m3d_shader_source.js";
import RenderTarget  from "./m3d_rendertarget.js";
import Blit          from "./m3d_blit.js";

export default (function() {
    "use strict";

    function Blur(resourceManager, radius, sigma) {
        // public:
        this.result         = null;

        // private:
        this._renderTargets = [];
        this._blitx         = null;
        this._blity         = null;
        this._ready         = false;

        // initialization
        this._renderTargets[0] = new RenderTarget("blur1", resourceManager,
                Globals.width, Globals.height, {
                    colorFormat: gl.RGBA,
                    colorFilter: gl.NEAREST,
                    colorBuffer: 0, // FIXME: tightly bound with SSAO. The blur output is not resident.
                    depthBuffer: 0,
                    depthTest: false
                });
        this._renderTargets[1] = new RenderTarget("blur2", resourceManager,
                Globals.width, Globals.height, {
                    colorFormat: gl.RGBA,
                    colorFilter: gl.NEAREST,
                    colorBuffer: 1, // FIXME: tightly bound with SSAO. The blur output is not resident.
                    depthBuffer: 0,
                    depthTest: false
                });

        if (!this._renderTargets[0].ready || !this._renderTargets[1].ready) {
            return;
        }


        var xBlurShaderName = "blurx-" + radius;
        var yBlurShaderName = "blury-" + radius;
        if (!ShaderLibrary[xBlurShaderName] ||
            !ShaderLibrary[yBlurShaderName]) {

            var kernel = [];
            var sum = 0;
            var i;
            for (i = -radius; i <= radius; ++i) {
                var t = i / radius * 1.5;
                var v = Math.exp(-t * t * sigma);
                kernel.push(v);
                sum += v;
            }
            for (i = 0; i < radius * 2 + 1; ++i) {
                kernel[i] /= sum;
            }
        }

        if (!ShaderLibrary[xBlurShaderName]) {
            var XFSSOURCE  = "vec4 shade(in sampler2D tex, in vec2 uv, in vec2 invResolution)\n" +
                             "{\n" +
                             "    vec4 value = vec4(0);\n" +
                             "    float kernel[" + (2 * radius + 1) + "];\n";
            for (var i = 0; i < radius * 2 + 1; ++i) {
                XFSSOURCE += "   kernel[" + i + "] = " + kernel[i] +";\n";
            }
            
                XFSSOURCE += "    for (int i = -" + radius + "; i <= " + radius + "; i++)\n";
            
                if (gl.isWebGL2) {
                XFSSOURCE += "        value += texture(tex, (gl_FragCoord.xy + vec2(float(i), 0.0)) * invResolution) * kernel[i + " + radius + "];\n";
            } else {
                XFSSOURCE += "        value += texture2D(tex, (gl_FragCoord.xy + vec2(float(i), 0.0)) * invResolution) * kernel[i + " + radius + "];\n";
            }
                XFSSOURCE += "    return value;\n" +
                            "}\n";
            ShaderLibrary[xBlurShaderName] = new ShaderSource(xBlurShaderName,
                    "blit.vs", ["blit.fs", XFSSOURCE],
                    {
                        "highPrecision" : true,
                        "position"      : true,
                        "uv"            : true
                    });
        }

        if (!ShaderLibrary[yBlurShaderName]) {
            var YFSSOURCE =  "vec4 shade(in sampler2D tex, in vec2 uv, in vec2 invResolution)\n" +
                             "{\n" +
                             "    vec4 value = vec4(0);\n" +
                             "    float kernel[" + (2 * radius + 1) + "];\n";
            for (var i = 0; i < radius * 2 + 1; ++i) {
                YFSSOURCE += "   kernel[" + i + "] = " + kernel[i] +";\n";
            }
                YFSSOURCE += "    for (int i = -" + radius + "; i <= " + radius + "; i++)\n";
                if (gl.isWebGL2) {
                YFSSOURCE += "        value += texture(tex, (gl_FragCoord.xy + vec2(0.0, float(i))) * invResolution) * kernel[i + " + radius + "];\n";
            } else {
                YFSSOURCE += "        value += texture2D(tex, (gl_FragCoord.xy + vec2(0.0, float(i))) * invResolution) * kernel[i + " + radius + "];\n";
            }
                YFSSOURCE += "    return value;\n" +
                             "} ";
            ShaderLibrary[yBlurShaderName] = new ShaderSource(yBlurShaderName, 
                    "blit.vs", ["blit.fs", YFSSOURCE],
                    {
                        "highPrecision" : true,
                        "position"      : true,
                        "uv"            : true
                    });
        }

        this._blitx = new Blit(resourceManager, ShaderLibrary[xBlurShaderName]);
        this._blity = new Blit(resourceManager, ShaderLibrary[yBlurShaderName]);

        this._ready = this._blitx.ready && this._blity.ready;

    };

    Blur.prototype.destroy = function() {
        if (this._ready) {
            this._renderTargets[0].destroy();
            this._renderTargets[1].destroy();

            this._blitx.destroy();
            this._blity.destroy();
        }
    };
    
    Blur.prototype.resize = function(width, height) {
        if (this._ready) {
            this._ready = false;

            this._renderTargets[0].resize(width, height);
            this._renderTargets[1].resize(width, height);

            this._ready = this._renderTargets[0].ready && 
                          this._renderTargets[1].ready;
        }
    };

    Blur.prototype.smooth = function(texture, renderer, iterations, radius) {
        if (!this._ready) {
            console.error("'blur' is not ready.");
            return null;
        }

        var index = 0;
        var i;
        for (i = 0; i < iterations; ++i) {
            // Smooth in X direction
            if (i === 0) {
                this._blitx.setTexture(texture);
            } else {
                this._blitx.setTexture(this._renderTargets[index].getColorBuffer());
            }
            this._blitx.render(renderer, this._renderTargets[1 - index]);
            index = 1 - index;
            
            // Smooth in Y direction
            this._blity.setTexture(this._renderTargets[index].getColorBuffer());
            this._blity.render(renderer, this._renderTargets[1 - index]);
            index = 1 - index;
        }
        
        this._result = this._renderTargets[index].getColorBuffer();

        return this._result;
    };

    return Blur;
})();

