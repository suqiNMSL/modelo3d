// m3d_renderer.js
// Renderer which does not related to scene.
//
//  

import Globals     from "../m3d_globals.js";
import profiling   from "../m3d_profiling.js"; 
import RenderState from "./m3d_renderstate.js";

export default (function () {
    "use strict";

    function Renderer(resourceManager) {
        // public:
        this.renderState = new RenderState();

        // private:
        this._renderTarget = null;
        this._quadMesh     = null;

        this._quadMesh = resourceManager.getMesh("quad");
        this._quadMesh.createQuad();
    };

    Renderer.prototype.destroy = function() {
        this.renderState = null;
    };

    var indices = [0, 0];

    Renderer.prototype.drawDrawables = function(target, drawables, camera, overridedShaders, 
            overridedMaterial, clipping, light, shadow, materials, cullFace) {

        if (drawables.length === 0) {
            return 0;
        }

        if (this._renderTarget !== target || this._renderTarget.always) {
            this._renderTarget = target;
            this._renderTarget.render(this.renderState);
        }

        if (!cullFace) {
            gl.disable(gl.CULL_FACE);
        } else {
            gl.enable(gl.CULL_FACE);
            gl.frontFace(cullFace);
        }

        this.renderState.viewport(camera.viewport);

        if (overridedShaders[0] !== null) {
        
            // If the the scene is not contained by the camera frustum, we can skip
            // culling testing of each individual drawable.
            for (var i = 0, len = drawables.length; i < len; i++) {
                var drawable = drawables[i];
                
                if (!drawable.visible) {
                    continue;
                }
                
                indices[0] = 0;
                indices[1] = drawable.mesh.length;

                if (camera.cull(drawable, indices)) {
                    continue;
                }
                
                if (drawable.billboard) {
                    drawable.update(camera);
                }
                
                var shader = null;
                // Choose shader base on drawable type
                if (drawable.transform.identity) {
                    shader = overridedShaders[0];
                } else if (drawable.isInstancing()) {
                    shader = overridedShaders[2];
                } else {
                    shader = overridedShaders[1];
                }
                
                // Bind the shader to the pipeline and update global uniforms.
                this.renderState.useShader(shader, camera, clipping, light, shadow, null, null);

                // Update uniforms in the materials.
                if (overridedMaterial) {
                    overridedMaterial.absorb(drawable.material);
                    overridedMaterial.use(shader);
                } else {
                    drawable.material.use(shader);
                }
                
                // Render mesh
                this.renderState.useMesh(drawable.mesh);
                drawable.render(camera, shader, indices);
            }
        } else {

            for (var i = 0, len = drawables.length; i < len; i++) {
                var drawable = drawables[i];

                if (!drawable.visible) {
                    continue;
                }
                
                indices[0] = 0;
                indices[1] = drawable.mesh.length;

                if (camera.cull(drawable, indices)) {
                    continue;
                }
                
                if (drawable.billboard) {
                    drawable.update(camera);
                }
                
                // Bind the shader to the pipeline and update global uniforms.
                this.renderState.useShader(drawable.shader, camera, clipping, light, shadow, materials);
                // Update uniforms in the materials.
                drawable.material.use(drawable.shader);

                // Render mesh
                this.renderState.useMesh(drawable.mesh);
                drawable.render(camera, drawable.shader, indices);
            }
        }

    };

    Renderer.prototype.drawLinesWithVertexIds = function(target, drawables, camera, overridedShaders, 
            overridedMaterial, clipping, cullFace) {

        if (drawables.length === 0) {
            return 0;
        }

        if (this._renderTarget !== target || this._renderTarget.always) {
            this._renderTarget = target;
            this._renderTarget.render(this.renderState);
        }

        if (!cullFace) {
            gl.disable(gl.CULL_FACE);
        } else {
            gl.enable(gl.CULL_FACE);
            gl.frontFace(cullFace);
        }

        this.renderState.viewport(camera.viewport);

        var vertexBaseId = 0;
        // If the the scene is not contained by the camera frustum, we can skip
        // culling testing of each individual drawable.
        for (var i = 0, len = drawables.length; i < len; i++) {
            var drawable = drawables[i];
            
            if (!drawable.visible) {
                continue;
            }
            
            indices[0] = 0;
            indices[1] = drawable.mesh.length;

            if (camera.cull(drawable, indices)) {
                continue;
            }
            
            if (drawable.billboard) {
                drawable.update(camera);
            }
            
            var shader = null;
            // Choose shader base on drawable type
            if (drawable.transform.identity) {
                shader = overridedShaders[0];
            } else if (drawable.isInstancing()) {
                shader = overridedShaders[2];
            } else {
                shader = overridedShaders[1];
            }
            
            // Bind the shader to the pipeline and update global uniforms.
            this.renderState.useShader(shader, camera, clipping, null, null, null, vertexBaseId);

            // Update uniforms in the materials.
            if (overridedMaterial) {
                overridedMaterial.absorb(drawable.material);
                overridedMaterial.use(shader);
            } else {
                drawable.material.use(shader);
            }
            
            // Render mesh
            this.renderState.useMesh(drawable.mesh);
            drawable.render(camera, shader, indices);
            vertexBaseId += (drawable.mesh.bytes - drawable.mesh.length * drawable.mesh.indexSize) / 4;
        }
    };
    // Draw a single drawable
    Renderer.prototype.drawDrawable = function(target, drawable, camera, clipping, light, shadow, cullFace) {
        if (this._renderTarget !== target || this._renderTarget.always) {
            this._renderTarget = target;
            this._renderTarget.render(this.renderState);
        }

        if (!cullFace) {
            gl.disable(gl.CULL_FACE);
        } else {
            gl.enable(gl.CULL_FACE);
            gl.frontFace(cullFace);
        }

        this.renderState.viewport(camera.viewport);

        this.renderState.useShader(drawable.shader, camera, clipping, light, shadow);

        drawable.material.use(drawable.shader);
        drawable.transform.use(camera, drawable.shader);
            
        this.renderState.useMesh(drawable.mesh);

        drawable.mesh.render();
    };
    
    // Draw an element
    Renderer.prototype.drawElements = function(target, elements, camera, clipping, light, shadow, cullFace,  
                                                overridedShaders, overridedMaterial) {
        if (elements.length === 0) {
            return;
        }
        
        if (overridedMaterial !== null && overridedMaterial.transparent) {
            var originalBlend = target._options.blend;
            target._options.blend = true;
            target.always = true;
        }
            
        if (this._renderTarget !== target || this._renderTarget.always) {
            this._renderTarget = target;
            this._renderTarget.render(this.renderState);
        }

        if (!cullFace) {
            gl.disable(gl.CULL_FACE);
        } else {
            gl.enable(gl.CULL_FACE);
            gl.frontFace(cullFace);
        }

        this.renderState.viewport(camera.viewport);
        
        if(overridedShaders && overridedShaders[0] !== null) {
            for (var i = 0, len = elements.length; i < len; i++) {
                var element = elements[i];
                var drawable = element.drawable;

                if (drawable.billboard) {
                    drawable.update(camera);
                }

                var shader = null;
                // Choose shader base on drawable type
                if (drawable.transform.identity) {
                    shader = overridedShaders[0];
                } else if (drawable.isInstancing()) {
                    shader = overridedShaders[2];
                } else {
                    shader = overridedShaders[1];
                }
                
                // Bind the shader to the pipeline and update global uniforms.
                this.renderState.useShader(shader, camera, clipping, light, shadow);
                
                // Update uniforms in the materials.
                overridedMaterial.absorb(drawable.material);
                overridedMaterial.use(shader);
                
                this.renderState.useMesh(drawable.mesh);
                indices[0] = element.indicesOffset;
                indices[1] = element.indicesCount;
                if (drawable.isInstancing()) { // instanced
                    drawable.renderBaseInstance(camera, shader, indices);
                } else {
                    drawable.render(camera, shader, indices);
                }
            }
        } else {
            for (var i = 0, len = elements.length; i < len; i++) {
                var element = elements[i];
                var drawable = element.drawable;
                    
                if (drawable.billboard) {
                    drawable.update(camera);
                }
                
                // Bind the shader to the pipeline and update global uniforms.
                this.renderState.useShader(drawable.shader, camera, clipping, light, shadow);
                // Update uniforms in the materials.
                drawable.material.use(drawable.shader);
                
                this.renderState.useMesh(drawable.mesh);
                indices[0] = element.indicesOffset;
                indices[1] = element.indicesCount;
                if (drawable.isInstancing()) { // instanced
                    drawable.renderBaseInstance(camera, drawable.shader, indices);
                } else {
                    drawable.render(camera, drawable.shader, indices);
                }
            }
        }
        
        if (overridedMaterial !== null && overridedMaterial.transparent) {
            target._options.blend = originalBlend;
            target.always = false;
        }
    };
    
    Renderer.prototype.drawGizmo = function(target, drawable, camera, cullFace) {
        this.drawDrawable(target, drawable, camera, null, null, null, cullFace);
    };
    
    // Draw a screen quad
    Renderer.prototype.drawScreen = function(target, shader, material) { 
        if (this._renderTarget !== target || this._renderTarget.always) {
            this._renderTarget = target;
            this._renderTarget.render(this.renderState);
        }

        gl.disable(gl.CULL_FACE);

        this.renderState.useShader(shader);
        material.use(shader);

        this.renderState.useMesh(this._quadMesh);
        this._quadMesh.render();
    };

    // A custom callback function will be called before draw each drawable.
    Renderer.prototype.drawDrawablesCustom = function(target, drawables, camera, overridedShaders, 
            overridedMaterial, clipping, cullFace, onMaterialCallback) {
        
        if (drawables.length === 0) {
            return;
        }

        if (this._renderTarget !== target || this._renderTarget.always) {
            this._renderTarget = target;
            this._renderTarget.render(this.renderState);
        }

        if (cullFace) {
            gl.disable(gl.CULL_FACE);
        } else {
            gl.enable(gl.CULL_FACE);
            gl.frontFace(gl.CCW);
        }
        
        this.renderState.viewport(camera.viewport);

        // If the the scene is not contained by the camera frustum, we can skip
        // culling testing of each individual drawable.
        for (var i = 0, len = drawables.length; i < len; i++) {
            var drawable = drawables[i];
            if (!drawable.visible || camera.cull(drawable, indices)) {
                continue;
            }
                
            indices[0] = 0;
            indices[1] = drawable.mesh.length;
                
            var shader = null;
            // Choose shader base on drawable type
            if (drawable.transform.identity) {
                shader = overridedShaders[0];
            } else if (drawable.isInstancing()) {
                shader = overridedShaders[2];
            } else {
                shader = overridedShaders[1];
            }
        
            // Bind the material's shader to the pipeline and update
            // uniforms in the materials.
            this.renderState.useShader(shader, camera, clipping);
            
            onMaterialCallback(i, overridedMaterial);
            overridedMaterial.use(shader);
            this.renderState.useMesh(drawable.mesh);
            drawable.render(camera, shader, indices);
        }
    };

    Renderer.prototype.drawSkybox = function(target, drawable, camera) {
        if (this._renderTarget !== target || this._renderTarget.always) {
            this._renderTarget = target;
            this._renderTarget.render(this.renderState);
        }

        gl.disable(gl.CULL_FACE);

        this.renderState.viewport(camera.viewport);
        this.renderState.useShader(drawable.shader, camera);

        drawable.material.use(drawable.shader);
        drawable.transform.use(camera, drawable.shader);   
        this.renderState.useMesh(drawable.mesh);
        drawable.mesh.render();
    };
    
    Renderer.prototype.beginFrame = function() {
        this.renderState.invalidateStates();
    };
    
    Renderer.prototype.endFrame = function() {
        // The shader's uniform should have been cleaned.
        this.renderState.dirtyBits = 0;

        // TODO: clear error bits if any
        gl.getError();
    };

    // Draw a full screen quad
    Renderer.prototype.invalidate = function() {
        this._renderTarget = null;
        this.renderState.dirtyBits = RenderState.ALL_DIRTY_BIT;
    };

    // clear the defualt framebuffer's depth and color buffer.
    Renderer.prototype.clear = function(target, clearBits) {
        if (this._renderTarget !== target) {
            this._renderTarget = target;
            this._renderTarget.render(this.renderState);
        }

        gl.clear(clearBits);
    };

    Renderer.prototype.restore = function() {
    };

    Renderer.prototype.discard = function() {
    };

    return Renderer;
})();
    
