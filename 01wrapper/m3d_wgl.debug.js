//
// m3d_wgl.debug.js
// The wrapper of webGL and hook up debugging counters
//
//  

import Globals      from "../m3d_globals.js";
import profiling    from "../m3d_profiling.js" 

export default (function() {
    "use strict";

    // Add debug layer to the top of GL
    function SetupWebGL(canvas, parameters) {
        var gl = WebGLUtils.setupWebGL(canvas, parameters);
        
        gl.version = gl.getParameter(gl.VERSION);
        
        var isWebGL2 = (gl.version.match("WebGL 2.0") !== null);

        gl.frame = 0;
        gl.elapsedTime = [];
        for (var i = 0; i < 20; ++i) {
            gl.elapsedTime.push(0);
        }

        var VERTEX_NUMBER = {};
        VERTEX_NUMBER[gl.TRIANGLES] = 3;
        VERTEX_NUMBER[gl.LINES] = 2;

        // Add the debug layer.
        gl.drawElements = function(mode, count, type, offset) {
            gl.__proto__.drawElements.call(gl, mode, count, type, offset);
            profiling.numDrawCallsPerFrame++;
            profiling.numDrawPrimitivesPerFrame += count / VERTEX_NUMBER[mode];
        };
        
        gl.drawArrays = function(mode, first, count) {
            gl.__proto__.drawArrays.call(gl, mode, first, count);
            profiling.numDrawCallsPerFrame++;
        };

        gl.useProgram = function(program) {
            gl.__proto__.useProgram.call(gl, program);
            if (program !== null || program !== 0) {
                profiling.numShaderStateChangesPerFrame++;
            }
        };

        gl.uniform1f = function(loc, x) {
            gl.__proto__.uniform1f.call(gl, loc, x);
            profiling.numUniformSyncPerFrame++;
        };
        
        gl.uniform1fv = function(loc, v) {
            gl.__proto__.uniform1fv.call(gl, loc, v);
            profiling.numUniformSyncPerFrame++;
        };
        
        gl.uniform1i = function(loc, x) {
            gl.__proto__.uniform1i.call(gl, loc, x);
            profiling.numUniformSyncPerFrame++;
        };

        gl.uniform2f = function(loc, x, y) {
            gl.__proto__.uniform2f.call(gl, loc, x, y);
            profiling.numUniformSyncPerFrame++;
        };
        
        gl.uniform2fv = function(loc, v) {
            gl.__proto__.uniform2fv.call(gl, loc, v);
            profiling.numUniformSyncPerFrame++;
        };

        gl.uniform2i = function(loc, x, y) {
            gl.__proto__.uniform2i.call(gl, loc, x, y);
            profiling.numUniformSyncPerFrame++;
        };

        gl.uniform3f = function(loc, x, y, z) {
            gl.__proto__.uniform3f.call(gl, loc, x, y, z);
            profiling.numUniformSyncPerFrame++;
        };
        
        gl.uniform3fv = function(loc, v) {
            gl.__proto__.uniform3fv.call(gl, loc, v);
            profiling.numUniformSyncPerFrame++;
        };
        
        gl.uniform3i = function(loc, x, y, z) {
            gl.__proto__.uniform3i.call(gl, loc, x, y, z);
            profiling.numUniformSyncPerFrame++;
        };
        
        gl.uniform4f = function(loc, x, y, z, w) {
            gl.__proto__.uniform4f.call(gl, loc, x, y, z, w);
            profiling.numUniformSyncPerFrame++;
        };
        
        gl.uniform4fv = function(loc, v) {
            gl.__proto__.uniform4fv.call(gl, loc, v);
            profiling.numUniformSyncPerFrame++;
        };
        
        gl.uniform4i = function(loc, x, y, z, w) {
            gl.__proto__.uniform4i.call(gl, loc, x, y, z, w);
            profiling.numUniformSyncPerFrame++;
        };
        
        gl.uniformMatrix3fv = function(loc, transpose, matrix) {
            gl.__proto__.uniformMatrix3fv.call(gl, loc, transpose, matrix);
            profiling.numUniformSyncPerFrame++;
        };
        
        gl.uniformMatrix4fv = function(loc, transpose, matrix) {
            gl.__proto__.uniformMatrix4fv.call(gl, loc, transpose, matrix);
            profiling.numUniformSyncPerFrame++;
        };

        gl.disable = function(flag) {
            if (flag === gl.DEPTH_TEST) {
                profiling.numDepthStateChangePerFrame++;
            }
            gl.__proto__.disable.call(gl, flag);
        };
        gl.depthMask = function(flag) {
            profiling.numDepthStateChangePerFrame++;
            gl.__proto__.depthMask.call(gl, flag);
        };

        gl.bindTexture = function(target, texture) {
            profiling.numTextureStateChangePerFrame++;
            gl.__proto__.bindTexture.call(gl, target, texture);
        };

        gl.bindFramebuffer = function(target, framebuffer) {
            profiling.numFramebufferStateChangePerFrame++;
            gl.__proto__.bindFramebuffer.call(gl, target, framebuffer);
        };

        gl.colorMask = function(red, green, blue, alpha) {
            profiling.numOtherStateChangePerFrame++;
            gl.__proto__.colorMask.call(gl, red, green, blue, alpha);
        };

        gl.depthFunc = function(func) {
            profiling.numDepthStateChangePerFrame++;
            gl.__proto__.depthFunc.call(gl, func);
        };

        gl.clear = function(flag) {
            profiling.numClearPerFrame++;
            gl.__proto__.clear.call(gl, flag);
        };

        gl.activeTexture = function(texUnit) {
            gl.__proto__.activeTexture.call(gl, texUnit);
        };

        gl.reset = function() {
            // Compute the FPS using the duration between 10 frames.
            var currTime = this.elapsedTime[gl.frame] = new Date().getTime();
            var lastTime = this.elapsedTime[(gl.frame + 10) % 20];
            gl.frame = (gl.frame + 1) % 20;
            // Update FPS every 30 frames
            if (gl.frame % 30 == 0) {
                profiling.fps = 10.0 / (currTime - lastTime) * 1000;
            }

            profiling.numDrawCallsPerFrame              = 0;
            profiling.numDrawPrimitivesPerFrame         = 0;
            profiling.numShaderStateChangesPerFrame     = 0;
            profiling.numUniformSyncPerFrame            = 0;
            profiling.numDepthStateChangePerFrame       = 0;
            profiling.numTextureStateChangePerFrame     = 0;
            profiling.numFramebufferStateChangePerFrame = 0;
            profiling.numOtherStateChangePerFrame       = 0;
            profiling.numClearPerFrame                  = 0;

            profiling.numClippingCulledVertices = 0;
            profiling.numBimCulledVertices      = 0;
            profiling.numFrustumCulledVertices  = 0;
            profiling.numZeroAreaCulledVertices = 0;
        };

        var syncBuffer = new Uint8Array(4); 
        gl.syncGPU = function() {
            if(Globals.browserName === "chrome") {
                gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, syncBuffer);
            } else {
                gl.finish(); // gl.finish is not working in Chrome
            }
        }
        
        // Extension detect
        if (isWebGL2) {
            gl.floatTextureExtension  = gl.getExtension("EXT_color_buffer_float");
            gl.floatTextureExtension2 = gl.getExtension("OES_texture_float_linear");
                
            gl.drawElementsInstanced = function(mode, count, type, offset, instanceCount) {
                gl.__proto__.drawElementsInstanced.call(gl, mode, count, type, offset, instanceCount);
            
                profiling.numDrawCallsPerFrame++;
                profiling.numDrawPrimitivesPerFrame += count / VERTEX_NUMBER[mode] * instanceCount;
            };
            
            gl.instancingExtension = parameters.instancing; // enable/disable instancing
        } else {
            if (parameters.instancing) {
                gl.instancingExtension = gl.getExtension("ANGLE_instanced_arrays");
            }
            if (gl.instancingExtension) {
                //We turn off vao if instance drawing been turned on and supported by browser.
                if (parameters.vao) {
                    console.warn("Instance drawing and VAO cannot use at same time. Turn off VAO.");
                }
                gl.drawElementsInstanced = function(mode, count, type, offset, instanceCount) {
                    gl.instancingExtension.drawElementsInstancedANGLE(mode, count, type, offset, instanceCount);

                    profiling.numDrawCallsPerFrame++;
                    profiling.numDrawPrimitivesPerFrame += count / VERTEX_NUMBER[mode] * instanceCount;
                };
                gl.vertexAttribDivisor = function(index, divisor) {
                    gl.instancingExtension.vertexAttribDivisorANGLE(index, divisor);
                }
            } else {
                if (parameters.vao) {
                    gl.vaoExtension = gl.getExtension("OES_vertex_array_object");
                }
                if (gl.vaoExtension) {
                    gl.deleteVertexArray = function (vao) {
                        return gl.vaoExtension.deleteVertexArrayOES(vao);
                    };

                    gl.bindVertexArray = function (vao) {
                        return gl.vaoExtension.bindVertexArrayOES(vao);
                    };

                    gl.createVertexArray = function () {
                        return gl.vaoExtension.createVertexArrayOES();
                    };
                }
            }
            
            gl.floatTextureExtension = (gl.getExtension("OES_texture_float") || gl.getExtension("WEBGL_color_buffer_float")) && 
                                       gl.getExtension("OES_texture_float_linear");
            gl.depthTextureExtension = gl.getExtension("WEBGL_depth_texture") ||
                                       gl.getExtension("WEBKIT_WEBGL_depth_texture") ||
                                       gl.getExtension("MOZ_WEBGL_depth_texture");
            gl.uintIBOExtension      = gl.getExtension("OES_element_index_uint");
        }

        gl.isWebGL2 = isWebGL2;       
        
        return gl;
    }; 

    return SetupWebGL;
})();
    


