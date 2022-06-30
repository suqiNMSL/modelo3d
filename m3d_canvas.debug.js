//
// m3d_canvas.debug.js
// Debug utilities in canvas
//
//  


import Globals       from "./m3d_globals.js";
import profiling     from "./m3d_profiling.js";
import Utils         from "./00utility/m3d_utils.js";
import SetupWebGL    from "./01wrapper/m3d_wgl.debug.js";
import SkyBox        from "./03scene/drawables/m3d_skybox.js";
import Material      from "./03scene/materials/m3d_material.js";
import RenderTarget  from "./04renderer/m3d_rendertarget.js";
import Axis          from "./06debug/m3d_axis.debug.js";
import TextureViewer from "./06debug/m3d_texture_viewer.debug.js";
import HUD           from "./08ui/tool/m3d_hud.debug.js";
import Canvas360     from "./m3d_canvas_360.js";
import Canvas        from "./m3d_canvas.js";
import modelo3dtest  from "./tests/index.js";
import ShaderLibrary from "./02resource/m3d_shader_library.js";

export default (function() {
    "use strict";
    
    Canvas.prototype._setupWebGL = function(isMobile, browserName, browserVersion) {
        // TODO: enable WebGL2 for webvr Globals.webvr 
        var useWebGL2 = true;
        
        var useVAO = true;
        if (browserName === "chrome" && browserVersion === "62") {
            // We have disable VAO for this buggy Chrome version
            useVAO = false;
        }

        // gl is defined in global name space.
        gl = SetupWebGL(this.canvas, {
            depth                 : true,
            alpha                 : false,   // disable the blend with DOM behind canvas
            //premultipliedalpha  : false,
            antialias             : true,
            stencil               : false,
            preserveDrawingBuffer : true,
            vao                   : useVAO,
            instancing            : false,
            webgl2                : useWebGL2
        });

        if (gl !== null) {
            var glversion = gl.isWebGL2? "2.0" : "1.0";

            console.group("A WebGL " + glversion + " context created");
            console.log("  color: RGBA, depth: enabled, stencil: disabled");
            console.log("  VAO: " + (useVAO? "enabled" : "disabled"));
            console.log("  Instancing: " + (gl.instancingExtension? "enabled" : "disabled"));
            console.groupEnd("A WebGL " + glversion + " context created");
        }
    };
    
    Canvas.prototype._initializeDebug = function() {
        // Print all current configuration.
        console.group("Engine parameters");
        console.log("webvr: " + (Globals.webvr? "yes" : "no"));
        console.log("syncLoading: " + (Globals.syncLoading? "yes" : "no"));
        console.groupEnd("Engine parameters");

        this._textureViewer = new TextureViewer(this._resourceManager);
        this._textureViewer.setEnabled(true);

        this._hud = new HUD();

        this._axis = new Axis(this._resourceManager);
        this._axis.setEnabled(false);

        this._testObject = null;
        this._test = "";

        this._roomDebug = false;

        this._elapsedFrames = 0;
        
        //this._roomRenderTarget = new RenderTarget("default", this._resourceManager,
        //        Globals.width, Globals.height, { blend: true, depthTest: false });
        this._roomRenderTarget = new RenderTarget("default", this._resourceManager,
                Globals.width, Globals.height, {});

        var $q = Globals.frontendCallbacks.getPromiseLibrary();
        
        // Override the loading of canvas if test is enabled.
        if (!modelo3dtest.configs["default"]) {
            var that = this;
            this.load = function(modelInformation, promises, cameraInfo, sectionInfo) {
                var deferred = $q.defer();

                that.state = modelo3d.LOADING;
                that._scene.id = modelInformation.modelId;

                that._eventEmitter.emit("loadingPhase1Done", modelInformation);

                if (that._loadDebug()) {
                    that._stateManager.onSceneChanged();

                    that.state = modelo3d.RENDERING;
                    that._visible = true;
                    that._lazyRendering = true;
                    that._renderScene.onSceneChanged();

                    that._refreshRendering();
                    that._eventEmitter.emit("loadingPhase2Done", modelInformation);

                    deferred.resolve("ok");
                } else {
                    that._visible = false;

                    deferred.resolve("error");
                }

                return deferred.promise;
            }; 
        }

        // Find the active test in the config
        var test = "";
        for (test in modelo3dtest.configs) {
            if (modelo3dtest.configs[test]) {
                break;
            }
        }
        this._test = test;

        // Create the test object.
        if (this._test !== "default") {
            this._testObject = new modelo3dtest[test](this);

            // Replace the canvas's renderScene object if necessary
            if (this._testObject["renderScene"]) {
                this.renderScene = this._testObject.renderScene.bind(this._testObject);
            }
        }
    };

    var visible1 = false;
    var tx = 10;
    var ty = 10;
    var tz = 10;
    var ta = 0;
    var ts = 1.0;
    
    Canvas.prototype._loadDebug = function() {
        var that = this;

        if (this._test !== "default") {
            this._testObject.bindKeyboard(this.keyboard);
        }
        
        this._normalDebug = {
            enabled :   false,
            shader:     [],
            material:   null
        };
        
        this._normalDebug.material = new Material("scene-normal");
        var shader = [];
        shader[0] = this._resourceManager.getShader("normaldepth", ["WORLDSPACE_NORMAL", "COMPRESSION"]);
        if (!shader[0].ready) {
            var shaderSource = ShaderLibrary["normaldepth"];
            shader[0].createFromShaderSource(shaderSource, ["WORLDSPACE_NORMAL", "COMPRESSION"]);
        }
        
        var resourceManager = shader[0]._manager;

        var flags1 = shader[0].flags.concat("MODEL_TRANSFORM");
        shader[1] = resourceManager.getShader(shader[0].shaderSource.name, flags1);
        if (!shader[1].ready) {
            shader[1].createFromShaderSource(shader[0].shaderSource, flags1);
        }
            
        var flags2 = flags1.concat("INSTANCING");
        shader[2] = resourceManager.getShader(shader[0].shaderSource.name, flags2);
        if (!shader[2].ready) {
            shader[2].createFromShaderSource(shader[0].shaderSource, flags2);
        }
        this._normalDebug.shader = shader;
        
        console.log("<F1> - toggle on/off normal visualization");
        console.log("<F2> - toggle on/off rotatable section box");
        console.log("<F3> - set camera to certain view angle and position");
        console.log("<F4> - toggle on/off webvr");
        console.log("<F6> - toggle on/off room");
        
        this.keyboard.onKeyDownCallback = function(key) {

            switch (key) {
                case 112: // F1
                    that._normalDebug.enabled = !that._normalDebug.enabled;
                    that._refreshRendering();
                    break;
                case 113: // F2
                    that.setTransformGizmoEnabled(true);
                    //that.setSectionRotatable(this._section.isRotatable());
                    break;
                case 114: // F3
                    var dumped = {
                        "height":71.338409,
                        "at":[40.712372, 51.987553, 9.334195],
                        "distance":76.017143,
                        "phi":1.570796,
                        "theta":1.134464,
                    };
                    that._sceneCamera.restore(dumped); 
                    break;
                case 115: // F4
                    if (Globals.webvr) {
                        var canvasResizeCB = that.resize.bind(that);
                        that._webvr.switchPresent(that.canvas, canvasResizeCB, that._sceneCamera);
                    }
                    break;
                case 117: // F6
                    tx += 10;
                    ty += 10;
                    tz += 10;
                    that.setTerrainTranslation(tx, ty, tz);
                    break;
                case 118: // F7
                    ta += 10;
                    that.setTerrainRotation(ta);
                    break;
                case 119: // F8
                    ts += 0.01;
                    that.setTerrainScaling(ts);
                    break;
                case 38: // up arrow
                case 87: // 'w'
                    that._sceneCamera.forward(that._sceneCamera.getViewDirection(), 0.1);
                    that._refreshRendering();
                    break;
                case 40: // down arrow
                case 83: // 's'
                    that._sceneCamera.forward(that._sceneCamera.getViewDirection(), -0.1);
                    that._refreshRendering();
                    break;
                case 37: // left arrow
                case 65: // 'a'
                    that._sceneCamera.pan(0.5, 0);    
                    that._refreshRendering();
                    break;
                case 39: // right arrow
                case 68: // 'd'
                    that._sceneCamera.pan(-0.5, 0);    
                    that._refreshRendering();
                    break;
            }
        };

        // WebVR: press V enter/exit VR mode
        this.keyboard.onKeyUpCallback = function(key) {
            if (key === 86) {
                console.log("Debug: V Pressed, Swith WebVR mode");
                if (Globals.webvr) {
                    var canvasResizeCB = that.resize.bind(that);
                    that._webvr.switchPresent(that.canvas, canvasResizeCB, that._sceneCamera);
                }
            }
        };
        
        
        // FIXME: For debugging:
        //that.setVREnabled(true);

        //this._textureViewer.setTexture(this._changeMaterial._contour._contourRT.getColorBuffer());
        //this._textureViewer.setTexture(this._vr._renderTargetResolve.getColorBuffer());

        //that.cameraManipulator.switchToUserView(that._scene.views["Parallel"]);

        //var image = new Image();
        //image.onload = function() {
        //    that.setBackgroundImage(image);
        //    that.setBackgroundMode(SkyBox.SKYBOX_SKYDOME); // wallpaper mode
        //};
        //image.src = "/model/modelo3d/assets/images/bg.jpg";

        //that.setBBoxEnabled(that._renderScene._flags.bbox);

        //that.setFlipYZEnabled(true);
        //that.setRestrictedViewEnabled(true);
        //console.log("loading phase 2 done");
        //var cameraData = JSON.parse('{"flip":false,"fov":46,"distance":7.174554790498904,"phi":0.5012329251994329,"theta":-1.2443981633974481,"at":[0,0,0]}');
        //that._sceneCamera.restore(cameraData);
        
        return true;
    };

    Canvas.prototype._renderDebugTexture = function() {
        //if (this._renderScene._flags.ao) {
            //if (this._inAppNavigation._renderTarget.getColorBuffer()) {
            //    //this._textureViewer.setTexture(this._renderScene._ao._rt0.getColorBuffer());
            //if(this._inAppNavigation._renderTarget){
            //    this._textureViewer.setTexture(this._inAppNavigation._renderTarget.getColorBuffer());
            //    this._textureViewer.render(this._renderer);
            //    }
        //if (this._renderScene._flags.shadow) {
        //    this._textureViewer.setTexture(this._ruler._fine.rtNormal.getColorBuffer());
        //}
        
        if (this._ruler._snap1 && this._ruler._snap1._rtLine) {
            this._textureViewer.setTexture(this._ruler._snap1._rtLine.getColorBuffer());
            this._textureViewer.render(this._renderer);
        }
    };
    
    Canvas.prototype._renderDebug = function() {
        this._renderStats();
        gl.reset();
        
        if (!Globals.isMobile) {
            // Press F1 to show the normal map since there are a lot of cases is caused by models' error normal info.
            // Which is not a bug.
            if (this._normalDebug && this._normalDebug.enabled) {
                this._renderer.invalidate();
                this._renderer.clear(this._renderScene._renderTargets[0], gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                if (this._scene.model) {
                    this._renderer.drawDrawables(this._renderScene._renderTargets[0], this._scene.model.drawables, this._sceneCamera, 
                        this._normalDebug.shader, this._normalDebug.material, 
                        this._scene.clipping, null, null, false);                
                }
                if (this._scene.terrain) {
                    this._renderer.drawDrawables(this._renderScene._renderTargets[0], this._scene.terrain.drawables, this._sceneCamera, 
                        this._normalDebug.shader, this._normalDebug.material, 
                        this._scene.clipping, null, null, false);    
                }
                
                
            }

            this._renderDebugTexture();

            if (this._roomDebug) {
                this._renderRooms();
            }

            if (this._test !== "default") {
                this._testObject.update();
            }
            
            this._axis.render(this._scene, this._renderer, this._sceneCamera);        

        }
    };
    
    Canvas.prototype._renderStats = function() {
        if (Globals.frame % 300 === 0) {
            this._resourceManager.getMemStats(profiling);
        }
            
        var innerHTML = 
            "resolution:            " + Globals.width + "x" + Globals.height + "<br>" + 
            "double sided on :   " + (this._scene.needRenderDoubleSided() ? "Yes" : "No") + "<br><br>" +
            profiling.toString();

        this._hud.render(innerHTML);
    };

    Canvas360.prototype._setupWebGL = function(isMobile, browserName, browserVersion) {
        // TODO: enable WebGL2 for webvr Globals.webvr 
        var useWebGL2 = false;

        var useVAO = true;
        if (browserName === "chrome" && browserVersion === "62") {
            // We have disable VAO for this buggy Chrome version
            useVAO = false;
        }
        
        // gl is defined in global name space.
        gl = SetupWebGL(this.canvas, {
            depth                 : true,
            alpha                 : false,   // disable the blend with DOM behind canvas
            //premultipliedalpha  : false,
            antialias             : true,
            stencil               : false,
            preserveDrawingBuffer : true,
            vao                   : useVAO,
            webgl2                : useWebGL2
        });
    };
    
    Canvas360.prototype._loadDebugKeyboard = function() {
        console.log("canvas 360 load keyboard debug callback");

        var that = this;

        // WebVR: press V enter/exit VR mode
        this.keyboard.onKeyUpCallback = function(key) {
            if (key === 86) {
                console.log("Debug: V Pressed, Swith WebVR mode");
                if (Globals.webvr) {
                    var canvasResizeCB = that.resize.bind(that);
                    that._webvr.switchPresent(that.canvas, canvasResizeCB, that._sceneCamera);
                }
            }
        };
    };

    modelo3d.debug = function() {
        arguments[0] = "(DEBUG) " + arguments[0];
        console.log.apply(this, arguments);
    };

    modelo3d.SKYBOX_WALLPAPER       = SkyBox.SKYBOX_WALLPAPER;
    modelo3d.SKYBOX_WALLPAPER_TILED = SkyBox.SKYBOX_WALLPAPER_TILED;
    modelo3d.SKYBOX_SKYDOME         = SkyBox.SKYBOX_EQUIRECTANGLE;

    modelo3d.UNINITIALIZED = 0;
    modelo3d.LOADING       = 1;
    modelo3d.RENDERING     = 2;

})();
    
