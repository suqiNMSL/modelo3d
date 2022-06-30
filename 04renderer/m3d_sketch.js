//
// m3d_sketch.js
// Sketch effect
//
//  



import Globals       from "../m3d_globals.js";
import ShaderLibrary from "../02resource/m3d_shader_library.js";
import RenderTarget  from "./m3d_rendertarget.js";
import Material      from "../03scene/materials/m3d_material.js";
import RenderPass    from "./m3d_renderpass.js";
import Blit          from "./m3d_blit.js";


export default (function() {
    "use strict";

    function Sketch(scene, resourceManager) {
        // private:
        this._ready         = false;
        this._threshold     = 0.0;
        this._contrast      = 100.0;
        this._blit          = null;
        this._renderTarget0 = null;
        this._scene         = scene;

        this._detailout     = 0;
        this._contrastout   = 0;

        this._blit = new Blit(resourceManager, ShaderLibrary["sketch"], Globals.isMobile);

        this.setContrast(30);
        this.setDetail(2);

        if (Globals.isMobile) {
            this._renderTarget0 = new RenderTarget("sketch-position", resourceManager,
            Globals.width, Globals.height, {
                depthTest: true, 
                colorFormat: gl.RGBA,
                clearColor: [0.5, 0.5, 1.0, 0.0],
                colorFilter: gl.NEAREST,
                depthFormat: gl.DEPTH_STENCIL,
                colorBuffer: 0,
                depthBuffer: 1
            });
        } else {
            this._renderTarget0 = new RenderTarget("sketch-position", resourceManager, 
            Globals.width, Globals.height, {
                depthTest: true, 
                colorFormat: "RGBA32F", 
                clearColor: [0.0, 0.0, 1.0, 0.0],
                colorFilter: gl.NEAREST,
                colorBuffer: 0,
                depthBuffer: 1 
            });
        }
        
        this._ready = this._renderTarget0.ready;
        
        if (!this._ready) {
            this._renderTarget0.destroy();
            this._blit.destroy();
            return ;
        }

        this._opaques      = new RenderPass(scene, false, true, {mask        : false,
                                                                 transparent : false,
                                                                 line        : false
                                                                });

        this._maskeds      = new RenderPass(scene, false, true, {mask : true});

        var shader = resourceManager.getShader("normaldepth", Globals.isMobile ? ["ENCODE_NORMAL"]: []);
        if (!shader.ready) {
            var shaderSource = ShaderLibrary["normaldepth"];
            shader.createFromShaderSource(shaderSource, Globals.isMobile ? ["ENCODE_NORMAL"]: []);
        }  
        this._opaques.setOverridedShader(shader);
        this._maskeds.setOverridedShader(shader);
        this._opaques.setOverridedMaterial(new Material("sketch"));
        this._maskeds.setOverridedMaterial(scene.materialManager.createMaterialAdhoc("sketch"));
        
        this.recompileShader(resourceManager, {
                "section": false, 
                "doubleSided": scene.needRenderDoubleSided() 
        });
    };

    Sketch.prototype.destroy = function() {
        if (this._ready) {
            this._renderTarget0.destroy();
            this._blit.destroy();
            this._ready = false;
        }
    };

    Sketch.prototype.resize = function(width, height) {
        if (this._ready) {
            this._ready = false;

            this._renderTarget0.resize(width, height);

            this._ready = this._renderTarget0.ready;

            if (!this._ready) {
                this._renderTarget0.destroy();
                this._blit.destroy();
            }
        }
    };

    // detail ~ [0, 100]
    Sketch.prototype.setDetail = function(detail) {
        var t = Math.min(Math.max(detail, 0.0), 99.9) / 100.0;
        this._threshold = Math.sqrt(1.0 - t * t) * 0.55;
        this._blit.setParameter("uThreshold", this._threshold);
        this._detailout = detail;
    };

    Sketch.prototype.getDetail = function() {
        return this._detailout;
    };

    // contrast ~ [0, 100]
    Sketch.prototype.setContrast = function(contrast) {
        this._contrast = Math.min(Math.max(contrast, 0.0), 100.0);
        this._contrast = this._contrast / 100;
        this._blit.setParameter("uContrast", this._contrast);
        this._contrastout = contrast;
    };

    Sketch.prototype.getContrast = function () {
        return this._contrastout;
    };

    Sketch.prototype.render = function(renderer, camera, renderTarget) {
        if (!this._ready) {
            return false;
        }

        // Get the position and normal
        renderer.clear(this._renderTarget0, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        this._opaques.render(this._renderTarget0, renderer, null, camera);
        this._maskeds.render(this._renderTarget0, renderer, null, camera);
        
        // Render the sketch strokes
        this._blit.setParameter("uNearAxis", camera.getNearPlaneSize());
        this._blit.setParameter("uIsPerspective", camera.isPerspective());
        this._blit.setTexture(this._renderTarget0.getColorBuffer());

        if (Globals.isMobile) {
            this._blit.setParameter("uNearFar", [camera._znear, camera._zfar]);
            this._blit.setDepthTexture(this._renderTarget0.getDepthBuffer());
        }
        this._blit.render(renderer, renderTarget, true);
    };
    
    Sketch.prototype.onSceneChanged = function() {
        if (!this._ready) {
            return;
        }

        var scene = this._scene;

        if (scene.model !== null) {
            var m = scene.model;

            this._opaques.queue.removeDrawables();
            this._maskeds.queue.removeDrawables();
            for (var i = 0, len = m.drawables.length; i < len; ++i) {
                var drawable = m.drawables[i];
                this._opaques.queue.addDrawable(drawable);
                this._maskeds.queue.addDrawable(drawable);
            }
            this._opaques.queue.optimize();
            this._maskeds.queue.optimize();

            if (!scene.needRenderDoubleSided()) {
                this._opaques.setCullFace(gl.CCW);
                this._maskeds.setCullFace(gl.CCW);
            } else {
                this._opaques.setCullFace(false);
                this._maskeds.setCullFace(false);
            }
        }
    };

    Sketch.prototype.recompileShader = function(resourceManager, states) {
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
        
        flags.push("ALPHATEST");
        this._maskeds.recompileOverridedShader(resourceManager, flags);
    };

    return Sketch;
})();
    
