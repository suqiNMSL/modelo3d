//
// m3d_measure.js
// The measure gizmo
//
//  


import Globals       from "../../m3d_globals.js";
import MyMath        from "../../00utility/m3d_math.js";
import ShaderLibrary from "../../02resource/m3d_shader_library.js";
import Gizmo2D       from "../../03scene/drawables/m3d_gizmo2d.js";
import SceneCamera   from "../../03scene/camera/m3d_scene_camera.js";
import Material      from "../../03scene/materials/m3d_material.js";
import RenderTarget  from "../../04renderer/m3d_rendertarget.js";
import RenderPass    from "../../04renderer/m3d_renderpass.js";
import DepthQuery    from "./m3d_depth_query.js";

export default (function() {
    "use strict";
    
    // spiral index order
    var SPIRAL = [[  1,  0], [  1,  1], [  0,  1], [ -1,  1], [ -1,  0], [ -1, -1], [  0, -1], [  1, -1], [  2, -1], [  2,  0],
                  [  2,  1], [  2,  2], [  1,  2], [  0,  2], [ -1,  2], [ -2,  2], [ -2,  1], [ -2,  0], [ -2, -1], [ -2, -2], 
                  [ -1, -2], [  0, -2], [  1, -2], [  2, -2], [  3, -2], [  3, -1], [  3,  0], [  3,  1], [  3,  2], [  3,  3],
                  [  2,  3], [  1,  3], [  0,  3], [ -1,  3], [ -2,  3], [ -3,  3], [ -3,  2], [ -3,  1], [ -3,  0], [ -3, -1],
                  [ -3, -2], [ -3, -3], [ -2, -3], [ -1, -3], [  0, -3], [  1, -3], [  2, -3], [  3, -3], [  4, -3], [  4, -2],
                  [  4, -1], [  4,  0], [  4,  1], [  4,  2], [  4,  3], [  4,  4], [  3,  4], [  2,  4], [  1,  4], [  0,  4],
                  [ -1,  4], [ -2,  4], [ -3,  4], [ -4,  4], [ -4,  3], [ -4,  2], [ -4,  1], [ -4,  0], [ -4, -1], [ -4, -2],
                  [ -4, -3], [ -4, -4], [ -3, -4], [ -2, -4], [ -1, -4], [  0, -4], [  1, -4], [  2, -4], [  3, -4], [  4, -4],
                  [  5, -4], [  5, -3], [  5, -2], [  5, -1], [  5,  0], [  5,  1], [  5,  2], [  5,  3], [  5,  4], [  5,  5],
                  [  4,  5], [  3,  5], [  2,  5], [  1,  5], [  0,  5], [ -1,  5], [ -2,  5], [ -3,  5], [ -4,  5], [ -5,  5],
                  [ -5,  4], [ -5,  3], [ -5,  2], [ -5,  1], [ -5,  0], [ -5, -1], [ -5, -2], [ -5, -3], [ -5, -4], [ -5, -5], 
                  [ -4, -5], [ -3, -5], [ -2, -5], [ -1, -5], [  0, -5], [  1, -5], [  2, -5], [  3, -5], [  4, -5], [  5, -5], 
                  [  6, -5], [  6, -4], [  6, -3], [  6, -2], [  6, -1], [  6,  0], [  6,  1], [  6,  2], [  6,  3], [  6,  4],
                  [  6,  5], [  6,  6], [  5,  6], [  4,  6], [  3,  6], [  2,  6], [  1,  6], [  0,  6], [ -1,  6], [ -2,  6], 
                  [ -3,  6], [ -4,  6], [ -5,  6], [ -6,  6], [ -6,  5], [ -6,  4], [ -6,  3], [ -6,  2], [ -6,  1], [ -6,  0], 
                  [ -6, -1], [ -6, -2], [ -6, -3], [ -6, -4], [ -6, -5], [ -6, -6], [ -5, -6], [ -4, -6], [ -3, -6], [ -2, -6], 
                  [ -1, -6], [  0, -6], [  1, -6], [  2, -6], [  3, -6], [  4, -6], [  5, -6], [  6, -6], [  7, -6], [  7, -5], 
                  [  7, -4], [  7, -3], [  7, -2], [  7, -1], [  7,  0], [  7,  1], [  7,  2], [  7,  3], [  7,  4], [  7,  5], 
                  [  7,  6], [  7,  7], [  6,  7], [  5,  7], [  4,  7], [  3,  7], [  2,  7], [  1,  7], [  0,  7], [ -1,  7], 
                  [ -2,  7], [ -3,  7], [ -4,  7], [ -5, 7],  [ -6,  7], [ -7,  7], [ -7,  6], [ -7,  5], [ -7,  4], [ -7,  3], 
                  [ -7,  2], [ -7,  1], [ -7,  0], [ -7, -1], [ -7, -2], [ -7, -3], [ -7, -4], [ -7, -5], [ -7, -6], [ -7, -7], 
                  [ -6, -7], [ -5, -7], [ -4, -7], [ -3, -7], [ -2, -7], [ -1, -7], [  0, -7], [  1, -7], [  2, -7], [  3, -7], 
                  [  4, -7], [  5, -7], [  6, -7], [  7, -7], [  8, -7], [  8, -6], [  8, -5], [  8, -4], [  8, -3], [  8, -2], 
                  [  8, -1], [  8,  0], [  8,  1], [  8,  2], [  8,  3], [  8,  4], [  8,  5], [  8,  6], [  8,  7], [  8,  8], 
                  [  7, 8],  [  6,  8], [  5,  8], [  4,  8], [  3,  8], [  2,  8], [  1,  8], [  0,  8], [ -1,  8], [ -2,  8], 
                  [ -3,  8], [ -4,  8], [ -5,  8], [ -6,  8], [ -7,  8], [ -8,  8], [ -8,  7], [ -8,  6], [ -8, 5],  [ -8,  4], 
                  [ -8,  3], [ -8,  2], [ -8,  1], [ -8,  0], [ -8, -1], [ -8, -2], [ -8, -3], [ -8, -4], [ -8, -5], [ -8, -6], 
                  [ -8, -7], [ -8, -8], [ -7, -8], [ -6, -8], [ -5, -8], [ -4, -8], [ -3, -8], [ -2, -8], [ -1, -8], [  0, -8], 
                  [  1, -8], [  2, -8], [  3, -8], [  4, -8], [  5, -8], [  6, -8], [  7, -8], [  8, -8], [  9, -8], [  9, -7],
                  [  9, -6], [  9, -5], [  9, -4], [  9, -3], [  9, -2], [  9, -1], [  9,  0], [  9,  1], [  9,  2], [  9,  3], 
                  [  9,  4], [  9,  5], [  9,  6], [  9,  7], [  9,  8], [  9,  9], [  8,  9], [  7,  9], [  6,  9], [  5,  9], 
                  [  4,  9], [  3,  9], [  2,  9], [  1,  9], [  0,  9], [ -1,  9], [ -2,  9], [ -3,  9], [ -4,  9], [ -5,  9], 
                  [ -6,  9], [ -7,  9], [ -8,  9], [ -9,  9], [ -9,  8], [ -9,  7], [ -9,  6], [ -9,  5], [ -9,  4], [ -9,  3], 
                  [ -9,  2], [ -9,  1], [ -9,  0], [ -9, -1], [ -9, -2], [ -9, -3], [ -9, -4], [ -9, -5], [ -9, -6], [ -9, -7], 
                  [ -9, -8], [ -9, -9], [ -8, -9], [ -7, -9], [ -6, -9], [ -5, -9], [ -4, -9], [ -3, -9], [ -2, -9], [ -1, -9], 
                  [  0, -9], [  1, -9], [  2, -9], [  3, -9], [  4, -9], [  5, -9], [  6, -9], [  7, -9], [  8, -9], [  9, -9], 
                  [ 10, -9], [ 10, -8], [ 10, -7], [ 10, -6], [ 10, -5], [ 10, -4], [ 10, -3], [ 10, -2], [ 10, -1], [ 10,  0], 
                  [ 10,  1], [ 10,  2], [ 10,  3], [ 10,  4], [ 10,  5], [ 10,  6], [ 10,  7], [ 10,  8], [ 10,  9], [ 10, 10], 
                  [  9, 10], [  8, 10], [  7, 10], [  6, 10], [  5, 10], [  4, 10], [  3, 10], [  2, 10], [  1, 10], [  0, 10], 
                  [ -1, 10], [ -2, 10], [ -3, 10], [ -4, 10], [ -5, 10], [ -6, 10], [ -7, 10], [ -8, 10], [ -9, 10], [-10, 10], 
                  [-10,  9], [-10,  8], [-10,  7], [-10,  6], [-10,  5], [-10,  4], [-10,  3], [-10,  2], [-10,  1], [-10,  0], 
                  [-10, -1], [-10, -2], [-10, -3], [-10, -4], [-10, -5], [-10, -6], [-10, -7], [-10, -8], [-10, -9], [-10,-10], 
                  [ -9,-10], [ -8,-10], [ -7,-10], [ -6,-10], [ -5,-10], [ -4,-10], [ -3,-10], [ -2,-10], [ -1,-10], [  0,-10], 
                  [  1,-10], [  2,-10], [  3,-10], [  4,-10], [  5,-10], [  6,-10], [  7,-10], [  8,-10], [  9,-10], [ 10,-10], 
                  [ 11,-10], [ 11, -9], [ 11, -8], [ 11, -7], [ 11, -6], [ 11, -5], [ 11, -4], [ 11, -3], [ 11, -2], [ 11, -1], 
                  [ 11,  0], [ 11,  1], [ 11,  2], [ 11,  3], [ 11,  4], [ 11,  5], [ 11,  6], [ 11,  7], [ 11,  8], [ 11,  9], 
                  [ 11, 10], [ 11, 11], [ 10, 11], [  9, 11], [  8, 11], [  7, 11], [  6, 11], [  5, 11], [  4, 11], [  3, 11], 
                  [  2, 11], [  1, 11], [  0, 11], [ -1, 11], [ -2, 11], [ -3, 11], [ -4, 11], [ -5, 11], [ -6, 11], [ -7, 11], 
                  [ -8, 11], [ -9, 11], [-10, 11], [-11, 11], [-11, 10], [-11,  9], [-11,  8], [-11,  7], [-11,  6], [-11,  5], 
                  [-11,  4], [-11,  3], [-11,  2], [-11,  1], [-11,  0], [-11, -1], [-11, -2], [-11, -3], [-11, -4], [-11, -5], 
                  [-11, -6], [-11, -7], [-11, -8], [-11, -9], [-11,-10], [-11,-11], [-10,-11], [ -9,-11], [ -8,-11], [ -7,-11], 
                  [ -6,-11], [ -5,-11], [ -4,-11], [ -3,-11], [ -2,-11], [ -1,-11], [  0,-11], [  1,-11], [  2,-11], [  3,-11], 
                  [  4,-11], [  5,-11], [  6,-11], [  7,-11], [  8,-11], [  9,-11], [ 10,-11], [ 11,-11]];
    
    function _SnapObject(scene, width, height, resourceManager, name) {
        this._name            = name;
        this.width            = Math.floor(width || Globals.width);
        this.height           = Math.floor(height || Globals.height);
        this.normalBuffer     = new Uint8Array(this.width * this.height * 4);
        this.depthBuffer      = new Uint8Array(this.width * this.height * 4);
        this.devicePixelRatio = this.width === Globals.width ? Globals.devicePixelRatio : 1;
        this._normalPass      = new RenderPass(scene, false, true, {line : false});
        this._depthPass       = new RenderPass(scene, false, true, {line : false});

        var config = { 
            depthTest: true, 
            colorFormat: gl.RGBA,
            colorFilter: gl.NEAREST,
            colorBuffer: 1,
            depthBuffer: 0,
            clearColor: [0, 0, 0, 0]
        };
                     
        this.rtNormal = new RenderTarget(name + "_normal", resourceManager,
            this.width, this.height, config);

        var shader0 = resourceManager.getShader("normaldepth", ["WORLDSPACE_NORMAL", "ENCODE_NORMAL"]);
        if (!shader0.ready) {
            var shaderSource = ShaderLibrary["normaldepth"];
            shader0.createFromShaderSource(shaderSource, ["WORLDSPACE_NORMAL", "ENCODE_NORMAL"]);
        }  

        this.inversedVPMatrix = mat4.create();
        
        config.colorBuffer = 0;   
        this.rtDepth = new RenderTarget(name + "_depth", resourceManager,
            this.width, this.height, config);
        var shader1 = resourceManager.getShader("normaldepth", ["DEPTH_ONLY", "ENCODE_DEPTH"]);
        if (!shader1.ready) {
            var shaderSource = ShaderLibrary["normaldepth"];
            shader1.createFromShaderSource(shaderSource, ["DEPTH_ONLY", "ENCODE_DEPTH"]);
        }
        
        this._normalPass.setOverridedShader(shader0);
        this._depthPass.setOverridedShader(shader1);
        this._normalPass.setOverridedMaterial(new Material("ruler-position-normal"));
        this._depthPass.setOverridedMaterial(new Material("ruler-position-depth"));
        
        if (!this._normalPass.queue.isValid()) {
            if (scene.model) {
                var m = scene.model.drawables;
                for (var i = 0, len = m.length; i < len; i++) {
                    this._normalPass.queue.addDrawable(m[i]);
                    this._depthPass.queue.addDrawable(m[i]);
                }
            }
            if (scene.terrain) {
                var t = scene.terrain.drawables;
                for (var i = 0, len = t.length; i < len; i++) {
                    this._normalPass.queue.addDrawable(t[i]);
                    this._depthPass.queue.addDrawable(t[i]);
                }
            }
        }
    };

    _SnapObject.prototype.resize = function(width, height) {
        this.width  = Math.floor(width);
        this.height = Math.floor(height);
        
        this.rtNormal.resize(this.width, this.height);
        this.normalBuffer = new Uint8Array(this.width * this.height * 4);
        
        this.depthBuffer = new Uint8Array(this.width * this.height * 4);
        this.rtDepth.resize(this.width, this.height);
    };
    
    _SnapObject.prototype.unproject = function(x, y, worldPosition, isFlip) {
        if (isFlip) {
            x = Math.floor(x - 1);
            y = Math.floor(this.height - 1 - y);
        } else {
            x = Math.floor(x * this.devicePixelRatio);
            y = Math.floor(y * this.devicePixelRatio);
        }
        
        var offset = 4 * (x + (this.height - 1 - y) * this.width);
        
        var depthPixel = [this.depthBuffer[offset],
                          this.depthBuffer[offset + 1],
                          this.depthBuffer[offset + 2],
                          this.depthBuffer[offset + 3]];
        var depth;
        if (depthPixel[0] === 0 &&
            depthPixel[1] === 0 &&
            depthPixel[2] === 0 &&
            depthPixel[3] === 0) {
            return false;
        } else {
            depth = depthPixel[0] / 255.0 * (1.0/(255.0*255.0*255.0)) +
                    depthPixel[1] / 255.0 * (1.0/(255.0*255.0)) +
                    depthPixel[2] / 255.0 * (1.0/(255.0)) +
                    depthPixel[3] / 255.0;
        }

        vec3.set(worldPosition, 2.0 * (x / this.width - 0.5),
                                2.0 * ((this.height - 1 - y) / this.height - 0.5),
                                2 * depth - 1.0);
        vec3.transformMat4(worldPosition, worldPosition, this.inversedVPMatrix);
        
        return true;
    };

    var memBlock = {
        normal0: vec3.create(),
        normal1: vec3.create(),
        normal2: vec3.create(),
        diff   : vec3.create(),
        pos0   : vec3.create(),
        pos1   : vec3.create()
    };

    _SnapObject.prototype._fetchNormal = function (i, j, normal) {
        var index = 4 * (i + j * this.width);
        normal[0] = this.normalBuffer[index];
        normal[1] = this.normalBuffer[index + 1];
        normal[2] = this.normalBuffer[index + 2];
        if (!(normal[0] === 0 && normal[1] === 0 && normal[2] === 0)) {
            normal[0] -= 128;
            normal[1] -= 128;
            normal[2] -= 128;
            vec3.normalize(normal, normal);
            return true;
        }
        return false;
    };

    _SnapObject.prototype._isPlaneDifferent = function(i, j) {
        
        this._fetchNormal(i - 1, j, memBlock.normal0);
        this.unproject(i - 1, j, memBlock.pos0, true);
        
        this._fetchNormal(i + 1, j, memBlock.normal1);
        this.unproject(i + 1, j, memBlock.pos1, true);
        
        vec3.subtract(memBlock.diff, memBlock.pos0, memBlock.pos1);
        vec3.normalize(memBlock.diff, memBlock.diff); 
                
        var planeDist0 = Math.max(Math.abs(vec3.dot(memBlock.diff, memBlock.normal0)), Math.abs(vec3.dot(memBlock.diff, memBlock.normal1)));

        this._fetchNormal(i, j-1, memBlock.normal0);
        this.unproject(i, j-1, memBlock.pos0, true);
        
        this._fetchNormal(i, j+1, memBlock.normal1);
        this.unproject(i, j+1, memBlock.pos1, true);
        
        vec3.subtract(memBlock.diff, memBlock.pos0, memBlock.pos1);
        vec3.normalize(memBlock.diff, memBlock.diff);
        var planeDist1 = Math.max(Math.abs(vec3.dot(memBlock.diff, memBlock.normal0)), Math.abs(vec3.dot(memBlock.diff, memBlock.normal1)));

        return Math.sqrt(planeDist0 * planeDist0 + planeDist1 * planeDist1) > 0.5; 
    };
    
    _SnapObject.prototype.adjustPosition = function(coord, radius) {
        // Convert to GL window coordinate.
        var origin_X = coord[0];
        var origin_Y = coord[1];
        var xCenter = Math.floor(coord[0] * this.devicePixelRatio);
        var yCenter = Math.floor(this.height - 1 - coord[1] * this.devicePixelRatio);

        coord[0] = xCenter;
        coord[1] = yCenter;
        // if current pos is invalid, no need to continue
        if (this._fetchNormal(xCenter, yCenter, memBlock.normal0)) {
            
            for (var idx = 0; idx < radius * radius - 1; idx++) {
                // Get it's surrounding normal diff and depth diff
                var i = xCenter + SPIRAL[idx][0];
                var j = yCenter + SPIRAL[idx][1];
                
                // If out of canvas, skip it
                if ((i < 1 || i > this.width - 1) || (j < 1 || j > this.height - 1)) {
                    continue;
                }
                
                // If not on the same plane, return
                if (this._isPlaneDifferent(i, j)) {
                    coord[0] = Math.floor(i / this.devicePixelRatio);
                    coord[1] = Math.floor((this.height - 1 - j) / this.devicePixelRatio);
                    return true;
                }

                var offsetX = 0;
                var offsetY = 0;
                var weight  = 0;
                
                this._fetchNormal(i, j, memBlock.normal0);
                
                for (var s = 0; s < 8; ++s) {
                    var m = SPIRAL[s][0];
                    var n = SPIRAL[s][1];
                    
                    if (!this._fetchNormal(i+m, j+n, memBlock.normal1)) {
                        coord[0] = Math.floor(i / this.devicePixelRatio);
                        coord[1] = Math.floor((this.height - 1 - j) / this.devicePixelRatio);
                        return true;
                    }

                    var cos = vec3.dot(memBlock.normal0, memBlock.normal1);
                    var w = Math.sqrt(Math.max(1 - cos * cos, 0));
                    weight  += w;
                    offsetX += w * m;
                    offsetY += w * n;
                }
                
                if ((weight / 8) >  0.1) {
                    coord[0] = i + offsetX / weight;
                    coord[1] = j + offsetY / weight;
                    break;
                }
            }
        }
        
        coord[0] = Math.floor(coord[0] / this.devicePixelRatio);
        coord[1] = Math.floor((this.height - 1 - coord[1]) / this.devicePixelRatio);
        return !(Math.abs(coord[0] - origin_X) < 2 && Math.abs(coord[1] - origin_Y) < 2);
    };

    _SnapObject.prototype.update = function(renderer, scene, camera) {
        // Generate normal buffer
        renderer.invalidate();
        renderer.clear(this.rtNormal, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        this._normalPass.render(this.rtNormal, renderer, null, camera);
        gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, this.normalBuffer);
        
        // Generate depth buffer
        renderer.invalidate();
        renderer.clear(this.rtDepth, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        this._depthPass.render(this.rtDepth, renderer, null, camera);
        gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, this.depthBuffer);

        mat4.invert(this.inversedVPMatrix, camera.vpMatrix);
    };
    
    _SnapObject.prototype.destroy = function() {
        this._normalPass.destroy();
        this._depthPass.destroy();
    };
    
    _SnapObject.prototype.recompileShader = function(resourceManager, states) {
        var flags = [];
        if (states.section) {
            flags.push("CLIPPING");
        }
        if (states.doubleSided) {
            flags.push("DOUBLESIDED");
        }
        if (states.sceneCompressed) {
            flags.push("COMPRESSION");
        }
        
        flags.push("WORLDSPACE_NORMAL");
        flags.push("MODEL_TRANSFORM");
        flags.push("ENCODE_NORMAL");
        this._normalPass.recompileOverridedShader(resourceManager, flags);

        flags.push("ENCODE_DEPTH");
        flags.push("DEPTH_ONLY");
        this._depthPass.recompileOverridedShader(resourceManager, flags);
    };
    
    var FINE_SIZE = 17;
    
    function _PreciseObject(scene, resourceManager, name) {
        this._name          = name;
        this._linePass      = new RenderPass(scene, false, true, {line : true});
        this._notLinePass  = new RenderPass(scene, false, true, {line : false});
        this._rtLine        = null;
        this._rtNotLine    = null;
        
        this.index          = -1;
        this.lineBuffer     = new Uint8Array(Globals.width * Globals.height * 4);
        this.vertexBuffers  = new Float32Array(6);
        this.vertexSize     = [];

        var shader0 = resourceManager.getShader("mark");
        if (!shader0.ready) {
            var shaderSource = ShaderLibrary["mark"];
            shader0.createFromShaderSource(shaderSource);
        }
        this._linePass.setOverridedShader(shader0);
        this._linePass.setOverridedMaterial(new Material("line-test"));
        this._linePass.setLineMap(true);
        
        this._notLinePass.setCullFace(gl.CW);

        this._rtLine = new RenderTarget("rtline", resourceManager, Globals.width, Globals.height, {
                    depthTest: true, 
                    colorFormat: gl.RGBA,
                    colorFilter: gl.NEAREST,
                    depthBuffer: 0,
                    colorBuffer: 0,
                    clearColor: [1, 1, 1, 1]
                });

        this._rtNotLine = new RenderTarget("_rtNotLine", resourceManager, Globals.width, Globals.height, {
                    depthTest: true, 
                    colorFormat: gl.RGBA,
                    colorFilter: gl.NEAREST,
                    depthBuffer: 0,
                    colorBuffer: 0,
                    colorMask: [0, 0, 0, 0],
                    clearColor: [1, 1, 1, 1]
                });
        if (!this._linePass.queue.isValid()) {
            var m = scene.model.drawables;
            for (var i = 0, len = m.length; i < len; i++) {
                this._linePass.queue.addDrawable(m[i]);
            }
        }
        if (!this._notLinePass.queue.isValid()) {
            var m = scene.model.drawables;
            for (var i = 0, len = m.length; i < len; i++) {
                this._notLinePass.queue.addDrawable(m[i]);
            }
        }
        
        m = this._linePass.queue.drawables;
        for (var i = 0, len = m.length; i < len; i++) {
            this.vertexSize.push((m[i].mesh.bytes - m[i].mesh.length * m[i].mesh.indexSize) / 4);
        }
    };
    
    _PreciseObject.prototype.destroy = function() {
        this.lineBuffer = null;
        this.vertexBuffers = null;
        this.vertexSize    = null;
        this._rtLine.destroy();
        this._rtNotLine.destroy();
        this._linePass.destroy();
        this._notLinePass.destroy();
    };
    
    _PreciseObject.prototype.resize = function(width, height) {
        this._rtLine.resize(width, height);
        this._rtLine.resize(width, height);
        this.lineBuffer = new Uint8Array(Globals.width * Globals.height * 4);
    };
    
    _PreciseObject.prototype.update = function(renderer, scene, camera) {
        renderer.invalidate();
        renderer.clear(this._rtLine, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        this._notLinePass.render(this._rtNotLine, renderer, null, camera);
        this._linePass.render(this._rtLine, renderer, null, camera);
        gl.readPixels(0, 0, Globals.width, Globals.height, gl.RGBA, gl.UNSIGNED_BYTE, this.lineBuffer);
    };
    
    _PreciseObject.prototype.adjustPosition = function(coord, radius) {
        // Convert to GL window coordinate.
        var origin_X = coord[0];
        var origin_Y = coord[1];
        var xCenter = Math.floor(coord[0] * Globals.devicePixelRatio);
        var yCenter = Math.floor(Globals.height - 1 - coord[1] * Globals.devicePixelRatio);

        coord[0] = xCenter;
        coord[1] = yCenter;
        this.index = -1;
        for (var idx = 0; idx < radius * radius - 1; idx++) {
            // Get the vertex sourding id index and check if it's line
            var i = xCenter + SPIRAL[idx][0];
            var j = yCenter + SPIRAL[idx][1];
            
            // If out of canvas, skip it
            if ((i < 1 || i > Globals.width - 1) || (j < 1 || j > Globals.height - 1)) {
                continue;
            }
            var index = 4 * (i + j * Globals.width);
            var a = this.lineBuffer[index + 0];
            var b = this.lineBuffer[index + 1];
            var c = this.lineBuffer[index + 2];
            var d = this.lineBuffer[index + 3];
            var e = new Uint32Array(1);
            e[0]= (d & 0xFF)<<24;
            e[0]=e[0] | ((c & 0xFF) <<16);
            e[0]=e[0] | ((b & 0xFF) <<8);
            e[0]=e[0] | (a & 0xFF);
            if (e[0] != 4294967295) {
                this.index = e[0];
                this.index = this.index - this.index%2;
                coord[0] = i;
                coord[1] = j;
                break;
            }
        }
        
        coord[0] = Math.floor(coord[0] / Globals.devicePixelRatio);
        coord[1] = Math.floor((Globals.height - 1 - coord[1]) / Globals.devicePixelRatio);
        return !(this.index === -1);
    };
    
    _PreciseObject.prototype._fetchEdge = function () {
        var base = 0;
        for (var i = 0; i < this.vertexSize.length; i++) {
            if (this.index >= base && this.index < (base + this.vertexSize[i])) {
                var m = this._linePass.queue.drawables[i];
                m.mesh.getVBSubData((this.index - base) * 12 , this.vertexBuffers);
        
                return [vec3.fromValues(this.vertexBuffers[0], this.vertexBuffers[1], this.vertexBuffers[2]), 
                        vec3.fromValues(this.vertexBuffers[3], this.vertexBuffers[4], this.vertexBuffers[5])];
            }
            base += this.vertexSize[i];
        }
    };
    
    function Measure(scene, resourceManager, eventEmitter) {
        // public:
        this.enabled  = false;

        // private:
        if (Globals.isMobile) {
            console.warn("Measure is not supported on iOS.");
            return;
        }
        
        this._scene            = scene;
        this._current          = 0;
        this._vertices         = [];
        this._lines            = [];
        this._snapCoord        = [0, 0]; // in Window coordinate (origin is left top with device pixel ratio)
        this._indices          = new Uint8Array(2);
        this._indicesDash      = new Uint8Array(40);
        this._resourceManager  = resourceManager;
        this._depthQuery       = new DepthQuery(scene, resourceManager);
        this._bufferDirty      = true;
        this._bufferDirtyTime  = 0;
        this._eventEmitter     = eventEmitter;
        this._rt0 = new RenderTarget("default", resourceManager, Globals.width, Globals.height, { depthTest: false });
        
        this._lineSnapping     = false;
        this._normalSnapping   = true; // Turn on snapping by default 
        
        this._snap1           = null; //in normal snap mode, it's snap step 1, in line snap mode, it's the only one
        this._snap2           = null;
        this._closeCamera     = null;
    }; 

    Measure.prototype.destroy = function() {
        if (Globals.isMobile) {
            return;
        }
        if (this._snap1) {
            this._snap1.destroy();
        }
        if (this._snap2) {
            this._snap2.destroy();
        }
        
        this._rt0.destroy();
        
        for (var i = 0; i < this._lines.length; i++) {
            this._lines[i].destroy();
        }
        this._depthQuery.destroy();
        this._vertices = null;
        this._indices  = null;
        this._snap1   = null;
        this._snap2     = null;
        this._indicesDash = null;
    };
    
    Measure.prototype.setEnabled = function(enabled) {
        if (gl.isWebGL2 && this._scene.hasProflileLines) {
            this._lineSnapping = true;
            if (this.enabled && this._snap1 == null) {
                this._snap1 = new _PreciseObject(this._scene, this._resourceManager, "rt_precise");
            }
        } else {
            if (this.enabled && this._snap1 == null) {
                this._snap1                        = new _SnapObject(this._scene, null, null, this._resourceManager, "rt_coarse");
                this._snap2                        = new _SnapObject(this._scene, FINE_SIZE, FINE_SIZE, this._resourceManager, "rt_fine");
                this._closeCamera                  = new SceneCamera(this._scene);
                this._closeCamera._perspective     = false;
                this._closeCamera.resize           = function() {};
                this._closeCamera.update           = function() {};
                this._closeCamera.viewport         = [0, 0, FINE_SIZE, FINE_SIZE];
            }
        }
    };

    Measure.prototype.resize = function(width, height) {
        if (Globals.isMobile) {
            return;
        }
        
        this._rt0.resize(width, height);
        if (this._snap1) {
            this._snap1.resize(width, height);
        }
    };
    
    Measure.prototype.recompileShader = function(resourceManager, states) {
        if (Globals.isMobile) {
            return;
        }

        this._depthQuery.recompileShader(resourceManager, states);

        if (this._snap1 && this._snap1.recompileShader) {
            this._snap1.recompileShader(resourceManager, states);   
        }
        if (this._snap2) {
            this._snap2.recompileShader(resourceManager, states);   
        }
    };
    
    //Leave this API just in case, should never be called for now, just hard coded the line width
    //at the very beginning should be fine
    Measure.prototype.setLineWidth = function (width) {
        for(var i = 0; i < this._lines.length; i++) {
            this._lines[i].setLineWidth(width);
        }
    };
    
    Measure.prototype._snapCoarse = function(x, y, renderer, camera) {
        // When camera stops, we update the buffers
        if (this._bufferDirty && (!camera.updated && this._bufferDirtyTime < Globals.frame)) {
            this._snap1.update(renderer, this._scene, camera);
            this._bufferDirty = false;
        }
        
        this._snapCoord[0] = x;
        this._snapCoord[1] = y;

        if (this._bufferDirty) {
            return;
        } 
        // dynamic range based on camera distance and limit to [8, 11]
        var radius = Math.min(11, Math.max(8, Math.floor(camera._scene.radius / camera._distance  * 2)));
        // buffer coord, y flipped
        this._anchors[this._anchors.length - 1].snapped = this._snap1.adjustPosition(this._snapCoord, radius);
    };
    
    Measure.prototype._snapFine = function(position, renderer, camera) {
        //https://www.jianshu.com/p/e80a6a461a49
        if (this._lineSnapping) {
            //get the intersect or closest point between 2 3d-lines
            if (this._snap1.index !== -1) {
                //get 4 points
                var [a1, b1] = this._snap1._fetchEdge();
                var a2 = vec3.clone(camera.eye);
                var b2 = camera.unproject(this._snapCoord[0], this._snapCoord[1]);
                
                //get diff vector
                var t1 = 0;
                var d1 = vec3.create();
                var d2 = vec3.create();
                var tmp1 = vec3.create();
                var tmp2 = vec3.create();
                
                vec3.sub(d1, b1, a1);
                vec3.sub(d2, b2, a2);
                vec3.sub(tmp1, a2, a1);
                vec3.cross(tmp1, tmp1, d2);
                vec3.cross(tmp2, d1, d2);
                t1 = vec3.dot(tmp1, tmp2) / vec3.squaredLength(tmp2);
                vec3.lerp(position, a1, b1, t1);
            }
        } else {
            // set close look camera
            this._setCloseCamera(camera, position);
            
            // draw normal buffer
            this._snap2.update(renderer, this._scene, this._closeCamera);
            
            // Adjust position
            var radius = Math.round(FINE_SIZE / 2);
            var coord = [radius, radius];
            this._snap2.adjustPosition(coord, radius);
            
            if (coord[0] !== radius || coord[1] !== radius) {
                //get the world position
                this._snap2.unproject(coord[0], coord[1], position);
            }
        }
        
        this._snapCoord = camera.project(position); 

        this._updateAnchor(this._snapCoord[0], this._snapCoord[1], position, camera);
    };
    
    Measure.prototype._setCloseCamera = function(camera, position) {
        var viewDirection = camera.getViewDirection();
        vec3.set(this._closeCamera._at, position[0], position[1], position[2]);
        vec3.copy(this._closeCamera.eye, camera.eye);

        var up = [0, 0, 1];
        if (Math.abs(viewDirection[2]) > 0.999) {
            up = [0, 1, 0];
        }
        
        mat4.lookAt(this._closeCamera.viewMatrix, this._closeCamera.eye, this._closeCamera._at, up);
        var dis = vec3.distance(this._closeCamera._at, this._closeCamera.eye);
        var planeSize = camera.getNearPlaneSize();
        
        // The first part gives 1:1 zoom ratio. The second part will make the zoom ratio larger
        // when the view distance is large.
        var range = (planeSize[0] / Globals.width * FINE_SIZE) * (dis / camera._znear / 3);

        mat4.ortho(this._closeCamera.projectMatrix, -range, range, -range, range, camera._znear, camera._zfar); 
        
        mat4.multiply(this._closeCamera.vpMatrix, this._closeCamera.projectMatrix, this._closeCamera.viewMatrix);
        this._closeCamera._cull.update();
    };
    
    Measure.prototype._getScreenPosition = function(points, camera) {
        var point0 = [points[0], points[1], points[2]];
        var point1 = [points[3], points[4], points[5]];
        var res = this._projectLineSegmentToScreen(point0, point1, camera);
        if (res) {
            return [(point0[0] + point1[0]) * 0.5, (point0[1] + point1[1]) * 0.5];
        } else {
            return [-100000, -100000, -100000];
        }
    };
    
    Measure.prototype._renderLine = function (renderer, camera, index) {
        var point0 = [this._vertices[index][0], this._vertices[index][1], this._vertices[index][2]];
        var point1 = [this._vertices[index][3], this._vertices[index][4], this._vertices[index][5]];
        
        var res = this._projectLineSegmentToScreen(point0, point1, camera);
        if (res) {
            this._lines[index].updateVertices(point0[0], point0[1], point1[0], point1[1]);
            this._lines[index].render(this._rt0, renderer, camera);
        }
    };
    
    Measure.prototype._projectLineSegmentToScreen = function(point0, point1, camera) {
        var direction = camera.getViewDirection();
        var d = -vec3.dot(direction, camera.eye);

        var sign0 = vec3.dot(point0, direction) + d;
        var sign1 = vec3.dot(point1, direction) + d;
        var diff = vec3.create();
        if (sign0 > 0 || sign1 > 0) {
            
            if (sign0 < 0) {
                vec3.subtract(diff, point0, point1);
                var m = (0.001 - d - vec3.dot(point1, direction)) / vec3.dot(diff, direction);
                vec3.scaleAndAdd(point0, point1, diff, m);
            } 
            if (sign1 < 0) {
                vec3.subtract(diff, point1, point0);
                var m = (0.001 - d - vec3.dot(point0, direction)) / vec3.dot(diff, direction);
                vec3.scaleAndAdd(point1, point0, diff, m);
            }
            var coord0 = camera.project(point0);
            point0[0] = coord0[0];
            point0[1] = coord0[1];
            var coord1 = camera.project(point1);
            point1[0] = coord1[0];
            point1[1] = coord1[1];
            return true;
        } else {
            return false;
        }
    };
    
    return Measure;    
})();
