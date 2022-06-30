//
// m3d_wgl.release.js
// setup webGL
//
//  
import Globals      from "../m3d_globals.js";

export default (function() {
    "use strict";

    function SetupWebGL(canvas, parameters) {
        var gl = WebGLUtils.setupWebGL(canvas, parameters);

        gl.version = gl.getParameter(gl.VERSION);

        var isWebGL2 = (gl.version.match("WebGL 2.0") !== null);
        
        // Extension detect
        if (isWebGL2) {
            gl.floatTextureExtension  = gl.getExtension("EXT_color_buffer_float");
            gl.floatTextureExtension2 = gl.getExtension("OES_texture_float_linear");
            
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

        var syncBuffer = new Uint8Array(4); 
        gl.syncGPU = function() {
            if(Globals.browserName === "chrome") {
                gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, syncBuffer);
            } else {
                gl.finish();  // gl.finish is not working in Chrome
            }
        }
        
        gl.isWebGL2 = isWebGL2;       

        return gl;
    }; 

    return SetupWebGL;
})();
    
