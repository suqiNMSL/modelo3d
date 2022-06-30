//
// m3d_pick_query.js
// picking
//
//  

import Globals       from "../../m3d_globals.js"
import ShaderLibrary from "../../02resource/m3d_shader_library.js";
import BaseCamera    from "../../03scene/camera/m3d_base_camera.js";
import RenderTarget  from "../../04renderer/m3d_rendertarget.js";

export default (function() {
    "use strict";

    function PickQuery(scene, drawables, resourceManager) {
        // private:
        this._scene        = scene;
        this._material     = null;
        this._shaders      = [null, null, null];
        this._buffer       = new Uint8Array(4);
        this._ready        = false;
        this._renderTarget = null;
        this._phonyCamera  = new BaseCamera();
        this._pickMatrix   = mat4.create();
        this._drawables    = drawables;

        // initialization
        this._material = scene.materialManager.createMaterialAdhoc("pick-query");
        this.recompileShader(resourceManager, {"section": false});

        this._renderTarget = new RenderTarget("query", resourceManager, 
                5, 5, { clearColor: [0, 0, 0, 0] });

        this._ready = this._renderTarget.ready;
    }; 

    PickQuery.prototype.destroy = function() {
        if (this._ready) {
            this._material.destroy();
            this._renderTarget.destroy();
            this._gizmos = null;
        }
    };

    PickQuery.prototype._begin = function(x, y, camera, renderer) {
        // Prepare the query matrix
        y = Globals.height - 1 - y;

        this._pickMatrix[0] = camera.viewport[2] / 5.0;
        this._pickMatrix[5] = camera.viewport[3] / 5.0;
        this._pickMatrix[12] = (camera.viewport[2] - 2.0 * x) / 5.0;
        this._pickMatrix[13] = (camera.viewport[3] - 2.0 * y) / 5.0;

        mat4.multiply(this._phonyCamera.vpMatrix, this._pickMatrix, camera.vpMatrix);

        this._phonyCamera.viewport[0] = camera.viewport[0];
        this._phonyCamera.viewport[1] = camera.viewport[1];
        this._phonyCamera.viewport[2] = 5;
        this._phonyCamera.viewport[3] = 5;
    }; 

    PickQuery.prototype._end = function() {
        // Read the center pixel.
        gl.readPixels(2, 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this._buffer);

        var index = this._buffer[0] + 
                    this._buffer[1] * 256 + 
                    this._buffer[2] * 256 * 256 + 
                    this._buffer[3] * 256 * 256 * 256;

        if (index > 0) {
            index -= 1;

            var retDrawable = this._drawables[index];
            modelo3d.debug("drawable " + retDrawable.name + " is picked.");
            return retDrawable;
        } 

        return null;
    }; 
        
    function ChangeMaterial(index, material) {
        index += 1; // 0 is reserved for not-picked.

        var color = [0, 0, 0];
        color[0] = ((index & 0xff) + 0.49) / 255.0;
        color[1] = (((index >> 8) & 0xff) + 0.49) / 255.0;
        color[2] = (((index >> 16) & 0xff) + 0.49) / 255.0;
        var transparent = (((index >> 24) & 0xff) + 0.49) / 255.0;

        material.setDiffuse(color);
        material.setTransparent(transparent);
    };

    // return the index of picked drawable in the scene.drawables or null if 
    // nothing.
    PickQuery.prototype.pick = function(x, y, renderer, camera) {
        if (!this._ready) {
            return null;
        }

        // The input (x, y) are in the normalized screen space 
        // and need to convert it to window space.
        x = Math.floor(x * Globals.devicePixelRatio);
        y = Math.floor(y * Globals.devicePixelRatio);
        this._begin(x, y, camera, renderer);

        if (this._scene.clipping.isEnabled()) {
            renderer.renderState.invalidateClip();    
        }

        renderer.clear(this._renderTarget, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 
        if (this._drawables === null) {
            this._drawables = this._scene.model.drawables;
        }
        renderer.drawDrawablesCustom(this._renderTarget, this._drawables, this._phonyCamera, this._shaders, this._material, 
                                     this._scene.clipping, this._scene.needRenderDoubleSided() ,ChangeMaterial);
        return this._end();
    }; 

    PickQuery.prototype.recompileShader = function(resourceManager, states) {
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
        this._material.setDiffuse(vec3.fromValues(0, 0, 0));
        this._material.setTransparent(0);
    };

    return PickQuery;
})();
    
