//
// m3d_depth_query.js
// depth query
//
//  

import Globals        from "../../m3d_globals.js";
import ShaderLibrary  from "../../02resource/m3d_shader_library.js";
import BaseCamera     from "../../03scene/camera/m3d_base_camera.js";
import Material       from "../../03scene/materials/m3d_material.js";
import RenderTarget   from "../../04renderer/m3d_rendertarget.js";

export default (function() {
    "use strict";

    function DepthQuery(scene, resourceManager) {
        // prviate:
        this._scene        = scene;
        this._renderTarget = null;
        this._shaders      = [null, null, null];
        this._ready        = false;
        this._phonyCamera  = new BaseCamera();
        this._pickMatrix   = mat4.create();
        this._material     = new Material("depth-query");

        // initialization
        this.recompileShader(resourceManager, {"section": false});

        this._renderTarget = new RenderTarget("query", resourceManager, 
            5, 5, { clearColor: [0, 0, 0, 0] });

        this._ready = this._renderTarget.ready;
    }; 

    DepthQuery.prototype.destroy = function() {
        if (this._ready) {
            this._material.destroy();
            this._material = null;
            delete this._material;

            this._renderTarget.destroy();
            this._renderTarget = null;
            delete this._renderTarget;

            this._pickMatrix = null;
            delete this._pickMatrix;

            this._phonyCamera = null;
            delete this._phonyCamera;
        }
    };

    DepthQuery.prototype._begin = function(x, y, camera, renderer, width, height) {
        // Prepare the query matrix
        y = Globals.height - 1 - y;

        this._pickMatrix[0] = camera.viewport[2] / width;
        this._pickMatrix[5] = camera.viewport[3] / height;
        this._pickMatrix[12] = (camera.viewport[2] - 2.0 * x) / width;
        this._pickMatrix[13] = (camera.viewport[3] - 2.0 * y) / height;

        mat4.multiply(this._phonyCamera.vpMatrix, this._pickMatrix, camera.vpMatrix);

        this._phonyCamera.viewport[0] = camera.viewport[0];
        this._phonyCamera.viewport[1] = camera.viewport[1];
        this._phonyCamera.viewport[2] = width;
        this._phonyCamera.viewport[3] = height;
    }; 

    DepthQuery.prototype._end = function(width, height) {
        if (!width && !height) {
            var buffer = new Uint8Array(5 * 5 * 4);

            gl.readPixels(2, 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buffer);

            if (buffer[0] === 0 &&
                buffer[1] === 0 &&
                buffer[2] === 0 &&
                buffer[3] === 0) {
                return null;
            }

            return buffer[0] / 255.0 * (1.0/(255.0*255.0*255.0)) + 
                   buffer[1] / 255.0 * (1.0/(255.0*255.0)) + 
                   buffer[2] / 255.0 * (1.0/(255.0)) + 
                   buffer[3] / 255.0;
        } else {
            var buffer = new Uint8Array(width * height * 4);
            gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);

            var nearest = Number.POSITIVE_INFINITY;
            var stride = 1;
            var steps = width * height;
            for (var i = 0; i < steps; i += stride) {
                if (buffer[i * 4 + 0] !== 0 ||
                    buffer[i * 4 + 1] !== 0 ||
                    buffer[i * 4 + 2] !== 0 ||
                    buffer[i * 4 + 3] !== 0) {
      
                    var z = buffer[i * 4 + 0] / 255.0 * (1.0/(255.0*255.0*255.0)) + 
                            buffer[i * 4 + 1] / 255.0 * (1.0/(255.0*255.0)) + 
                            buffer[i * 4 + 2] / 255.0 * (1.0/(255.0)) + 
                            buffer[i * 4 + 3] / 255.0;

                    if (z < nearest) {
                        nearest = z;
                    }
                }
            }
      
            if (nearest === Number.POSITIVE_INFINITY) {
                return null;
            } else {
                return nearest;
            }
        }
    }; 

    // Find the world position of the pixel in the framebuffer.
    // It will render the entire scene, so do not use this function
    // frequently.
    DepthQuery.prototype.unproject = function(x, y, renderer, camera) {
        if (!this._ready) {
            return null;
        }

        x = Math.floor(x * Globals.devicePixelRatio);
        y = Math.floor(y * Globals.devicePixelRatio);

        // When the scene is rendered in double-sided mode, we can simply
        // disable the face culling instead of rendering twice.
        this._renderTarget.resize(5, 5);
        this._begin(x, y, camera, renderer, 5, 5);
        renderer.clear(this._renderTarget, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        if (this._scene.clipping.isEnabled()) {
            renderer.renderState.invalidateClip();    
        }
        
        if (this._scene.model) {
            renderer.drawDrawables(this._renderTarget, this._scene.model.drawables, this._phonyCamera,
                    this._shaders, this._material, this._scene.clipping, null, null, 
                    this._scene.needRenderDoubleSided()? false : gl.CCW);
        }
        if (this._scene.terrain) {
            renderer.drawDrawables(this._renderTarget, this._scene.terrain.drawables, this._phonyCamera,
                    this._shaders, this._material, this._scene.clipping, null, null, 
                    this._scene.needRenderDoubleSided()? false : gl.CCW);
        }
        var depth = this._end();
        
        if (depth === null) {
            console.warn("failed to find valid depth value.");
            return null;
        }
        
        return this._getPosition(x, y, depth, camera);
    }; 

    // Find the closest point in terms of z in the region stretched by (sx, sy)
    // and (ex, ey) on screen.
    DepthQuery.prototype.getNearest = function(sx, sy, ex, ey, renderer, camera) {
        if (!this._ready) {
            return null;
        }

        sx = Math.floor(sx * Globals.devicePixelRatio);
        sy = Math.floor(sy * Globals.devicePixelRatio);
        ex = Math.floor(ex * Globals.devicePixelRatio);
        ey = Math.floor(ey * Globals.devicePixelRatio);

        var x = Math.floor((sx + ex) / 2);
        var y = Math.floor((sy + ey) / 2);

        var width  = ex - sx;
        var height = ey - sy;
        
        this._renderTarget.resize(width, height);
        this._begin(x, y, camera, renderer, width, height);
        renderer.clear(this._renderTarget, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        if (this._scene.clipping.isEnabled()) {
            renderer.renderState.invalidateClip();    
        }
        
        if (this._scene.model) {
            renderer.drawDrawables(this._renderTarget, this._scene.model.drawables, this._phonyCamera,
                    this._shaders, this._material, this._scene.clipping, null, null, 
                    this._scene.needRenderDoubleSided()? false : gl.CCW);
        }
        if (this._scene.terrain) {
            renderer.drawDrawables(this._renderTarget, this._scene.terrain.drawables, this._phonyCamera,
                    this._shaders, this._material, this._scene.clipping, null, null, 
                    this._scene.needRenderDoubleSided()? false : gl.CCW);
        }
        var depth = this._end(width, height);
        
        if (depth === null) {
            console.warn("failed to find valid depth value.");
            return null;
        }
        
        return this._getPosition(x, y, depth, camera);
    }; 

    DepthQuery.prototype._getPosition = function(x, y, depth, camera) {
        var w = Globals.width;
        var h = Globals.height;

        var p = vec4.fromValues( 
            2.0 * (x / w - 0.5),
            2.0 * ((h - 1 - y) / h - 0.5),
            2 * depth - 1.0,
            1.0);

        var inversedVPMatrix = mat4.create();
        mat4.invert(inversedVPMatrix, camera.vpMatrix);

        var tmp = vec4.fromValues();
        vec4.transformMat4(tmp, p, inversedVPMatrix);

        if (tmp[3] !== 0.0) {
            p[0] = tmp[0] / tmp[3];
            p[1] = tmp[1] / tmp[3];
            p[2] = tmp[2] / tmp[3];
            p[3] = 1.0;
        } else {
            vec4.copy(p, tmp);
        }

        return p;
    }; 

    DepthQuery.prototype.recompileShader = function(resourceManager, states) {
        var flags = [];
        if (states.section) {
            flags.push("CLIPPING");
        }
        flags.push("DEPTH_ONLY");
        flags.push("ENCODE_DEPTH");
        this._shaders[0] = resourceManager.getShader("depth-query", flags);
        if (!this._shaders[0].ready) {
            this._shaders[0].createFromShaderSource(ShaderLibrary["normaldepth"], flags);
        }
        
        flags.push("MODEL_TRANSFORM");
        this._shaders[1] = resourceManager.getShader("depth-query", flags);
        if (!this._shaders[1].ready) {
            this._shaders[1].createFromShaderSource(ShaderLibrary["normaldepth"], flags);
        }
        
        flags.push("INSTANCING");
        this._shaders[2] = resourceManager.getShader("depth-query", flags);
        if (!this._shaders[2].ready) {
            this._shaders[2].createFromShaderSource(ShaderLibrary["normaldepth"], flags);
        }
        
        this._material.attachShader(this._shaders[0]);
    };

    return DepthQuery;
})();
    
