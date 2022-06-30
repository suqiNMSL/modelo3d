// m3d_render_scene.js
// The renderer of the main scene
//
//  


import Globals         from "../m3d_globals.js";
import profiling       from "../m3d_profiling.js"; 
import ShaderLibrary   from "../02resource/m3d_shader_library.js";
import SkyBox          from "../03scene/drawables/m3d_skybox.js";
import Blit            from "./m3d_blit.js";
import SSAO            from "./m3d_ssao.js";
import Shadow          from "./m3d_shadow.js";
import Sketch          from "./m3d_sketch.js";
import OIT             from "./m3d_oit.js";
import RenderTarget    from "./m3d_rendertarget.js";
import RenderQueue     from "./m3d_renderqueue.js";
import RenderPass      from "./m3d_renderpass.js";
import RenderNodes  from "./m3d_rendernodes.js"
import SAMPLES         from "./m3d_samples.js";


export default (function() {
    "use strict";

    function RenderScene(scene, resourceManager, renderer, camera) {

        // private:
        this._opaques      = new RenderPass(scene, false, true, { transparent: false, line: false, mask: false }); // solid objects
        this._maskeds      = new RenderPass(scene, false, true, { mask: true }); // solid object with alpha testing
        this._transparents = new RenderPass(scene, true, true, { transparent: true, line: false, mask: false });
        this._lines        = new RenderPass(scene, false, true, { line: true }); // lines
        this._tiles        = new RenderPass(scene, false, true, { transparent: false, line: false, maks: false }); // tiles
        
        // elements to be render
        this._elements      = new RenderNodes(scene);
        
        // Rendering flags
        this._flags = {
            section:            false, // Clipping
            shadow:             false, // Render the shadow
            bbox:               false, // Render the bbox wireframe
            ao:                 false, // Ambient occlusion
            sketch:             false, // Sketch effect
            sketchcolor:        false, // Sketch effect in color
            specular:           false, // Specular
            gamma:              false, // Gamma correction
            oit:                false, // Order independent transparency
            alphatest:          false, // alpha test
            elements:           false, // render elements flag
            line:               false  // rendering line flag
        };
        this._scene           = scene;
        this._resourceManager = resourceManager;
        this._renderer        = renderer;
        this._renderTargets   = [];
        this._blit            = new Blit(resourceManager);

        this._shadow = new Shadow(scene, resourceManager, camera);
        this._ao     = new SSAO(scene, resourceManager);
        this._sketch = new Sketch(scene, resourceManager);
        this._oit    = new OIT(scene, resourceManager);

        this._prFrame         = 0;      // current progressive rendering frame
        this._prSkipFrames    = -1;     // now only use skip frames in screenshot process
        this._PR_MAX_FRAMES   = 16;     // the length of progressive rendering 
                                        // TODO: we could refactor progressive rendering to parameter controlled 
                                        // calculate samples and frames to generate 16 frames for aa and ao
        this._prSampleRTs     = [];
        this._prAccumRTs      = [];
        this._prAccumPass     = null;

        this._bboxMaterial = null;

        // initialization:
        this._renderTargets.push(new RenderTarget("default", this._resourceManager,
                Globals.width, Globals.height, {blend: false}));

        this._renderTargets.push(new RenderTarget("default", this._resourceManager,
                Globals.width, Globals.height, { blend: true}));

        this._renderTargets.push(new RenderTarget("default", this._resourceManager,
                Globals.width, Globals.height, { blend: true, depthMask: false }));

        this._renderTargets.push(new RenderTarget("default", this._resourceManager,
                Globals.width, Globals.height, { depthFunc: gl.LEQUAL }));

        this._prSampleRTs.push(new RenderTarget("pr-sample", this._resourceManager,
                Globals.width, Globals.height, {
                    blend: false,
                    colorFilter: gl.NEAREST,
                    depthBuffer: 0 
                }));

        this._prSampleRTs.push(new RenderTarget("pr-sample", this._resourceManager,
                Globals.width, Globals.height, {
                    blend: true,
                    colorFilter: gl.NEAREST,
                    depthBuffer: 0 
                }));

        this._prSampleRTs.push(new RenderTarget("pr-sample", this._resourceManager,
                Globals.width, Globals.height, {
                    blend: true,
                    depthMask: false,
                    colorFilter: gl.NEAREST,
                    depthBuffer: 0 
                }));

        this._prSampleRTs.push(new RenderTarget("pr-sample", this._resourceManager,
                Globals.width, Globals.height, {
                    depthFunc: gl.LEQUAL,
                    colorFilter: gl.NEAREST,
                    depthBuffer: 0 
                }));

        this._prAccumRTs.push(new RenderTarget("pr-accum0", this._resourceManager,
                Globals.width, Globals.height, {
                    // FIXME: using RGBA32F will provide better image quality at the cost of memory.
                    //colorFormat: modelo3d.isFirefox? "RGBA32F": "RGB32F",
                    blend: false,
                    depthTest: false,
                    colorFilter: gl.NEAREST,
                    depthBuffer: 0 
                }));

        this._prAccumRTs.push(new RenderTarget("pr-accum1", this._resourceManager,
                Globals.width, Globals.height, {
                    // FIXME: using RGBA32F will provide better image quality at the cost of memory.
                    //colorFormat: modelo3d.isFirefox? "RGBA32F": "RGB32F",
                    blend: false,
                    depthTest: false,
                    colorFilter: gl.NEAREST,
                    depthBuffer: 0 
                }));

        this._prAccumBlit = new Blit(this._resourceManager, ShaderLibrary["accumulate"]);
    };

    RenderScene.prototype.destroy = function() {
        this._shadow.destroy();
        this._ao.destroy();
        this._oit.destroy();
        this._sketch.destroy();

        for (var i = 0; i < 4; i++) {
            this._renderTargets[i].destroy();
            this._prSampleRTs[i].destroy();
        }

        delete this._renderTargets;
        delete this._prSampleRTs;

        this._prAccumRTs[0].destroy();
        this._prAccumRTs[1].destroy();
        delete this._prAccumRTs;

        this._prAccumBlit.destroy();

        this._opaques.destroy();
        this._opaques = null;
        delete this._opaques;

        this._maskeds.destroy();
        this._maskeds = null;
        delete this._maskeds;

        this._transparents.destroy();
        this._transparents = null;
        delete this._transparents;

        this._lines.destroy();
        this._lines = null;
        delete this._lines;
    };

    RenderScene.prototype.resize = function(width, height) {
        var i;
        for (i = 0; i < this._renderTargets.length; i++) {
            this._renderTargets[i].resize(width, height);
        }

        for (i = 0; i < this._prSampleRTs.length; i++) {
            this._prSampleRTs[i].resize(width, height);
        }

        for (i = 0; i < this._prAccumRTs.length; i++){
            this._prAccumRTs[i].resize(width, height);
        }

        this._ao.resize(width, height);
        this._sketch.resize(width, height);
        this._oit.resize(width, height);

        if (this._scene.background.skybox) {
            this._scene.background.skybox.resize(width, height);
        }
    };

    // this function will return a value indicate if rendering converges. 1 if not yet, and 0 for yes.
    RenderScene.prototype.draw = function(leftCamera, rightCamera, renderTargets) {
        var scene = this._scene;

        renderTargets = renderTargets || this._renderTargets;

        // Set the background color
        // Since 1.0.0 we have a advertisement background which will only render part of the canvas
        // We need to update the target color and take the skybox case into consideration
        if (scene.background.mode == SkyBox.SKYBOX_SOLIDCOLOR) {
            renderTargets[0].setClearColor(scene.background.color);
            this._prSampleRTs[0].setClearColor(scene.background.color);
        }

        // No progressive rendering in VR mode
        if (!this._flags.progressive || rightCamera) {
            this._renderer.clear(renderTargets[0], gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            this._drawView(renderTargets, leftCamera);
            if (rightCamera) {
                // For normal render process, renderer will clear the shader and render target
                // at the end of render pass ends, however, for vr, it will do the render twice in
                // a single call, so we need to force to end the first render(left camera) and start
                // the right camera again.
                this._renderer.endFrame();
                this._renderer.beginFrame();
                this._drawView(renderTargets, rightCamera);
            }
        } else {
            while (this._prFrame < this._prSkipFrames) {
               this._drawViewProgressively(leftCamera);
               this._prFrame++;
            }

            // Do progressive frame for this pass
            this._drawViewProgressively(leftCamera);
            gl.syncGPU();

            this._prFrame++;
            
            // Only present the first and final rendering result to the render target.
            // This is to avoid the ssao converge problem
            if (this._prFrame === 16) {
                this._blit.setTexture(this._prAccumRTs[this._prFrame % 2].getColorBuffer());
                this._blit.render(this._renderer, renderTargets[0]);
            }
            return this._prFrame < this._PR_MAX_FRAMES? 1 : 0;
        }

        return 0;
    };

    RenderScene.prototype._drawView = function(renderTargets, camera) {
        if (this._flags.elements) {
            this._elements.render(renderTargets, this._renderer, this._shadow, camera);
        }
        
        if (this._flags.line) {
            this._lines.render(renderTargets[0], this._renderer, this._shadow, camera);
        }
        
        this._opaques.render(renderTargets[0], this._renderer, this._shadow, camera);
        
        this._maskeds.render(renderTargets[0], this._renderer, this._shadow, camera);

        // Render AO for opaque drawables to the current render targets.
        if (this._flags.ao) {
            if (this._flags.section) {
                this._renderer.renderState.invalidateClip();  
            }
            this._ao.render(this._renderer, camera, renderTargets[0], this._prFrame);
        }

        this._tiles.render(renderTargets[0], this._renderer, this._shadow, camera);
        
        // Sketch effect filter
        if (this._flags.sketch) {
            this._sketch.render(this._renderer, camera, renderTargets[0]);
        }

        // Draw the skybox at the end
        if (this._scene.background.skybox && this._scene.background.skybox.enabled) {
            this._scene.background.skybox.update(camera.viewMatrix);
            this._renderer.drawSkybox(renderTargets[3], this._scene.background.skybox, this._scene.background.skybox.camera);
        }

        // Render transparents
        if (this._flags.oit && !Globals.isMobile && !this._flags.sketch) {
            this._oit.render(this._renderer, this._scene, camera, renderTargets[2]);
        } else {
            this._transparents.render(renderTargets[2], this._renderer, this._shadow, camera);
        }
    };

    RenderScene.prototype._drawViewProgressively = function(camera) {
        // AA: jitter the projection matrix to do AA stuff.
        var dx = SAMPLES._4X4[this._prFrame*2] - 0.5;
        var dy = SAMPLES._4X4[this._prFrame*2+1] - 0.5;

        this.updateShadow();

        // Jitter the camera a few subpixels
        camera.jitter(dx / Globals.width, dy / Globals.height);
        mat4.multiply(camera.vpMatrix, camera.projectMatrix, camera.viewMatrix);
        this._renderer.clear(this._prSampleRTs[0], gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        this._drawView(this._prSampleRTs, camera);
        
        // Restore the camera
        if (camera.isPerspective()) {
            camera.jitter(0, 0);
        } else {
            camera.jitter(-dx / Globals.width, -dy / Globals.height);
        }

        // Accumulate with previous frame.
        this._prAccumBlit.setTexture(this._prAccumRTs[this._prFrame % 2].getColorBuffer());
        this._prAccumBlit.setParameter("uTexture0", this._prSampleRTs[0].getColorBuffer());
        this._prAccumBlit.setParameter("uFrameCount", this._prFrame + 1);
        this._prAccumBlit.render(this._renderer, this._prAccumRTs[1 - this._prFrame % 2]);
    };

    RenderScene.prototype.isProgressiveEnabled = function() {
        return this._flags.progressive;
    };

    RenderScene.prototype.setLineRendering = function(enabled) {
        this._flags.line = enabled;
    };
    
    RenderScene.prototype.setElementsEnabled = function(enabled) {
        this._flags.elements = enabled;
    };

    RenderScene.prototype.setRenderNodesMateterial= function(nodes, color, type) {
        var overridedShaders = null;
        var overridedMaterial = null;
        if (color) {
            var flags = [];
            flags.push("MODEL_TRANSFORM");
            if (this._scene.needRenderDoubleSided()) {
                flags.push("DOUBLESIDED");
            }
            if (this._flags.shadow) {
                flags.push("SHADOW");
            }
            if (this._flags.section) {
                flags.push("CLIPPING");
            }
            if (this._flags.specular) {
                flags.push("SPECULAR");
            }
            if (this._flags.gamma) {
                flags.push("GAMMA");
            }
            if (Globals.isMobile) {
                flags.push("MOBILE");
            }
            if (this._scene.compressed) {
                flags.push("COMPRESSION");
            }
            overridedShaders = [];
            var shader = this._resourceManager.getShader("solid", flags);
            if (!shader.ready) {
                var shaderSource = ShaderLibrary["solid"];
                shader.createFromShaderSource(shaderSource, flags);
            }
            overridedShaders[0] = shader;
            
            shader.flags.push("MODEL_TRANSFORM");
            var shader1 = this._resourceManager.getShader(shader.shaderSource.name, flags);
            if (!shader1.ready) {
                shader1.createFromShaderSource(shader.shaderSource, flags);
            }
            overridedShaders[1] = shader1;
            
            flags.push("INSTANCING");
            var shader2 = this._resourceManager.getShader(shader.shaderSource.name, flags);
            if (!shader2.ready) {
                shader2.createFromShaderSource(shader.shaderSource, flags);
            }
            overridedShaders[2] = shader2;
            
            var overridedMaterial = this._scene.materialManager.createMaterialAdhoc(color);
            overridedMaterial.attachShader(overridedShaders[0]);
            overridedMaterial.setDiffuse(color);
            overridedMaterial.setTransparent(color[3]);
        }
        this._elements.setRenderNodesMateterial(nodes, overridedShaders, overridedMaterial, type);
    };
    
    RenderScene.prototype.clearRenderNodes = function(type) {
        this._elements.clearRenderNodes(type);
    };
    
    RenderScene.prototype.setElementsColor = function(elements, color) {
        this.clearRenderNodes(RenderNodes.GROUP);

        var nodes = [];
        for (var i = 0, len = elements.length; i < len; i++) {
            var elementName = elements[i];
            var element = this._scene.graph.elements[elementName];
            var _nodes = element.getNodes();
            
            for (var j = 0, len2 = _nodes.length; j < len2; j++) {
                nodes.push(_nodes[j]);
            }
        }

        this.setRenderNodesMateterial(nodes, color, RenderNodes.GROUP);
        this.adjustOverrideStatus();
    };
    
    
    RenderScene.prototype.setElementsVisibility = function(elements, visibility) {
        var nodes = [];
        for (var i = 0, len = elements.length; i < len; i++) {
            var elementName = elements[i];
            var element = this._scene.graph.elements[elementName];
            var _nodes = element.getNodes();
            for (var j = 0, len2 = _nodes.length; j < len2; j++) {
                nodes.push(_nodes[j]);
            }
        }

        var drawables = {};

        for (var i = 0; i < nodes.length; i++) {
            nodes.visible = visibility;
            if (!drawables[nodes.drawable.name]) {
                drawables[nodes.drawable.name] = nodes.drawable;
            }
        }
        for (var name in drawables) {
            drawables[name].updateVisibility();
        }
    };

    RenderScene.prototype.adjustOverrideStatus = function() {
        if (this._flags.elements && this._elements.isRenderable()) { 
            this.setOverridedShader("solid");
            this.setOverridedMaterial([1, 1, 1, 0.4]);
        } else {
            this.setOverridedShader(null);
            this.setOverridedMaterial(null);
        }
    };

    RenderScene.prototype.setProgressiveEnabled = function(enabled) {
        if (this._flags.progressive === enabled) {
            return;
        }

        this._flags.progressive = enabled;
        this._renderer.renderState.invalidateShadow();

        if (enabled) {
            this.useFineShadow(true);
            this._prFrame = 0;
            this._renderer.clear(this._prAccumRTs[0], gl.COLOR_BUFFER_BIT);
            this._renderer.clear(this._prAccumRTs[1], gl.COLOR_BUFFER_BIT);
        } else {
            this.setAOEnabled(false);
            this.useFineShadow(false);
        }
    };

    RenderScene.prototype.updateShadow = function(forceUpdate) {
        if (this._flags.shadow || forceUpdate) {
            this._shadow.update(this._renderer, this._flags.progressive? this._prFrame : null);
            this._renderer.renderState.invalidateShadow();
        }
    };

    RenderScene.prototype.useFineShadow = function(enabled) {
        this._shadow.useFineShadow(this._renderer, this, enabled);
    };
    
    RenderScene.prototype.setShadowCamera = function(camera) {
        this._shadow.setShadowCamera(camera);
    };

    RenderScene.prototype.setShadowEnabled = function(enabled) {
        if (this._flags.shadow !== enabled) {
            this._flags.shadow = enabled;

            var states = {
                "doubleSided": this._scene.needRenderDoubleSided(),
                "shadow": this._flags.shadow,
                "section": this._flags.section,
                "specular": this._flags.specular,
                "gamma": this._flags.gamma
            };
            this._recompileShaders(states);
        }
    };
    
    RenderScene.prototype.setOITEnabled = function(enabled) {
        if (enabled) {
            this._oit.onSceneChanged(this._scene);
        }

        this._flags.oit = enabled;
    };

    // Override the all drawables material with certain color and transparency (rgba).
    RenderScene.prototype.setOverridedMaterial = function(color, transparentColor, lineColor) {
        if (color) {
            var overridedMaterialOpaque = this._scene.materialManager.createMaterialAdhoc("modelo3d-global-overrided-opaques");
            this._opaques.setOverridedMaterial(overridedMaterialOpaque);
            overridedMaterialOpaque.setDiffuse(color);
            overridedMaterialOpaque.setTransparent(color[3]);

            var overridedMaterialMasked = this._scene.materialManager.createMaterialAdhoc("modelo3d-global-overrided-maskeds");
            this._maskeds.setOverridedMaterial(overridedMaterialMasked);
            overridedMaterialMasked.setDiffuse(color);
            overridedMaterialMasked.setTransparent(color[3]);

            var overridedMaterialTransparent = this._scene.materialManager.createMaterialAdhoc("modelo3d-global-overrided-transparents");
            this._transparents.setOverridedMaterial(overridedMaterialTransparent);
            this._oit.setOverridedMaterial(overridedMaterialTransparent);
            color = transparentColor || color;
            overridedMaterialTransparent.setDiffuse(color);
            overridedMaterialTransparent.setTransparent(color[3]);

            var overridedMaterialLine = this._scene.materialManager.createMaterialAdhoc("modelo3d-global-overrided-line");
            this._lines.setOverridedMaterial(overridedMaterialLine);
            color = lineColor || color;
            overridedMaterialLine.setDiffuse(color);
            overridedMaterialLine.setTransparent(color[3]);
        } else {
            this._opaques.setOverridedMaterial(null);
            this._maskeds.setOverridedMaterial(null);
            this._lines.setOverridedMaterial(null);
            this._transparents.setOverridedMaterial(null);
            this._oit.setOverridedMaterial(null);
        }
            
        // Whenever the scene changes, we need to invalidate the renderer.
        this._renderer.invalidate();
    };

    RenderScene.prototype.setOverridedShader = function(shaderType) {
        if (shaderType) {

            var flags = [];
            flags.push("MODEL_TRANSFORM");
            if (this._scene.needRenderDoubleSided()) {
                flags.push("DOUBLESIDED");
            }
            if (this._flags.shadow) {
                flags.push("SHADOW");
            }
            if (this._flags.section) {
                flags.push("CLIPPING");
            }
            if (this._flags.specular) {
                flags.push("SPECULAR");
            }
            if (this._flags.gamma) {
                flags.push("GAMMA");
            }
            if (Globals.isMobile) {
                flags.push("MOBILE");
            }
            if (this._scene.compressed) {
                flags.push("COMPRESSION");
            }
            
            var overridedShader = this._resourceManager.getShader(shaderType, flags);
            if (!overridedShader.ready) {
                var shaderSource = ShaderLibrary[shaderType];
                overridedShader.createFromShaderSource(shaderSource, flags);
            }
            this._opaques.setOverridedShader(overridedShader);
            this._transparents.setOverridedShader(overridedShader);
            this._oit.setOverridedShader(overridedShader);
            this._lines.setOverridedShader(overridedShader);

            flags.push("ALPHATEST");
            overridedShader = this._resourceManager.getShader(shaderType, flags);
            if (!overridedShader.ready) {
                var shaderSource = ShaderLibrary[shaderType];
                overridedShader.createFromShaderSource(shaderSource, flags);
            }
            this._maskeds.setOverridedShader(overridedShader);
        } else {
            this._opaques.setOverridedShader(null);
            this._transparents.setOverridedShader(null);
            this._oit.setOverridedShader(null);
            this._lines.setOverridedShader(null);
            this._maskeds.setOverridedShader(null);
        }
    };

    RenderScene.prototype.setGammaEnabled = function(enabled) {
        if (this._flags.gamma !== enabled) {
            this._flags.gamma = enabled;

            var states = {
                "doubleSided": this._scene.needRenderDoubleSided(),
                "shadow": this._flags.shadow,
                "section": this._flags.section,
                "specular": this._flags.specular,
                "gamma": this._flags.gamma
            };
            this._recompileShaders(states);
        }
    };

    RenderScene.prototype.setSpecularEnabled = function(enabled) {
        if (this._flags.specular !== enabled) {
            this._flags.specular = enabled;
            var states = {
                "doubleSided": this._scene.needRenderDoubleSided(),
                "shadow": this._flags.shadow,
                "section": this._flags.section,
                "specular": this._flags.specular,
                "gamma": this._flags.gamma
            };
            this._recompileShaders(states);
        }
    };

    RenderScene.prototype.setBBoxEnabled = function(enabled) {
        this._flags.bbox = enabled;  
    };
    
    RenderScene.prototype.isShadowEnabled = function() {
        return this._flags.shadow;
    };

    RenderScene.prototype.setHatchingEnabled = function(enabled) {
        if (enabled) {
            var states = {
                "doubleSided": this._scene.needRenderDoubleSided(),
                "shadow": this._flags.shadow,
                "section": this._flags.section
            };

            this._hatching.recompileShader(this._resourceManager, states);
            this._hatching.bind(this);
        } else {
            this._hatching.unbind(this);
        }
    };

    RenderScene.prototype.setCartoonEnabled = function(enabled) {
        if (enabled) {
            var states = {
                "doubleSided": this._scene.needRenderDoubleSided(),
                "shadow": this._flags.shadow,
                "section": this._flags.section
            };

            this._cartoon.recompileShader(this._resourceManager, states);
            this._cartoon.bind(this);
        } else {
            this._cartoon.unbind(this);
        }
    };

    RenderScene.prototype.setSectionEnabled = function(enabled) {
        if (this._flags.section !== enabled) {
            this._flags.section = enabled;

            var states = {
                "doubleSided": this._scene.needRenderDoubleSided(),
                "shadow": this._flags.shadow,
                "section": this._flags.section,
                "specular": this._flags.specular,
                "gamma": this._flags.gamma
            };
            this._recompileShaders(states);
            this._shadow.recompileShader(this._resourceManager, states);
            this._shadow.update(this._renderer);
            this._ao.recompileShader(this._resourceManager, states);
            this._sketch.recompileShader(this._resourceManager, states);
        }
    };

    RenderScene.prototype.isSectionEnabled = function() {
        return this._flags.section;
    };

    RenderScene.prototype.isSketchEnabled = function() {
        return this._flags.sketch;
    };

    RenderScene.prototype.setSketchEnabled = function(enabled) {
        if (this._flags.sketch !== enabled) {
            this._flags.sketch = enabled;

            this.setSketchColorEnabled(this._flags.sketchcolor);

            // Always disable the overrided materials when sketch is false.
            if (!this._flags.sketch) {
                this.setOverridedShader(null);
                this.setOverridedMaterial(null);
            }
        }
    };

    RenderScene.prototype.getSketch = function () {
        return this._sketch;
    };

    RenderScene.prototype.setSketchContrast = function(contrast) {
        if (!this._flags.sketch) {
            return console.warn("Sketch is not enabled.");
        }

        if (!this._flags.sketchcolor) {
            var c = 1.0 - contrast * 0.01;
            //this._lines._overridedMaterial.setDiffuse([c, c, c]);
        }
        this._sketch.setContrast(contrast);
    };

    RenderScene.prototype.setSketchDetailLevel = function(detail) {
        if (!this._flags.sketch) {
            return console.warn("Sketch is not enabled.");
        }
        this._sketch.setDetail(detail);
    };

    // true for colored sketch and B/W otherwise.
    RenderScene.prototype.setSketchColorEnabled = function(enabled) {
        this._flags.sketchcolor = enabled;

        if (this._flags.sketch) {
            var states = {
                "doubleSided": this._scene.needRenderDoubleSided(),
                "section": this._flags.section
            };
            this._sketch.recompileShader(this._resourceManager, states);

            if (this._flags.sketchcolor) {
                this.setOverridedShader(null);
                this.setOverridedMaterial(null);
            } else {
                this.setOverridedShader("solid");
                this.setOverridedMaterial([1, 1, 1, 1], [1, 1, 1, 0.27], [0, 0, 0, 1]);
            }
        }
    };
    
    RenderScene.prototype.getSketch = function () {
        return this._sketch;
    };

    RenderScene.prototype.setAOEnabled = function(enabled) {
        this._flags.ao = enabled;
    };

    RenderScene.prototype.updateAO = function() {
        var states = {
            "doubleSided": this._scene.needRenderDoubleSided(),
            "section": this._flags.section
        };

        this._ao.recompileShader(this._resourceManager, states);
    };

    RenderScene.prototype.isAOEnabled = function() {
        return this._flags.ao;
    };

    RenderScene.prototype.addModelDrawable = function(drawable) {
        this._lines.queue.addDrawable(drawable);
        this._opaques.queue.addDrawable(drawable);
        this._maskeds.queue.addDrawable(drawable);
        this._transparents.queue.addDrawable(drawable);
    };

    RenderScene.prototype.addTerrainDrawable = function(drawable) {
        this._tiles.addDrawable(drawable);
    };

    RenderScene.prototype.onSceneChanged = function() {
        this._lines.queue.removeDrawables();
        this._opaques.queue.removeDrawables();
        this._maskeds.queue.removeDrawables();
        this._transparents.queue.removeDrawables();
        this._tiles.queue.removeDrawables();

        if (this._scene.model !== null) {
            var s = this._scene.model;
            for (var i = 0, len = s.drawables.length; i < len; i++) {
                // addModelDrawable
                this._lines.queue.addDrawable(s.drawables[i]);
                this._opaques.queue.addDrawable(s.drawables[i]);
                this._maskeds.queue.addDrawable(s.drawables[i]);
                this._transparents.queue.addDrawable(s.drawables[i]);
            }
        }
        if (this._scene.terrain != null) {
            var t = this._scene.terrain;
            for (var i = 0, len = t.tiles.length; i < len; i++) {
                // addTerrainDrawable
                this._tiles.queue.addDrawable(t.tiles[i].drawable);
            }
        }

        this._opaques.queue.optimize();
        this._maskeds.queue.optimize();
        this._lines.queue.optimize();

        this._shadow.onSceneChanged();
        this._sketch.onSceneChanged();
        this._ao.onSceneChanged(this._scene);
        this._oit.onSceneChanged(this._scene);

        var cullFace = (this._scene.needRenderDoubleSided()? false : gl.CCW);

        this._opaques.setCullFace(cullFace);
        this._maskeds.setCullFace(cullFace);
        this._lines.setCullFace(false);
        this._transparents.setCullFace(cullFace);
        this._tiles.setCullFace(false);

        // FIXME: how can we change scene data here.
        this._scene.hasCurveOrLine = this._scene.hasCurveOrLine && this._lines.isValid();
    };

    // When the rendering setting has changed, we need to update the shaders
    // of materials to minimize the shader instructions.
    RenderScene.prototype._recompileShaders = function(states) {
        if (this._scene.model) {
            var s = this._scene.model.drawables;
            for (var i = 0, len = s.length; i < len; i++) {
                this._recompileModelDrawableShader(s[i], states);
            }
        }
        if (this._scene.terrain) {
            var t = this._scene.terrain.tiles;
            for (var i = 0, len = t.length; i < len; i++) {
                this._recompileTerrainDrawableShader(t[i].drawable, states);
            }
        }
            
        var flags = [];

        flags.push("MODEL_TRANSFORM");
        if (states.doubleSided) {
            flags.push("DOUBLESIDED");
        }
        if (states.shadow) {
            flags.push("SHADOW");
        }
        if (states.section) {
            flags.push("CLIPPING");
        }
        if (states.specular) {
            flags.push("SPECULAR");
        }
        if (states.gamma) {
            flags.push("GAMMA");
        }
        if (Globals.isMobile) {
            flags.push("MOBILE");
        }
        if (this._scene.compressed) {
            flags.push("COMPRESSION");
        }
        this._opaques.recompileOverridedShader(this._resourceManager, flags);
        this._transparents.recompileOverridedShader(this._resourceManager, flags);
        this._lines.recompileOverridedShader(this._resourceManager, flags);

        this._oit.recompileShader(this._resourceManager, flags);

        flags.push("ALPHATEST");
        this._maskeds.recompileOverridedShader(this._resourceManager, flags);

        this._renderer.invalidate();
    };

    RenderScene.prototype._recompileModelDrawableShader = function(drawable, states) {
        var flags = [];

        if (drawable.isInstancing()) {
            flags.push("INSTANCING");
        }
        if (!drawable.transform.identity) {
            flags.push("MODEL_TRANSFORM");
        }
        if (states.doubleSided &&
            !(drawable.material.transparent === "transparent")) {
            flags.push("DOUBLESIDED");    
        }
        if (states.shadow && !(drawable.material.transparent === "transparent") && drawable.isShadowReceiver) {
            flags.push("SHADOW");
        }
        if (states.section) {
            flags.push("CLIPPING");
        }
        if (states.gamma) {
            flags.push("GAMMA");
        }
        if (states.specular) {
            flags.push("SPECULAR");
        }
        if (Globals.isMobile) {
            flags.push("MOBILE");
        }
        if (drawable.material.hasTexture && drawable.material.hasMask) {
            flags.push("ALPHATEST");
        }
        if (this._scene.compressed) {
            flags.push("COMPRESSION");
        }
        var shaderType = drawable.shader.shaderSource.name;

        var shader = this._resourceManager.getShader(shaderType, flags);
        if (!shader.ready) {
            var shaderSource = ShaderLibrary[shaderType];
            shader.createFromShaderSource(shaderSource, flags);
            if (!shader.ready) {
                throw "modelo3d error at creating shader '" + shaderType + "'!";
            }
        }           
        
        // Rebind the drawable's shader
        drawable.shader = shader;
        // Rebind the material's shader 
        drawable.material.attachShader(shader);
    };

    RenderScene.prototype._recompileTerrainDrawableShader = function(drawable, states) {
        var flags = [];

        flags.push("MODEL_TRANSFORM");
        if (states.section) {
            flags.push("CLIPPING");
        }
        
        //if (states.doubleSided &&
        //    !(drawable.material.transparent === "transparent")) {
        //    flags.push("DOUBLESIDED");    
        //}
        var shaderType = drawable.shader.shaderSource.name;

        var shader = this._resourceManager.getShader(shaderType, flags);
        if (!shader.ready) {
            var shaderSource = ShaderLibrary[shaderType];
            shader.createFromShaderSource(shaderSource, flags);
            if (!shader.ready) {
                throw "modelo3d error at creating shader '" + shaderType + "'!";
            }
        }           
        
        // Rebind the drawable's shader
        drawable.shader = shader;
        // Rebind the material's shader 
        drawable.material.attachShader(shader);
    };

    RenderScene.prototype.setProgressiveRenderingLatency = function(latency) {
        this._prSkipFrames = latency;
    };

    return RenderScene;
})();
    
