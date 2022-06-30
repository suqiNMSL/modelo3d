//
// m3d_vr.js
// The VR
//
//  
//

import Globals       from "../m3d_globals.js";
import ShaderLibrary from "../02resource/m3d_shader_library.js";
import RenderTarget  from "./m3d_rendertarget.js";
import Blit          from "./m3d_blit.js";
import OffsetCamera  from "../03scene/camera/m3d_offset_camera.js";
import Material      from "../03scene/materials/m3d_material.js";


export default (function() {
    "use strict";
    
    function VR(resourceManager, scene) {
        // public:
        this.enabled = false;
        
        // private:
        this._scene               = scene;
        this._ready               = false;
        this._resourceManager     = resourceManager;
        this._warpMaterial        = null;
        this._screenRenderTarget  = null;
        this._resolveRenderTarget = null;
        this._renderTargets       = [];
        this._hmdWarpParam        = [];
        this._warpScaleParam      = [];
        this._needWarp            = false;
        this._cameras             = [];
        this._convergence         = -0.15; // Tweaked for iPhone 6(s) (both warp and nowarp mode). Adjusted when two eyes can be converged.
        this._separation          = 55.0; // The distance of IPD. unit is mm.
        this._blit                = new Blit(resourceManager, ShaderLibrary["vr_wrap"]);
        // initialization:
        var w = Globals.width;
        var h = Globals.height;
        
        this._cameras[0] = new OffsetCamera(scene);
        this._cameras[1] = new OffsetCamera(scene);
        this._cameras[0].setCullingEnabled(true);
        this._cameras[1].setCullingEnabled(true);
        this._cameras[0].setViewport(new Int32Array([0, 0, w / 2, h]));
        this._cameras[1].setViewport(new Int32Array([w / 2, 0, w / 2, h]));

        this._ready = true;
    };
    
    VR.prototype.destroy = function() {
        if (this._ready && this._screenRenderTarget) {
            this._screenRenderTarget.destroy();
            this._renderTargets[0].destroy();
            this._renderTargets[1].destroy();
            this._renderTargets[2].destroy();
            this._renderTargets[3].destroy();
            this._warpMaterial.destroy();
        }
    };

    VR.prototype.setEnabled = function(enabled) {
        this.enabled = enabled;
    };
    
    // input is the width and height of the left/right backbuffer
    VR.prototype.resize = function(width, height) {
        if (this._ready) {
            
            var w = width;
            var h = height;
            
            if (this._renderTargets[0]) {
                this._renderTargets[0].resize(w, h);
                this._renderTargets[1].resize(w, h);
                this._renderTargets[2].resize(w, h);
                this._renderTargets[3].resize(w, h);

                this._ready = this._renderTargets[0].ready &&
                              this._renderTargets[1].ready &&
                              this._renderTargets[2].ready &&
                              this._renderTargets[3].ready;
            
                this.resetWarpParam();
            } 

            this._cameras[0].setViewport(new Int32Array([0, 0, w / 2, h]));
            this._cameras[1].setViewport(new Int32Array([w / 2, 0, w / 2, h]));
        }
    };
    
    VR.prototype.draw = function(sceneCamera, renderScene, renderer) {
        if (!this._ready) {
            console.error("VR is not ready.");
            return;
        }
        
        // Render the scene.
        this._cameras[0].update(sceneCamera, -this._convergence, -this._separation * 0.5);
        this._cameras[1].update(sceneCamera,  this._convergence,  this._separation * 0.5);

        if (this._needWarp) {
            renderScene.draw(this._cameras[0], this._cameras[1], this._renderTargets);
            
            // Warp.
            this._blit.setParameter("uLeftCenterOffset", this._cameras[0]._centerOffset);
            this._blit.setParameter("uRightCenterOffset", this._cameras[1]._centerOffset);
            renderer.renderState.viewport([0, 0, Globals.width, Globals.height]);
            this._blit.render(renderer, this._screenRenderTarget);
        } else {
            renderScene.draw(this._cameras[0], this._cameras[1]);
        }
    };
    
    VR.prototype.resetWarpParam = function() {
        // lens distortion parameter, see wiki page for explanation: https://en.wikipedia.org/wiki/Distortion_(optics)#Software_correction
        // also see Google's manual in adjusting those #s https://support.google.com/cardboard/manufacturers/answer/6324808?hl=en
        this._hmdWarpParam = [1.0, 0.18, 0.20]; // [1.0, 0.22, 0.24] for Oculus HMD
        var scale = this._hmdWarpParam[0] + this._hmdWarpParam[1] + this._hmdWarpParam[2];
        var aspect = Globals.width / 2 / Globals.height;
        this._warpScaleParam = [2.0 * aspect, 2.0, 0.5 / aspect / scale, 0.5 / scale];
        
        this._blit.setParameter("uHmdWarpParam", this._hmdWarpParam);
        this._blit.setParameter("uWarpScaleParam", this._warpScaleParam);
            
    };

    // Control the distance between two iris. Tweak the value
    // for different screens.
    VR.prototype.setConvergence = function(value) {
        this._convergence = value;
    };
    
    // Control the depth perception. Large value will render
    // strong depth perception.
    VR.prototype.setSeparation = function(value) {
        this._separation = value;
    };
    
    VR.prototype.setCalibrationEnabled = function(enabled) {
        if (enabled) {
            this._blit.setParameter("uCalibration", true);
        } else {
            this._blit.setParameter("uCalibration", false);
        }
    };

    VR.prototype.setWarpEnabled = function(enabled) {
        this._needWarp = enabled;
        
        if (!this._screenRenderTarget) {
            this._ready = false;

            this._screenRenderTarget = new RenderTarget("default", this._resourceManager, 
                    Globals.width, Globals.height, { depthTest: false });
            
            this._renderTargets.push(new RenderTarget("vr-0", this._resourceManager,
                    Globals.width, Globals.height, {
                        colorFormat: gl.RGBA, 
                        depthFormat: gl.DEPTH_STENCIL,
                        blend: false
                    }));
            this._renderTargets.push(new RenderTarget("vr-0", this._resourceManager,
                    Globals.width, Globals.height, { blend: true }));
            this._renderTargets.push(new RenderTarget("vr-0", this._resourceManager,
                    Globals.width, Globals.height, { blend: true, depthMask: false }));
            this._renderTargets.push(new RenderTarget("vr-0", this._resourceManager,
                    Globals.width, Globals.height, { depthFunc: gl.LEQUAL }));
            
            this._ready = this._renderTargets[0].ready &&
                          this._renderTargets[1].ready &&
                          this._renderTargets[2].ready &&
                          this._renderTargets[3].ready;
        
            this._warpMaterial = new Material("vr-wrap");

            this._recompileShader(this._resourceManager, []);
            if (!this._ready) {
                return;
            }
            this.resetWarpParam();
            this._blit.setTexture(this._renderTargets[0].getColorBuffer());
        }
    };
    
    return VR;
})();
    
