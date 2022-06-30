// m3d_oit.js
// Order indepent transparency rendering
//
//  
//

import Globals       from "../m3d_globals.js";
import ShaderLibrary from "../02resource/m3d_shader_library.js";
import RenderTarget  from "./m3d_rendertarget.js";
import Blit          from "./m3d_blit.js";
import RenderPass    from "./m3d_renderpass.js";


export default (function() {

    "use strict";

    function OIT(scene, resourceManager) {
        this._ready          = false;
        this._rt0            = null;
        this._rt1            = null;
        this._shader0        = null;
        this._shader1        = null;
        
        // initialization
        if (Globals.isMobile) {
            console.warn("OIT is not supported on iOS.");
            return;
        }

        this._rt0 = new RenderTarget("oit-accum", resourceManager,
                Globals.width, Globals.height, { 
                    blend: true,
                    depthMask: false,
                    clearColor: [0.0, 0.0, 0.0, 0.0],
                    colorFormat: "RGBA32F", 
                    colorBuffer: 0,
                    depthFormat: gl.DEPTH_STENCIL,
                    depthBuffer: 0 
                });

        this._rt1 = new RenderTarget("oit-reveal", resourceManager,
                Globals.width, Globals.height, { 
                    blend: true,
                    depthMask: false,
                    clearColor: [1.0, 1.0, 1.0, 0.0], 
                    colorFormat: "RGBA32F", 
                    colorBuffer: 1,  // don't collide with oit-accum
                    depthFormat: gl.DEPTH_STENCIL,
                    depthBuffer: 0, 
                });

        this._solids = new RenderPass(scene, false, true, {transparent : true,
                                                           line        : false,
                                                           texture     : false,
                                                           mask        : false
                                                          });

        // We don't render textured object in OIT as we don't support
        // texture sampling in OIT accumulate shader.
        this._textureds = new RenderPass(scene, true, true, {transparent : true,
                                                             line        : false,
                                                             texture     : true,
                                                             mask        : false
                                                            });
        
        this._ready = this.recompileShader(resourceManager, []);

        this._blit = new Blit(resourceManager, ShaderLibrary["oit"]);
        this._blit.setTexture(this._rt0.getColorBuffer());
        this._blit.setParameter("uTexture1", this._rt1.getColorBuffer());

        if (!this._ready) {
            this.destroy();
        }
    };
    
    OIT.prototype.resize = function(width, height) {
        if (Globals.isMobile) {
            return;
        }

        if (this._ready) {
            this._ready = false;

            this._rt0.resize(width, height);
            this._rt1.resize(width, height);

            this._ready = this._rt0.ready && this._rt1.ready;

            if (!this._ready) {
                this.destroy();
            }
        }
    };

    OIT.prototype.destroy = function() {
        if (this._ready) {
            this._rt0.destroy();
            this._rt1.destroy();
            this._shader0.destroy();
            this._shader1.destroy();
            this._textureds.destroy();
            this._solids.destroy();
            this._ready = false;
        }
    };

    OIT.prototype.render = function(renderer, scene, camera, renderTarget) {
        if (Globals.isMobile || !this._ready) {
            return;
        }

        this._textureds.render(renderTarget, renderer, null, camera);

        // Since we render OIT in the middle of rendering scene, we need to invalidate
        // render states to sync lighting on our OIT shaders.
        renderer.invalidate();

        // Note the depth buffer already contains the opaques and other drawables before
        // transparent drawables.
        renderer.clear(this._rt0, gl.COLOR_BUFFER_BIT);
        gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
        this._solids.setOverridedShader(this._shader0);
        this._solids.render(this._rt0, renderer, null, camera);

        renderer.clear(this._rt1, gl.COLOR_BUFFER_BIT);
        gl.blendFuncSeparate(gl.ZERO, gl.SRC_COLOR, gl.ZERO, gl.SRC_ALPHA);
        this._solids.setOverridedShader(this._shader1);
        this._solids.render(this._rt1, renderer, null, camera);

        // Restore the defualt alpha blending equation, and combine accumulated RGB and alpha before
        // overlay their result to the out render target.
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        this._blit.render(renderer, renderTarget, true);
    };

    OIT.prototype.setOverridedMaterial = function(material) {
        if (Globals.isMobile || !this._ready) {
            return;
        }
        this._solids.setOverridedMaterial(material);
        this._textureds.setOverridedMaterial(material);
    };
    
    OIT.prototype.setOverridedMaterial = function(material) {
        if (Globals.isMobile || !this._ready) {
            return;
        }
        this._solids.setOverridedMaterial(material);
        this._textureds.setOverridedMaterial(material);
    };
    
    OIT.prototype.setOverridedShader = function(shader) {
        if (Globals.isMobile || !this._ready) {
            return;
        }
        this._solids.setOverridedShader(shader);
        this._textureds.setOverridedShader(shader);
    };
    
    OIT.prototype.onSceneChanged = function(scene) {
        if (Globals.isMobile || !this._ready) {
            return;
        }
        this._textureds.queue.removeDrawables();
        this._solids.queue.removeDrawables();
        
        if (scene.model !== null) {
            var m = scene.model;
            for (var i = 0, len = m.drawables.length; i < len; ++i) {
                var drawable = m.drawables[i];
                this._solids.queue.addDrawable(drawable);
                this._textureds.queue.addDrawable(drawable);
            }
            this._solids.queue.optimize();
            this._textureds.queue.optimize();

            var cullFace = (scene.needRenderDoubleSided()? false : gl.CCW);

            this._solids.setCullFace(cullFace);
            this._textureds.setCullFace(cullFace);
        }
    };

    OIT.prototype.recompileShader = function(resourceManager, flags) {
        if (Globals.isMobile) {
            return false;
        }
        this._shader0 = resourceManager.getShader("oit-accum", flags);
        if (!this._shader0.ready) {
            this._shader0.createFromShaderSource(ShaderLibrary["oit_accum"], flags);
        }

        this._shader1 = resourceManager.getShader("oit-reveal", flags);
        if (!this._shader1.ready) {
            this._shader1.createFromShaderSource(ShaderLibrary["oit_reveal"], flags);
        }

        return true;
    };

    return OIT;
})();

