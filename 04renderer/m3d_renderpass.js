// m3d_renderpass.js
// a render pass contains a render target, a render queue 
// and a few overrided parameters, e.g., material
//
//  

import RenderQueueManager from "./m3d_renderqueue_manager.js";

export default (function () {
    "use strict";

    function RenderPass(scene, needSort, needCull, selector) {
        this.queue = RenderQueueManager.getQueue(selector);

        this._overridedMaterial = null;
        this._overridedShaders  = [null, null, null];
        this._needSort          = needSort;
        this._cullFace          = gl.CCW;
        this._scene             = scene;
        this._lineMap          = false;         // when lineMap is true, the render pass 
                                                //is about to render all lines in the queue into 
                                                //the framebuffer. Each rendered pixel records the 
                                                //vertex ID of the rasterized line.
    };


    RenderPass.prototype.destroy = function() {
        this.queue.destroy();
        this.queue = null;
        delete this.queue;

        this._scene = null;
        delete this._scene;

        this._overridedShaders = null;
        delete this._overridedShaders;
        
        this._overridedMaterial = null;
        delete this._overridedMaterial;
        RenderQueueManager.queues = {};
    };
    
    RenderPass.prototype.setCullFace = function(cullFace) {
        this._cullFace = cullFace;
    };

    RenderPass.prototype.setLineMap = function(enabled) {
        this._lineMap = enabled;
    };
    
    RenderPass.prototype.render = function(renderTarget, renderer, shadow, camera) {
        var ret = 0;
        if (this.queue.valid) {
            if (this._needSort) {
                this.queue.sort(camera);
            }

            // FIXME: temporary change the blending state of the render target when
            // the override material is transparent. However, we don't do the sorting.
            if (this._overridedMaterial !== null && this._overridedMaterial.transparent) {
                var originalBlend = renderTarget._options.blend;
                renderTarget._options.blend = true;
                renderTarget.always = true;
            }

            if (this._lineMap) {
                ret = renderer.drawLinesWithVertexIds(renderTarget, this.queue.drawables, camera, 
                    this._overridedShaders, this._overridedMaterial, this._scene.clipping, 
                    this._cullFace);
            } else {
                ret = renderer.drawDrawables(renderTarget, this.queue.drawables, camera, 
                    this._overridedShaders, this._overridedMaterial, this._scene.clipping, 
                    this._scene.getMainLight(), shadow, null, this._cullFace);            
            }
            

            if (this._overridedMaterial !== null && this._overridedMaterial.transparent) {
                renderTarget._options.blend = originalBlend;
                renderTarget.always = false;
            }
        }

        return ret;
    };

    RenderPass.prototype.setOverridedMaterial = function(material) {
        this._overridedMaterial = material;

        if (material) {
            if (this._overridedShaders[0]) {
                this._overridedMaterial.attachShader(this._overridedShaders[0]);
            }
        } 
    };

    RenderPass.prototype.setOverridedShader = function(shader) {
        this._overridedShaders[0] = shader;
        if (this._overridedMaterial && this._overridedShaders[0]) {
            this._overridedMaterial.attachShader(this._overridedShaders[0]);
        }

        if (shader) {
            var resourceManager = shader._manager;

            var flags1 = shader.flags.concat("MODEL_TRANSFORM");
            var shader1 = resourceManager.getShader(shader.shaderSource.name, flags1);
            if (!shader1.ready) {
                shader1.createFromShaderSource(shader.shaderSource, flags1);
            }
            this._overridedShaders[1] = shader1;
            
            var flags2 = flags1.concat("INSTANCING");
            var shader2 = resourceManager.getShader(shader.shaderSource.name, flags2);
            if (!shader2.ready) {
                shader2.createFromShaderSource(shader.shaderSource, flags2);
            }
            this._overridedShaders[2] = shader2;
        }
    };
    
    RenderPass.prototype.recompileOverridedShader = function(resourceManager, flags) {
        if (this._overridedShaders[0] !== null) {
            var shaderSource = this._overridedShaders[0].shaderSource;

            var shader = resourceManager.getShader(shaderSource.name, flags);
            if (!shader.ready) {
                shader.createFromShaderSource(shaderSource, flags);
            }
            this.setOverridedShader(shader);
        } else {
            this._overridedShaders[0] = null;
        }
    };

    RenderPass.prototype.isValid = function() {
        return this.queue.drawables.length > 0;
    };
    
    
    return RenderPass;
})();
