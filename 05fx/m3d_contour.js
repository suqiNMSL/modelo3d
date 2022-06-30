//
// m3d_contour.js
// The contour
//
//  


import Globals       from "../m3d_globals.js";
import ShaderLibrary from "../02resource/m3d_shader_library.js";
import ShaderSource  from "../02resource/m3d_shader_source.js";
import Blit          from "../04renderer/m3d_blit.js";
import RenderTarget  from "../04renderer/m3d_rendertarget.js";

export default (function() {
    "use strict";
    
    function Contour(resourceManager, scene) {
        // private:
        this._color             = new Float32Array([1, 0, 0, 1]);
        this._contourBlit       = null;
        this._overlayBlit       = null;
        this._shaders           = [null, null, null];
        this._material          = null;
        this._ready             = false;
        this._drawablesDepthRT  = null;
        this._drawablesColorRT  = null;
        this._overlayRT         = null;
        this._contourRT         = null;
    
        // initialize
        // contour detection shader.
        this._contourBlit = new Blit(resourceManager, ShaderLibrary["contour"]);
        
        // overlay contour over scene after smooth the contour.
        this._overlayBlit = new Blit(resourceManager, ShaderLibrary["contouroverlay"]);
        
        this._drawablesDepthRT = new RenderTarget("contour-drawablesdepth", resourceManager,
                Globals.width, Globals.height, {
                    colorBuffer: 0,
                    colorMask: [0, 0, 0, 0],
                    depthBuffer: 0
                });
        this._drawablesColorRT = new RenderTarget("contour-drawablescolor", resourceManager,
                Globals.width, Globals.height, {
                    colorBuffer: 0,
                    clearColor: [0, 0, 0, 0],
                    depthFunc: gl.EQUAL,
                    depthBuffer: 0
                });
        this._contourRT = new RenderTarget("contour", resourceManager,
                Globals.width, Globals.height, { 
                    colorBuffer: 1,
                    depthTest: false, 
                    depthBuffer: 0 
                });
        this._overlayRT = new RenderTarget("default", resourceManager,
                Globals.width, Globals.height, { 
                    depthTest: false, 
                    blend: true
                });

        if (!this._drawablesDepthRT.ready || 
            !this._drawablesColorRT.ready || 
            !this._overlayRT.ready || 
            !this._contourRT.ready) {

            this._drawablesDepthRT.destroy();
            this._drawablesColorRT.destroy();
            this._contourRT.destroy();
            this._overlayRT.destroy();

            this._contourBlit.destroy();
            this._overlayBlit.destroy();

            this._material.destroy();

            this._ready = false;
        } else {
            this._material = scene.materialManager.createMaterialAdhoc("contour");

            this.recompileShader(resourceManager, {"section": false});
        
            this._contourBlit.setTexture(this._drawablesColorRT.getColorBuffer());
            this._overlayBlit.setTexture(this._contourRT.getColorBuffer());
            
            this._ready = true;
        }
    };

    Contour.prototype.destroy = function() {
        if (this._ready) {
            this._drawablesColorRT.destroy();
            this._drawablesDepthRT.destroy();
            this._overlayRT.destroy();
            this._contourRT.destroy();

            this._contourBlit.destroy();
            this._overlayBlit.destroy();

            this._material.destroy();
        }
    };

    Contour.prototype.setColor = function(color) {
        this._color[0] = color[0];
        this._color[1] = color[1];
        this._color[2] = color[2];
        this._color[3] = color[3];
    };
    
    Contour.prototype.resize = function(width, height) {
        if (this._ready) {
            this._ready =  false;

            this._drawablesColorRT.resize(width, height);
            this._drawablesDepthRT.resize(width, height);
            this._contourRT.resize(width, height);
            this._overlayRT.resize(width, height);

            this._ready = this._drawablesColorRT.ready &&
                          this._drawablesDepthRT.ready &&
                          this._contourRT.ready &&
                          this._overlayRT.ready;
        }
    };

    Contour.prototype.recompileShader = function(resourceManager, states) {
        var flags = [];   
        if (states.section) {
            flags.push("CLIPPING");
        }
        
        this._shaders[0] = resourceManager.getShader("constant", flags);
        if (!this._shaders[0].ready) {
            this._shaders[0].createFromShaderSource(ShaderLibrary["constant"], flags);
        }
        
        flags.push("MODEL_TRANSFORM");
        this._shaders[1] = resourceManager.getShader("constant", flags);
        if (!this._shaders[1].ready) {
            this._shaders[1].createFromShaderSource(ShaderLibrary["constant"], flags);
        }
        
        flags.push("INSTANCING");
        this._shaders[2] = resourceManager.getShader("constant", flags);
        if (!this._shaders[2].ready) {
            this._shaders[2].createFromShaderSource(ShaderLibrary["constant"], flags);
        }
        
        this._material.attachShader(this._shaders[0]);
        this._material.setDiffuse([1, 0, 0]);
        this._material.setTransparent(1.0);
    };

    Contour.prototype.render = function(renderer, scene, drawables, camera) {
        if (!this._ready) {
            return ;
        }

        // Generate the scene depth
        renderer.clear(this._drawablesDepthRT, gl.DEPTH_BUFFER_BIT);
        
        if (scene.clipping.isEnabled()) {
            renderer.renderState.invalidateClip();    
        }
        renderer.drawDrawables(this._drawablesDepthRT, scene.model.drawables, camera, this._shaders, 
                this._material, scene.clipping, null, null, false);

        // Render the colored drawables
        renderer.clear(this._drawablesColorRT, gl.COLOR_BUFFER_BIT);
        renderer.drawDrawables(this._drawablesColorRT, drawables, camera, this._shaders, 
                this._material, scene.clipping, null, null, false);

        // Extract the contour of the object
        renderer.clear(this._contourRT, gl.COLOR_BUFFER_BIT);
        this._contourBlit.render(renderer, this._contourRT);

        // Overlay contour onto current framebuffer.
        this._overlayBlit.setParameter("uColor", this._color);
        this._overlayBlit.render(renderer, this._overlayRT, true);
    };

    return Contour;
})();



