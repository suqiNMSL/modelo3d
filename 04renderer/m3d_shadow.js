//
// m3d_shadow.js
// Shadow using ESM
//
//  

// FIXME: don't use mobile shadow on Microsoft Surface (drop Globals.isMobile)

import Globals       from "../m3d_globals.js";
import MyMath        from "../00utility/m3d_math.js";
import ShaderLibrary from "../02resource/m3d_shader_library.js";
import SceneCamera   from "../03scene/camera/m3d_scene_camera.js";
import Material      from "../03scene/materials/m3d_material.js";
import RenderTarget  from "./m3d_rendertarget.js";
import Blit          from "./m3d_blit.js";
import RenderPass    from "./m3d_renderpass.js";
import SAMPLES       from "./m3d_samples.js";

export default (function() {
    "use strict";

    // Generate the shadow map.
    function Shadow(scene, resourceManager, camera) {
        // private:
        this._ready                = false;
        // shadow map size.
        if (Globals.width < 512 && Globals.height < 512) {
            this.smSize = 1024;
        } else {
            this.smSize = 2048;
        }
    
        this._blit                 = null;
        this._lightCamera          = new SceneCamera(scene);
        this._scene                = scene;
        this._resourceManager      = resourceManager;
        this._camera               = camera;
        this._renderTargets        = [];
        this._coarseLightMatrix    = mat4.create();
        this._fineLightMatrix      = mat4.create();
        
        this._opaques = new RenderPass(scene, false, false, { shadowCaster: true, mask: false });
        this._maskeds = new RenderPass(scene, false, false, { shadowCaster: true, mask: true });

        this._opaques.setOverridedMaterial(new Material("shadow"));
        this._maskeds.setOverridedMaterial(scene.materialManager.createMaterialAdhoc("shadow"));
        
        var shadowShader = resourceManager.getShader("normaldepth", []);
        if (!shadowShader.ready) {
             var shaderSource = ShaderLibrary["normaldepth"];
             shadowShader.createFromShaderSource(shaderSource, []);
        }
        this._opaques.setOverridedShader(shadowShader);
        this._maskeds.setOverridedShader(shadowShader);
        this.recompileShader(this._resourceManager, { "section": false });

        // public:
        this.shadowMap             = null;
        this.lightMatrix           = this._coarseLightMatrix;
        this.fine                  = false; // use fine or coarse shadow

        // Initialization
        this._lightCamera.setViewport([0, 0, this.smSize, this.smSize]);

        if (Globals.isMobile) {
            // We use depth texture in mobile (iOS)
            this._renderTargets[0] = new RenderTarget("shadow-depth", resourceManager,
                    this.smSize, this.smSize, {
                        colorFormat: gl.R8, 
                        colorMask: [0, 0, 0, 0],
                        depthFormat: gl.DEPTH_STENCIL,
                        depthFilter: gl.NEAREST,
                        clearColor: [1.0, 1.0, 1.0, 1.0]
                    });
            if (this._renderTargets[0].ready) {
                this._ready = true;
            }
            
        } else {
            this._renderTargets[0] = new RenderTarget("shadow-depth", resourceManager,
                    this.smSize, this.smSize, {
                        colorMask: [0, 0, 0, 0],
                        colorFormat: gl.isWebGL2 ? gl.RED : gl.RGB, 
                        depthFilter: gl.NEAREST,
                        depthFormat: gl.DEPTH_STENCIL
                    });
            this._renderTargets[1] = new RenderTarget("shadow-smooth", resourceManager,
                    this.smSize, this.smSize, {
                        colorFormat: gl.isWebGL2 ? "R32F" : (Globals.browserName === "firefox" ? "RGBA32F": "RGB32F"), 
                        colorFilter: gl.NEAREST,                        
                        depthTest:   false
                    });

            this._blit = new Blit(resourceManager, ShaderLibrary["shadowsmooth"]);
            this._blit.setTexture(this._renderTargets[0].getDepthBuffer());

            if (this._blit.ready && this._renderTargets[0].ready) {
                if (!Globals.isMobile && this._renderTargets[1].ready) {     
                    this._ready = true;
                } else {
                    this._ready = true;
                }
            } else {
                console.warn("Shadow is not ready we fail to create resources");
            }
        }
        
        if (Globals.isMobile || this.fine) {
            this.shadowMap = this._renderTargets[0].getDepthBuffer();
        } else {
            this.shadowMap = this._renderTargets[1].getColorBuffer();
        }
    };

    Shadow.prototype.destroy = function() {
        this._renderTargets[0].destroy();
        if (!Globals.isMobile) {
            this._renderTargets[1].destroy();
            this._blit.destroy();
        }

        this._opaques.destroy();
        this._maskeds.destroy();
    };
    
    Shadow.prototype.recompileShader = function(resourceManager, states) {
        var flags = [];
        if (states.section) {
            flags.push("CLIPPING");
        }
        if (this._scene.compressed) {
            flags.push("COMPRESSION");
        }
        flags.push("ONLY_DEPTH");
        this._opaques.recompileOverridedShader(resourceManager, flags);

        flags.push("ALPHATEST");
        this._maskeds.recompileOverridedShader(resourceManager, flags);
    };

    Shadow.prototype.update = function(renderer, frameIdx) {
        if (!this._ready) {
            return;
        }

        var scene = this._scene;

        this._lightCamera.setCullingEnabled(true);

        // Create and save the light matrix.
        if (this.fine) {
            // Compute the tight bounding box of light frustum which is the intersection
            // of scene camera frustum and scene bbox.

            var frustum = MyMath.frustum.createFromMatrix(this._camera.vpMatrix);
            var intersections = MyMath.intersect.aabb_frustum(scene.clipping.get(), frustum);
            
            if (frameIdx !== undefined) {
                var dx = SAMPLES._4x4_2D[frameIdx * 2] - 0.5;
                var dy = SAMPLES._4x4_2D[frameIdx * 2 + 1] - 0.5;      

                // Jitter the light direction
                var direction = vec3.create();
                vec3.copy(direction, scene.getMainLight().direction);

                var scale = Math.min(0.005 + scene.radius / this._camera._distance * 0.01, 0.01);

                // create vector basis orthogonal to light direction
                var up = vec3.create();
                if (Math.abs(direction[0]) > Math.abs(direction[2])) {
                    vec3.set(up, -direction[1], direction[0], 0.0);
                } else {
                    vec3.set(up, 0.0, -direction[2], direction[1]);
                }
                vec3.normalize(up, up);
                
                var right = vec3.create();
                vec3.cross(right, direction, up);
                vec3.normalize(right, right);
                
                vec3.scaleAndAdd(direction, direction, right, scale * dx);
                vec3.scaleAndAdd(direction, direction, up, scale * dy);
                vec3.normalize(direction, direction);

                // Use the jittered direction
                this._lightCamera.createFromLightTight(direction, scene, intersections);
                
                this._lightCamera.jitter(dx / this.smSize, dy / this.smSize);
                mat4.multiply(this._lightCamera.vpMatrix, this._lightCamera.projectMatrix, this._lightCamera.viewMatrix);
            } else {
                this._lightCamera.createFromLightTight(scene.getMainLight().direction, scene, intersections);
            }
            mat4.copy(this._fineLightMatrix, this._lightCamera.vpMatrix);
            
            this.lightMatrix = this._fineLightMatrix;
            this._lightCamera.setBimCullingEnabled(false);
        } else {
            this._lightCamera.createFromLight(scene.getMainLight().direction, scene);  
            mat4.copy(this._coarseLightMatrix, this._lightCamera.vpMatrix);
            this.lightMatrix = this._coarseLightMatrix;
            this._lightCamera.setBimCullingEnabled(true);
        }
        
        renderer.clear(this._renderTargets[0], gl.DEPTH_BUFFER_BIT);
        this._opaques.render(this._renderTargets[0], renderer, null, this._lightCamera);
        this._maskeds.render(this._renderTargets[0], renderer, null, this._lightCamera);

        if (Globals.isMobile || this.fine) {
            this.shadowMap = this._renderTargets[0].getDepthBuffer();
        } else {
            this._blit.render(renderer, this._renderTargets[1]);
            this.shadowMap = this._renderTargets[1].getColorBuffer();
        }
    };
     
    Shadow.prototype.useFineShadow = function(renderer, renderScene, enabled) {
        if (this.fine !== enabled) {
            this.fine = enabled;

            if (!this.fine) {
                this.update(renderer, renderScene);
            }
        }
    };

    Shadow.prototype.onSceneChanged = function() {
        var scene = this._scene;

        this._opaques.queue.removeDrawables();
        this._maskeds.queue.removeDrawables();

        if (scene.model !== null) {
            var m = scene.model;
            for (var i = 0, len = m.drawables.length; i < len; ++i) {
                var drawable = m.drawables[i];
                this._opaques.queue.addDrawable(drawable);
                this._maskeds.queue.addDrawable(drawable);
            }

            var cullFace = (scene.needRenderDoubleSided()? false : gl.CCW);
            this._opaques.setCullFace(cullFace);
            this._maskeds.setCullFace(cullFace);
            
            this._opaques.queue.optimize();
            this._maskeds.queue.optimize();
        }
    };
    
    Shadow.prototype.setShadowCamera = function(camera) {
        this._camera = camera;
    };

    return Shadow;
})();
    
