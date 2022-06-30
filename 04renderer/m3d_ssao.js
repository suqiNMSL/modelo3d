//
// m3d_ssao.js
// Screen-screen AO (not supported on Mobile)
//
//  


import Globals       from "../m3d_globals.js";
import ShaderLibrary from "../02resource/m3d_shader_library.js";
import Transform     from "../03scene/drawables/m3d_transform.js";
import Material      from "../03scene/materials/m3d_material.js";
import Blit          from "./m3d_blit.js";
import Blur          from "./m3d_blur.js";
import SAMPLES       from "./m3d_samples.js";
import RenderPass    from "./m3d_renderpass.js";
import RenderTarget  from "./m3d_rendertarget.js";

export default (function() {
    "use strict";

    function SSAO(scene, resourceManager) {
        // private:
        this._ready             = false;
        this._resourceManager   = resourceManager;
        this._scene             = scene;

        this._rt0               = null;
        this._rt1               = null;
        this._shader0           = null;
    
        this._transform0        = new Transform();

        this._blit              = null;
        this._blur              = null;
        this._bitblit           = null; 

        if (Globals.isMobile) {
            this._rt0 = new RenderTarget("ssao-rt0", resourceManager,
                Globals.width, Globals.height, {
                depthTest: true, 
                colorFormat: gl.RGBA,
                clearColor: [0, 0, 1, -1e10],
                colorFilter: gl.NEAREST,
                depthFormat: gl.DEPTH_STENCIL,
                depthBuffer: 1
            });
        } else {
            this._rt0 = new RenderTarget("ssao-rt0", resourceManager,
                Globals.width, Globals.height, {
                    colorFormat: "RGBA32F", 
                    colorFilter: gl.LINEAR,
                    colorBuffer: 0,
                    clearColor: [0, 0, 1, -1e10],
                    depthFormat: gl.DEPTH_STENCIL,
                    depthBuffer: 0
                });
        }
        
        this._rt1 = new RenderTarget("ssao-rt1", resourceManager,
                Globals.width, Globals.height, {
                    colorFormat: gl.RGBA,
                    colorFilter: gl.NEAREST,
                    colorBuffer: 0,
                    depthFormat: gl.DEPTH_STENCIL,
                    depthBuffer: 0
                });

        if (!this._rt0.ready || !this._rt1.ready) {
            return;
        }

        // Create shaders.
        this._opaques = new RenderPass(scene, false, true, {mask: false, transparent: false, line: false });
        this._maskeds = new RenderPass(scene, false, true, {mask: true});
        this._lines   = new RenderPass(scene, false, true, {line: true});

        var shader = resourceManager.getShader("normaldepth", Globals.isMobile ? ["ENCODE_NORMAL"]: []);
        if (!shader.ready) {
            var shaderSource = ShaderLibrary["normaldepth"];
            shader.createFromShaderSource(shaderSource, Globals.isMobile ? ["ENCODE_NORMAL"]: []);
        }  
        this._opaques.setOverridedShader(shader);
        this._maskeds.setOverridedShader(shader);
        this._opaques.setOverridedMaterial(new Material("ssao"));
        this._maskeds.setOverridedMaterial(scene.materialManager.createMaterialAdhoc("ssao"));
        this.recompileShader(resourceManager, {
                "section": false, 
                "doubleSided": this._scene.needRenderDoubleSided()
        });

        // Other utilities
        this._blur = new Blur(resourceManager, 1, 0.8);

        this._blit = new Blit(resourceManager, ShaderLibrary["ssao"], Globals.isMobile);
        this._blit.setTexture(this._rt0.getColorBuffer());

        this._bitblit = new Blit(resourceManager);

        this._ready = true;
    };

    SSAO.prototype.destroy = function() {
        if (this._ready) {
            this._rt0.destroy();
            this._rt1.destroy();
            this._blur.destroy();
            this._blit.destroy();
        
            this._maskeds.destroy();
            this._opaques.destroy();
            this._lines.destroy();
        }
    };

    SSAO.prototype.recompileShader = function(resourceManager, states) {
        var flags = [];
        if (states.section) {
            flags.push("CLIPPING");
        }
        if (states.doubleSided) {
            flags.push("DOUBLESIDED");
        }
        if (this._scene.compressed) {
            flags.push("COMPRESSION");
        }
        if (Globals.isMobile) {
            flags.push("ENCODE_NORMAL");
        }
        this._opaques.recompileOverridedShader(resourceManager, flags);
        this._lines.recompileOverridedShader(resourceManager, flags);

        flags.push("ALPHATEST");
        this._maskeds.recompileOverridedShader(resourceManager, flags);
    };

    SSAO.prototype.resize = function(width, height) {
        if (this._ready) {
            this._ready = false;

            this._rt0.resize(width, height);
            this._rt1.resize(width, height);

            this._blur.resize(width, height);

            this._ready = (this._rt0.ready &&
                           this._rt1.ready &&
                           this._blur._ready);
        }
    };

    SSAO.prototype.render = function(renderer, camera, renderTarget, frameIdx) {
        if (!this._ready) {
            return;
        }

        // 1. Render the scene (only opaques) with current camera and
        // obtain the eyespace depth and normals.
        renderer.clear(this._rt0, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        this._opaques.render(this._rt0, renderer, null, camera);
        this._maskeds.render(this._rt0, renderer, null, camera);
        this._lines.render(this._rt0, renderer, null, camera);

        // 2. Generate AO
        // Only compute AO at the scene pixels.
        this._blit.setParameter("uNearAxis", camera.getNearPlaneSize());
        this._blit.setParameter("uIsPerspective", camera.isPerspective());
        this._blit.setParameter("uTexTransform", [camera.viewport[2] / Globals.width, camera.viewport[0] / Globals.width]);
        this._blit.setParameter("uRadius", 5.0 / this._scene.scaleRatio);
        this._blit.setParameter("uTexSizeAndInv", 
                [Globals.width, Globals.height, 1.0 / Globals.width, 1.0 / Globals.height]);
        this._blit.setParameter("uFrameCount", frameIdx); 
        this._blit.setParameter("SAMPLES[0]", SAMPLES._8x8_2D_LIST[frameIdx]);
        if (Globals.isMobile) {
            this._blit.setParameter("uNearFar", [camera._znear, camera._zfar]);
            this._blit.setDepthTexture(this._rt0.getDepthBuffer());
        }
        
        this._blit.render(renderer, this._rt1);

        // 3. Smooth AO
        var texture = this._blur.smooth(this._rt1.getColorBuffer(), renderer, 1);

        // 4. Multiply the current color buffer with AO and don't change the alpha value.
        this._bitblit.setTexture(texture);
        // FIXME: don't change the blend func instead changing the shader output.
        
        gl.blendFuncSeparate(gl.ZERO, gl.SRC_COLOR, gl.ZERO, gl.ONE);
        this._bitblit.render(renderer, renderTarget, true, true);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    };
    
    SSAO.prototype.onSceneChanged = function() {
        if (!this._ready) {
            return;
        }

        var scene = this._scene;

        if (scene.model !== null) {

            var m = scene.model;

            this._opaques.queue.removeDrawables();
            this._maskeds.queue.removeDrawables();
            this._lines.queue.removeDrawables();

            for (var i = 0, len = m.drawables.length; i < len; ++i) {
                var drawable = m.drawables[i];
                this._opaques.queue.addDrawable(drawable);
                this._maskeds.queue.addDrawable(drawable);
                this._lines.queue.addDrawable(drawable);
            }
            this._opaques.queue.optimize();
            this._maskeds.queue.optimize();
            this._lines.queue.optimize();
            
            if (!scene.needRenderDoubleSided()) {
                this._opaques.setCullFace(gl.CCW);
                this._maskeds.setCullFace(gl.CCW);
            } else {
                this._opaques.setCullFace(false);
                this._maskeds.setCullFace(false);
            }

            this._lines.setCullFace(false);

        }
    };

    return SSAO;
})();
    
