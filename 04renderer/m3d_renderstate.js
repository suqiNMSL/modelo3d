//
// m3d_renderstate.js
// The render states
//
//  

import Globals from "../m3d_globals.js";

export default (function() {
    "use strict";
    
    var perFrameData = new Float32Array(36);

    function RenderState() {
        // public:
        this.dirtyBits   = (0xffffffff | 0); // Set dirty initially

        // private:
        // Rendering state 
        this._framebuffer  = null; // The current framebuffer
        this._mesh         = null; // The current mesh
        this._shader       = null; // The current shader

        // More rendering states
        this._clearColor  = new Float32Array([1.0, 1.0, 1.0, 0.0]);
        this._colorMask   = new Int32Array([1, 1, 1, 1]);
        this._depthTest   = true;
        this._clearDepth  = 1.0;
        this._depthFunc   = gl.LESS;
        this._viewport    = new Int32Array([0, 0, Globals.width, Globals.height]);
        this._planesArray = new Float32Array(24);
        this._blend       = false;
        this._stencilTest = false;
        this._stencilOp   = [gl.KEEP, gl.KEEP, gl.REPLACE];
        this._stencilFunc = [gl.ALWAYS, 0, -1];
        
        // Initialize OpenGL states
        gl.enable(gl.CULL_FACE);
        gl.frontFace(gl.CCW);

        // FIXME: line width does not work in Chrome using ANGLE.
        gl.lineWidth(1);

        gl.clearColor(this._clearColor[0],
                      this._clearColor[1],
                      this._clearColor[2],
                      this._clearColor[3]);

        gl.colorMask(this._colorMask[0],
                     this._colorMask[1], 
                     this._colorMask[2], 
                     this._colorMask[3]);

        gl.clearStencil(0);

        if (this._depthTest) {
            gl.enable(gl.DEPTH_TEST);
        } else {
            gl.disable(gl.DEPTH_TEST);
        }
        gl.clearDepth(this._clearDepth);
        gl.depthFunc(this._depthFunc);
        if (this._blend) {
            gl.enable(gl.BLEND);
        } else {
            gl.disable(gl.BLEND);
        }
        // TODO: save the state of blend func
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        if (this._stencilTest) {
            gl.enable(gl.STENCIL_TEST);
        } else {
            gl.disable(gl.STENCIL_TEST);
        }

        gl.viewport(this._viewport[0], this._viewport[1], this._viewport[2], this._viewport[3]);
    }; 


    RenderState.CLIP_DIRTY_BIT = (1 | 0);
    RenderState.LIGHT_DIRTY_BIT = (2 | 0);
    RenderState.SHADOW_DIRTY_BIT = (4 | 0);
    RenderState.MATERIAL_DIRTY_BIT = (8 | 0);
    RenderState.OTHER_DIRTY_BIT = (16 | 0);
    RenderState.ALL_DIRTY_BIT = 
            (RenderState.CLIP_DIRTY_BIT |
             RenderState.LIGHT_DIRTY_BIT |
             RenderState.SHADOW_DIRTY_BIT |
             RenderState.MATERIAL_DIRTY_BIT |
             RenderState.OTHER_DIRTY_BIT);


    RenderState.prototype.useShader = function(shader, camera, clipping, light, shadow, materials, vertexBaseId) {
        if (shader !== this._shader || this.dirtyBits) {
            if (shader !== null) {
                if (shader !== this._shader) {
                    shader.use();
                }
  
                // Update some uniforms only when their CPU values are changed.
                if (this.dirtyBits) {
                    if (this.dirtyBits & RenderState.CLIP_DIRTY_BIT) {
                        this._syncGlobalUniforms(shader.reservedUniforms, clipping);
                    }
                    if (this.dirtyBits & RenderState.LIGHT_DIRTY_BIT) {
                        this._syncLightUniforms(shader.reservedUniforms, light, shadow);
                    }
                    if (this.dirtyBits & RenderState.MATERIAL_DIRTY_BIT) {
                        this._syncMaterialsUniforms(shader.reservedUniforms, materials);
                    }
                    if (this.dirtyBits & RenderState.SHADOW_DIRTY_BIT) {
                        this._syncShadowUniforms(shader.reservedUniforms, shadow);
                    }
                }

                // Update some other every frame.
                var uniform;
                if (gl.isWebGL2) {
                    uniform = shader.reservedUniforms["m_uPerFrame"];
                    if (uniform) {
                        camera.uniformBlock.set(camera.viewMatrix, 0);
                        camera.uniformBlock.set(camera.vpMatrix, 16);
                        if (camera.isPerspective()) {
                            camera.uniformBlock[32] = camera.eye[0];
                            camera.uniformBlock[33] = camera.eye[1];
                            camera.uniformBlock[34] = camera.eye[2];
                            camera.uniformBlock[35] = 1;
                        } else {
                            var d = camera.getViewDirection();
                            camera.uniformBlock[32] = -d[0];
                            camera.uniformBlock[33] = -d[1];
                            camera.uniformBlock[34] = -d[2];
                            camera.uniformBlock[35] = 0;
                        }
                        uniform.upload(camera.uniformBlock);
                    }

                    uniform = shader.reservedUniforms["m_uBaseVertexOffset"];
                    if (uniform) {
                        uniform.upload(vertexBaseId);
                    }
                } else {
                    uniform = shader.reservedUniforms["m_uPerFrame.vpMatrix"];
                    if (uniform) {
                        uniform.upload(camera.vpMatrix);
                    }
                    uniform = shader.reservedUniforms["m_uPerFrame.viewMatrix"];
                    if (uniform) {
                        uniform.upload(camera.viewMatrix);
                    }
                    uniform = shader.reservedUniforms["m_uPerFrame.cameraPosition"];
                    if (uniform) {
                        var v;
                        if (camera.isPerspective()) {
                            v = camera.eye;
                        } else {
                            var d = camera.getViewDirection();
                            d[0] = -d[0];
                            d[1] = -d[1];
                            d[2] = -d[2];
                            v = d;
                        }
                        uniform.upload(v);
                    }
                }
            }
            
            this._shader = shader;
        }
    };

    RenderState.prototype.useFramebuffer = function(framebuffer) {
        if (this._framebuffer !== framebuffer) {
            this._framebuffer = framebuffer;
            this._framebuffer.use();
        }
    };

    RenderState.prototype.useMesh = function(mesh) {
        if (this._mesh !== mesh) {
            this._mesh = mesh;
            this._mesh.use();
        }
    };

    RenderState.prototype.clearColor = function(clearColor) {
        if (clearColor[0] !== this._clearColor[0] ||
            clearColor[1] !== this._clearColor[1] ||
            clearColor[2] !== this._clearColor[2] ||
            clearColor[3] !== this._clearColor[3]) {
            this._clearColor[0] = clearColor[0];
            this._clearColor[1] = clearColor[1];
            this._clearColor[2] = clearColor[2];
            this._clearColor[3] = clearColor[3];

            gl.clearColor(this._clearColor[0],
                          this._clearColor[1],
                          this._clearColor[2],
                          this._clearColor[3]);
        }
    };

    RenderState.prototype.colorMask = function(mask) {
        if (mask[0] !== this._colorMask[0] ||
            mask[1] !== this._colorMask[1] ||
            mask[2] !== this._colorMask[2] ||
            mask[3] !== this._colorMask[3]) {
            this._colorMask[0] = mask[0];
            this._colorMask[1] = mask[1];
            this._colorMask[2] = mask[2];
            this._colorMask[3] = mask[3];

            gl.colorMask(this._colorMask[0],
                         this._colorMask[1],
                         this._colorMask[2],
                         this._colorMask[3]);
        }
    };

    RenderState.prototype.depthTest = function(depthTest, clearDepth, depthFunc) {
        if (this._depthTest !== depthTest) {
            this._depthTest = depthTest;
            if (this._depthTest) {
                gl.enable(gl.DEPTH_TEST);
            } else {
                gl.disable(gl.DEPTH_TEST);
            }
        }
        if (this._clearDepth !== clearDepth) {
            this._clearDepth = clearDepth;
            gl.clearDepth(this._clearDepth);
        }
        if (this._depthFunc !== depthFunc) {
            this._depthFunc = depthFunc;
            gl.depthFunc(this._depthFunc);
        }
    };

    RenderState.prototype.depthMask = function(depthMask) {
        if (this._depthMask !== depthMask) {
            this._depthMask = depthMask;
            gl.depthMask(this._depthMask);
        }
    };
    
    RenderState.prototype.viewport = function(viewport) {
        if (viewport[0] !== this._viewport[0] ||
            viewport[1] !== this._viewport[1] ||
            viewport[2] !== this._viewport[2] ||
            viewport[3] !== this._viewport[3]) {
            this._viewport[0] = viewport[0];
            this._viewport[1] = viewport[1];
            this._viewport[2] = viewport[2];
            this._viewport[3] = viewport[3];

            gl.viewport(this._viewport[0],
                         this._viewport[1],
                         this._viewport[2],
                         this._viewport[3]);
        }
    };

    RenderState.prototype.blend = function(blend) {
        if (this._blend !== blend) {
            this._blend = blend;
            if (this._blend) {
                gl.enable(gl.BLEND);
            } else {
                gl.disable(gl.BLEND);
            }
        }
    };
    
    RenderState.prototype.stencilTest = function(stencil, func, op) {
        if (this._stencil !== stencil) {
            this._stencil = stencil;
            if (this._stencil) {
                gl.enable(gl.STENCIL_TEST);
            } else {
                gl.disable(gl.STENCIL_TEST);
            }
        }
        if (this._stencilFunc[0] !== func[0] ||
            this._stencilFunc[1] !== func[1] ||
            this._stencilFunc[2] !== func[2]) {
            this._stencilFunc[0] = func[0];
            this._stencilFunc[1] = func[1];
            this._stencilFunc[2] = func[2];
            gl.stencilFunc(func[0], func[1], func[2]);
        }
        if (this._stencilOp[0] !== op[0] ||
            this._stencilOp[1] !== op[1] ||
            this._stencilOp[2] !== op[2]) {
            this._stencilOp[0] = op[0];
            this._stencilOp[1] = op[1];
            this._stencilOp[2] = op[2];
            gl.stencilOp(op[0], op[1], op[2]);
        }

    };
    
    // Invalidate the current GPU states 
    RenderState.prototype.invalidateStates = function() {
        this._mesh        = null;
        this._framebuffer = null;
        this._shader      = null;
    }; 

    RenderState.prototype.invalidateShadow = function() {
        this.dirtyBits |= RenderState.SHADOW_DIRTY_BIT;
    };
    RenderState.prototype.invalidateLight = function() {
        this.dirtyBits |= RenderState.LIGHT_DIRTY_BIT;
    };
    RenderState.prototype.invalidateClip = function() {
        this.dirtyBits |= RenderState.CLIP_DIRTY_BIT;
    };
    RenderState.prototype.invalidateManager = function() {
        this.dirtyBits |= RenderState.MATERIAL_DIRTY_BIT;
    };
    RenderState.prototype.invalidateOther = function() {
        this.dirtyBits |= RenderState.OTHER_DIRTY_BIT;
    };
    
    RenderState.prototype._syncGlobalUniforms = function(uniforms, clipping) {
        if (!clipping) {
            return;
        }
        var uniform;

        uniform = uniforms["m_uGlobal.clipPlanes[0]"];
        if (uniform) {
            var planes = clipping.getClippingPlanes();
            this._planesArray[0]  =  planes[0][0];
            this._planesArray[1]  =  planes[0][1];
            this._planesArray[2]  =  planes[0][2];
            this._planesArray[3]  = -planes[0][3];
            this._planesArray[4]  =  planes[1][0];
            this._planesArray[5]  =  planes[1][1];
            this._planesArray[6]  =  planes[1][2];
            this._planesArray[7]  = -planes[1][3];
            this._planesArray[8]  =  planes[2][0];
            this._planesArray[9]  =  planes[2][1];
            this._planesArray[10] =  planes[2][2];
            this._planesArray[11] = -planes[2][3];
            this._planesArray[12] =  planes[3][0];
            this._planesArray[13] =  planes[3][1];
            this._planesArray[14] =  planes[3][2];
            this._planesArray[15] = -planes[3][3];
            this._planesArray[16] =  planes[4][0];
            this._planesArray[17] =  planes[4][1];
            this._planesArray[18] =  planes[4][2];
            this._planesArray[19] = -planes[4][3];
            this._planesArray[20] =  planes[5][0];
            this._planesArray[21] =  planes[5][1];
            this._planesArray[22] =  planes[5][2];
            this._planesArray[23] = -planes[5][3];
            
            uniform.upload(this._planesArray);
        }
    };
    
    RenderState.prototype._syncLightUniforms = function(uniforms, light) {
        if (!light) {
            return;
        }
        
        var uniform;
        
        // sun light
        uniform = uniforms["m_uSunLight.intensity"];
        if (uniform) {
            uniform.upload(light.intensity);
            
            // uniform = uniforms["m_uSunLight.diffuseMatrix[0]"];
            // uniform.upload(light.envmapMatrix);

            // TODO: in PBS, we will need GB channels of diffuse matrix.
            //uniform = uniforms["m_uSunLight.diffuseMatrix[1]"];
            //uniform.upload(light.envmapMatrix);
            //uniform = uniforms["m_uSunLight.diffuseMatrix[2]"];
            //uniform.upload(light.envmapMatrix);
            
            // uniform = uniforms["m_uSunLight.direction"];
            // uniform.upload(light.direction);
        }

        uniform = uniforms["m_uSunLight.diffuseMatrix[0]"];
        if (uniform) {
            uniform.upload(light.envmapMatrix);
        }

        uniform = uniforms["m_uSunLight.direction"];
        if (uniform) {
            uniform.upload(light.direction);
        }
    };

    RenderState.prototype._syncShadowUniforms = function(uniforms, shadow) {
        if (!shadow) {
            return;
        }
        
        var uniform;

        uniform = uniforms["m_uShadowTexture"];
        if (uniform) {
            if (shadow.shadowMap) {
                uniform.upload(6);
                shadow.shadowMap.use(6);
            } else {
                console.warn("shadow map is switching, can not be called now");
            }
            
            uniform = uniforms["m_uSunLight.shadowMatrix"];
            uniform.upload(shadow.lightMatrix);

            if (!Globals.isMobile) {
                uniform = uniforms["m_uShadowFine"];
                uniform.upload(shadow.fine? 1.0 : 0.0);
            }
        }
    };

    // Sync global material uniforms.
    RenderState.prototype._syncMaterialsUniforms = function(uniforms, materials) {
        if (!materials) {
            return ;
        }

        var uniform = uniforms["m_uMaterialTexture"];
        if (uniform) {
            uniform.upload(4);
            materials.texture.use(4);
        }
    };

    return RenderState;
})();

