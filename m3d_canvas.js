/**
 * @fileoverview m3d_canvas.js - modelo3d: an architect/BIM 3D rendering engine
 * @author Modelo, Inc
 * @version 2.5.0
 */

/* 
 *  
 */


import Globals           from "./m3d_globals.js";
import HWInfo            from "./00utility/m3d_hwinfo.js";
import ResourceManager   from "./02resource/m3d_resource_manager.js";
import Scene             from "./03scene/m3d_scene.js";
import SceneCamera       from "./03scene/camera/m3d_scene_camera.js";
import OffsetCamera      from "./03scene/camera/m3d_offset_camera.js";
import CameraAnimatorInstant    from "./03scene/camera/m3d_camera_animator_instant.js";
import CameraAnimatorOrbit      from "./03scene/camera/m3d_camera_animator_orbit.js"
import CameraAnimatorNavigate   from "./03scene/camera/m3d_camera_animator_navigate.js"
import Renderer          from "./04renderer/m3d_renderer.js";
import RenderScene       from "./04renderer/m3d_render_scene.js";
import VR                from "./04renderer/m3d_vr.js"; 
import WebVR             from "./04renderer/m3d_webvr.js";
import LoadScene         from "./07loadsave/m3d_load_scene.js";
import LoadMisc          from "./07loadsave/m3d_load_misc.js"
import Panorama          from "./08ui/tool/m3d_panorama.js";
import CameraManipulator from "./08ui/tool/m3d_camera_manipulator.js"; 
import InAppNavigation   from "./08ui/tool/m3d_in_app_navigation.js"; 
import Ruler             from "./08ui/tool/m3d_ruler.js"; 
import Protractor        from "./08ui/tool/m3d_protractor.js"; 
import MagnifyGlass      from "./08ui/tool/m3d_magnify_glass.js" 
import Section           from "./08ui/tool/m3d_section.js"; 
import TransformGizmo    from "./08ui/tool/m3d_transform_gizmo.js";
import ChangeMaterial    from "./08ui/tool/m3d_change_material.js"; 
import CommentManager    from "./08ui/tool/m3d_comment.js";
import ScreenShare       from "./08ui/tool/m3d_screenshare.js";
import FocusElement      from "./08ui/tool/m3d_focus_element.js";
import Orientation       from "./08ui/input/m3d_orientation.js";
import Touch             from "./08ui/input/m3d_touch.js";
import Mouse             from "./08ui/input/m3d_mouse.js";
import Keyboard          from "./08ui/input/m3d_keyboard.js";
import PluginManager     from "./09plugin/m3d_plugin_manager.js";
import StateManager      from "./m3d_state_manager.js";

export default (function() {
    "use strict";

    var MODE_NORMAL          = 0;
    var MODE_MEASURE         = 1;
    var MODE_PROTRACTOR      = 2;
    var MODE_CHANGE_MATERIAL = 3;
    var MODE_SECTION         = 4;
    var MODE_MAGNIFY         = 5;
    var MODE_NAVIGATION_ADDPOINT = 6;

    /**
     * @description The constructor of modelo3d canvas object which provides the interface for all 3D functionalities.
     * @constructor 
     * @param {string} canvasName - the name for a HTML5 canvas which 3D renderings goes to.
     * @param {integer} width - the size of canvas object.
     * @param {integer} height - ditto.
     * @param {boolean} isMobile - false if in a desktop browser and true when on mobile.
     * @param {object} frontendCallbacks - an interface of frontend that modelo3d needs to talk to 
     * @param {object} eventEmitter - event notification center provided frontend.
     */
    function Canvas(canvasName, width, height, isMobile, frontendCallbacks, eventEmitter) {
        console.log("modelo3d version: " + Globals.version);

        // private:
        this._canvasHud    = null;
        this._contextHud   = null;
        this._eventEmitter = eventEmitter;

        this._aoEnabled     = !isMobile;
        this._visible       = true; // Whether this canvas is visible or not.
        this._needUpdate    = 0; // Force next frame to be updated only once
        this._canResize     = false;
        this._lazyRendering = true;
        
        // This flag is used to enable/disable bimculling.
        this._bimCullingEnabled = true;

        this._resourceManager = null;
        this._scene           = null;
        this._renderScene     = null;
        this._renderer        = null;
        this._sceneCamera     = null;
        this._stateManager    = null;
        this._pluginManager   = null;

        this._textureViewer   = null;
        this._axis            = null;
        this._hud             = null;
        this._unitPlane       = null;

        this._vr              = null;
        this._panorama        = null;      
        this._webvr           = null;
        this._ruler           = null;
        this._protractor      = null;
        this._section         = null;
        this._widget          = null;
        this._changeMaterial  = null;
        this._screenShare     = null;
        this._commentManager  = null;
        this._savedViewMode   = false;
        this._mode            = MODE_NORMAL;
        this._ops             = [MODE_NORMAL]; // The operation history and the last op determines the current mode

        // public:
        this.cameraManipulator = null;
        this.mouse             = null;
        this.keyboard          = null;
        this.touch             = null;
        this.orientation       = null;

        Globals.state          = modelo3d.UNINITIALIZED;

        this.initialRotateCompletedCallback = function(){}; //do nothing now
        this.sectionCursor                  = false;
        this.canvas                         = null;

        var hwInfo = new HWInfo();
        Globals.littleEndian      = hwInfo.littleEndian;
        Globals.gpuMemory         = Math.round(hwInfo.vramSize * 0.6); // suppose we need to load 5 large model at same time.
        Globals.browserName       = hwInfo.browserName;
        Globals.browserVersion    = hwInfo.browserVersion;

        Globals.frontendCallbacks = frontendCallbacks;

        // initialization.
        this.canvas = document.getElementById(canvasName);
        this.canvas.oncontextmenu = function() { // Disable the right button
            return false;
        };
        
        Globals.isMobile = isMobile;

        this._setupWebGL(Globals.isMobile, Globals.browserName, Globals.browserVersion);

        // Setup the size of the context.
        Globals.devicePixelRatio = window.devicePixelRatio || 1;
        Globals.width = Math.floor(width * Globals.devicePixelRatio);
        Globals.height = Math.floor(height * Globals.devicePixelRatio);

        this.canvas.style.width = width + "px";
        this.canvas.style.height = height + "px";
        this.canvas.width = Globals.width;
        this.canvas.height = Globals.height;

        // HUD means head up display, it is used for merging comments and screenshot, it's invisible
        this._canvasHud = document.getElementById('canvas_model_comments');
        this._contextHud = this._canvasHud.getContext("2d");
        this._canvasHud.oncontextmenu = function() { // Disable the right button
            return false;
        };
        this._canvasHud.style.width = width + "px";
        this._canvasHud.style.height = height + "px";
        this._canvasHud.width = Globals.width;
        this._canvasHud.height = Globals.height;
                    
        this._resourceManager      = new ResourceManager();
        this._scene                = new Scene(this._resourceManager);
        this._renderer             = new Renderer(this._resourceManager);
        this._stateManager         = new StateManager(this);
        this._sceneCamera          = new SceneCamera(this._scene, this._eventEmitter);
        this._renderScene          = new RenderScene(this._scene, this._resourceManager, this._renderer, this._sceneCamera);
        // VR device orientation events
        this.orientation           = Globals.isMobile ? new Orientation() : null;
        
        // Initialize rendering and UI
        this._vr                   = new VR(this._resourceManager, this._scene);
        this._webvr                = new WebVR(this._resourceManager, this._scene, this._eventEmitter);
        this._inAppNavigation      = new InAppNavigation(this._sceneCamera, this._scene, this._renderer, this._resourceManager);
        this._pluginManager        = new PluginManager(this._resourceManager);

        this.cameraManipulator     = new CameraManipulator(this._scene, this._sceneCamera,
            this._resourceManager, this.orientation, this._eventEmitter);

        this._widgetMovementCallback = null;
        this._widget               = new TransformGizmo(this._scene, this._resourceManager);
        this._ruler                = new Ruler(this._scene, this._resourceManager, this._eventEmitter);
        this._protractor           = new Protractor(this._scene, this._resourceManager, this._eventEmitter);
        this._magnifyGlass         = new MagnifyGlass(this._scene, this._resourceManager, this._sceneCamera, this._eventEmitter);
        this._section              = new Section(this._scene, this._resourceManager, this._renderScene, this._eventEmitter);
        this._changeMaterial       = new ChangeMaterial(this._scene, this._resourceManager, this._eventEmitter);
        this._commentManager       = new CommentManager(this._scene, this._resourceManager, this._eventEmitter);
        this._screenShare          = new ScreenShare(this._scene, this._eventEmitter);
        this._focusElement         = new FocusElement(this._scene, this._resourceManager, this._renderScene, this._sceneCamera);
        this._panorama             = new Panorama(this._resourceManager, this.orientation, this._commentManager, this._eventEmitter);


        // Debugging
        this._initializeDebug();
        modelo3d.debug("The largest model can be loaded on this device is: " + Globals.gpuMemory + "MB");

        // touch events.
        var isTouchPad = (/hp-tablet/gi).test(navigator.appVersion);
        var hasTouchEvents = "ontouchstart" in window && !isTouchPad;
        if (hasTouchEvents) {
            this._initializeTouchEvents();
        }

        // mouse events
        this._initializeMouseEvents();

        // keyboard events
        this._initializeKeyboardEvents();
        
        // gyrosensor events
        if (Globals.isMobile) {
            this._initializeGyrosensorEvents();
        }
    };

    /**
     * @description Need a clean exit when the scene is about to reload. Otherwise 
     * it will cause significant memory leak.
     * @return {undefined}
     */
    Canvas.prototype.destroy = function() {
        console.group("Destroy modelo3d context");

        if (this._vr) {
            this._vr.destroy();
            this._vr = null;
            delete this._vr;
        }
        if (this._webvr) {
            this._webvr.destroy();
            this._webvr = null;
            delete this._webvr;
        }
        if (this._ruler) {
            this._ruler.destroy();
            this._ruler = null;
            delete this._ruler;
        }
        if (this._protractor) {
            this._protractor.destroy();
            this._protractor = null;
            delete this._protractor;
        }
        if (this._magnifyGlass) {
            this._magnifyGlass.destroy();
            this._magnifyGlass = null;
            delete this._magnifyGlass;
        }
        if (this._section) {
            this._section.destroy();
            this._section = null;
            delete this._section;
        }
        if (this._changeMaterial) {
            this._changeMaterial.destroy();
            this._changeMaterial = null;
            delete this._changeMaterial;
        }
        if (this._screenShare) {
            this._screenShare.destroy();
            this._screenShare = null;
            delete this._screenShare;
        }
        if (this._commentManager) {
            this._commentManager.destroy();
            this._commentManager = null;
            delete this._commentManager;
        }
        if (this._pluginManager) {
            this._pluginManager.destroy();
            delete this._pluginManager;
            this._pluginManager = null;
        }
        if (this._focusElement) {
            this._focusElement.destroy();
            this._focusElement = null;
            delete this._focusElement;
        }

        if (this.cameraManipulator) {
            this.cameraManipulator.destroy();
            this.cameraManipulator = null;
            delete this.cameraManipulator;
        }

        this._renderScene.destroy();
        this._scene.destroy();
        this._resourceManager.destroy();

        delete this._renderScene;
        delete this._scene;
        delete this._resourceManager;

        if (Globals.isMobile) {
            this.touch.destroy();
            this.touch = null;
            this.orientation.destroy();
            this.orientation = null;
        } else {
            this.mouse.destroy();
            this.mouse = null;
            this.keyboard.destroy();
            this.keyboard = null;
        }

        Globals.frontendCallbacks = null;

        this._eventEmitter = null;

        Globals.state = modelo3d.UNINITIALIZED;

        this._visible = false;

        // Release GL context
        gl = null;
        this.canvas = null;
        // Release 2D context
        this._contextHud = null;
        this._canvasHud = null;
        
        console.groupEnd("Destroy modelo3d context");
    }; // end of Canvas.prototype.destroy

    /**
     * @description load the model for rendering 
     * @param {object} modelInformation - the model information given by frontend
     * @param {object} modelPromises - the promises that load the model data files
     * @param {object} terrainPromises - the promises that load the terrain data files
     * @param {object} cameraInfo - the camera information
     * @param {object} sectionInfo - the section information
     * @return {undefined}
     */
    Canvas.prototype.load = function(modelInformation, modelPromises, terrainPromises, cameraInfo, sectionInfo) {
        this._scene.id = modelInformation.modelId || "551d4326e437414c17000005";

        var useLocalServer = (this._scene.id === "551d4326e437414c17000005");
        var loader = new LoadScene(useLocalServer, this._scene,
                this._sceneCamera, this._resourceManager, this._renderScene);

        // Disable lazy rendering during the progressive loading, so that
        // drawables will be rendered immediately after it is loaded.
        this._lazyRendering = false;

        Globals.state = modelo3d.LOADING;
        var that = this;

        // Initialize the model file promises if it is connecting to local server.
        if (useLocalServer) {
            if (terrainPromises) {
                terrainPromises = {};

                var $q = Globals.frontendCallbacks.getPromiseLibrary();
                var url = "/local/" + that._scene.id + "/terrain/scene.json";
                terrainPromises["scene.json"] = LoadMisc.OpenFile(that._scene.id, url, "scene.json", "json", $q);
            }
            if (modelPromises) {
                modelPromises = {};

                var $q = Globals.frontendCallbacks.getPromiseLibrary();
                var url = "/local/" + that._scene.id + "/scene.json";
                modelPromises["scene.json"] = LoadMisc.OpenFile(that._scene.id, url, "scene.json", "json", $q);
            }
        }
        
        // TODO: remove phase1done event and chain all callbacks.
        if (terrainPromises && modelPromises) {
            // Load the coarse level of the terrain.
            return loader.load(modelInformation, terrainPromises,
                function(sceneData) {},
                function(sceneData) {},
                function(per) {}).then(function() {
                    // Load the model.
                    return that._loadModel(modelInformation, modelPromises, cameraInfo, sectionInfo)
                            .then(function() {
                                // Load the fine level of terrain.
                                loader.load(modelInformation, terrainPromises, function(sceneData){}, function(sceneData){},
                                        function(per){});
                            });
                });
        } else if (terrainPromises) {
            return loader.load(modelInformation, terrainPromises,
                function(sceneData) {
                    that._eventEmitter.emit("loadingPhase1Done", modelInformation);
                },
                function(sceneData) {
                    Globals.state = modelo3d.RENDERING;

                    that._lazyRendering = true;
                    that._visible = true;

                    that._renderScene.onSceneChanged();

                    that._refreshRendering();
                    that._eventEmitter.emit("loadingPhase2Done", modelInformation);
                    
                    that._sceneCamera.setCullingEnabled(true);

                    that._loadDebug();

                    Globals.frame = 1; // start counting frames
                },
                function(per) {
                    // When every the scene gets changed, we need to invalidate the renderer.
                    if (Globals.state === modelo3d.LOADING) {
                        that._renderer.invalidate();
                        that._eventEmitter.emit("loadingPhase2Progress", per);
                    }
                });
        } else {
            return this._loadModel(modelInformation, modelPromises, cameraInfo, sectionInfo);
        }
    }; 

    /**
     * @description cancel the refresh window event
     * @param {integer} animationId - the animation ID
     * @return {undefined}
     */
    Canvas.prototype.cancelAnimationFrame = function(animationId) {
        window.cancelAnimationFrame(animationId);
    };
    
    /**
     * @description start the refresh window event
     * @param {function} updateCallback - the update callback function
     * @param {DOM} canvas - the canvas DOM
     * @return {integer} - the animation ID
     */
    Canvas.prototype.requestAnimationFrame = function(updateCallback, canvas) {
        if (Globals.state === modelo3d.UNINITIALIZED) {
            return 0;
        }

        var animationId = 0;
        if (this._webvr.isPresenting()) {
            animationId = this._webvr._vrDisplay.requestAnimationFrame(updateCallback, canvas);
        } else {
            animationId = window.requestAnimationFrame(updateCallback, canvas);
        }
        return animationId;
    };

    /**
     * @description when the canvas is not longer visible
     * @return {undefined}
     */
    Canvas.prototype.hide = function() {
        modelo3d.debug("Window hides");

        this._visible = false;

        this._resourceManager.discard(true);
    };

    /**
     * @description called by frontend when GL context lost. It will
     * destroy all the GL objects and contexts.
     * @return {undefined}
     */
    Canvas.prototype.clobber = function() {
        // Stop the canvas update function
        this._visible = false;

        // Discard rendering resources and states.
        this._resourceManager.discard(true, true, true, true);
        this._renderer.discard();
        
        gl = null; // Destroy GL context
    };

    /**
     * @description called by frontend when GL context restores
     * @return {undefined}
     */
    Canvas.prototype.restore = function() {
        // FIXME: the frontend should refresh the entire
        // page. Nothing needs to be done in modelo3d right now.
        // 
        //this._resourceManager.restore(true, true, true, true);
        //this._renderer.restore();
        //this._renderScene.restore();
        
        // Restore the canvas update function
        //this._visible = true;
        //this._refreshRendering();
    };
    
    /**
     * @description when the canvas becomes visible
     * @return {undefined}
     */
    Canvas.prototype.show = function() {
        modelo3d.debug("Window appears");

        if (Globals.state === modelo3d.RENDERING || Globals.state === modelo3d.LOADING) { 
            this._visible = true;
        }

        this._resourceManager.restore(true);

        this._stateManager.onShadowChanged(true);

        this._renderScene.setProgressiveEnabled(false);
        this._refreshRendering();
    };

    /**
     * @description render the model scene
     * @return {undefined}
     */
    Canvas.prototype.renderScene = function() {
        if (this._webvr.isPresenting()) {
            this._webvr.draw(this._sceneCamera, this._renderScene, this._renderer);
            return 0;
        } else if (this._vr.enabled) {
            
            if (this._inAppNavigation.isEnabled()) {
                this._sceneCamera.update();
                
                this.orientation.modulate = false; 
                
                if (this._sceneCamera.animator instanceof CameraAnimatorNavigate) {
                    this.orientation.modulate = true; 
                }
            }
            
            this.orientation.update();
            this._vr.draw(this._sceneCamera, this._renderScene, this._renderer);
            return 0;
        } else if (this._panorama.enabled){
            this._panorama.render(this._renderer);
            return 0;
        } else {
            return this._renderScene.draw(this._sceneCamera);
        }
    };

    /**
     * @description render the UI controls, e.g, comments, ruler and etc.
     * @return {undefined}
     */
    Canvas.prototype.renderControls = function() {
        // Disable controls in VR rendering.
        if (!this._vr.enabled && !this._webvr.enabled && !this._panorama.enabled) {
            this._section.render(this._renderer, this._sceneCamera);
            this._widget.render(this._renderer, this._sceneCamera);
            this._changeMaterial.render(this._renderer, this._sceneCamera);

            // No comment update during progressive rendering.
            if (!this._renderScene.isProgressiveEnabled()) {
                this._commentManager.update(this._sceneCamera);
            }
            this._ruler.render(this._renderer, this._sceneCamera);
            this._protractor.render(this._renderer, this._sceneCamera);
            this._magnifyGlass.render(this._renderer);
            //this._focusElement.render(this._renderer, this._sceneCamera);
        }
    };

    /**
     * @description update the frame, called by frontend in a requestAnimationFrame's callback.
     * @return {undefined}
     */
    Canvas.prototype.update = function(forceRender) {
        // When the screen (tab) is hidden, we don't need to run update function.
        if (!this._visible && !forceRender) {
            return;
        }
        
        // On iOS, the canvas resize will be effective immediately in the follow case
        //
        // resize to new size -> draw -> resize to original size.
        //
        // So we need to defer the resizing to next frame.
        if (Globals.isMobile && (this._resizeWidth || this._resizeHeight)) {
            if (!this._canResize) {
                this._canResize = true;
                return;
            }

            this.resize(this._resizeWidth, this._resizeHeight);
            this._resizeWidth  = null;
            this._resizeHeight = null;
            this._canResize    = false;
        }

        // Trigger the callback at the first time rendering stops
        if (this.initialRotateCompletedCallback && this._lazyRendering && !this._sceneCamera.updated && this._needUpdate < 0.001) {
            this.initialRotateCompletedCallback();
            this._stateManager.onSceneChanged();
            this.initialRotateCompletedCallback = null;
        }

        // Update the camera since last frame by inputs, e.g., touch, mouse.
        if (this._vr.enabled || this._webvr.enabled || this._panorama.enabled || this._sceneCamera.update()) {
            this._refreshRendering(1);
        }

        // As long as we need to render, we render.
        if (!this._lazyRendering || this._needUpdate > 0) {

            // Plugin will override built-in renderer.
            // renderScene will fire render events as well, i.e., in PR mode. 

            this._renderer.beginFrame();
            this._needUpdate += this._pluginManager.update() || this.renderScene();
            this.renderControls();
            this._renderDebug();
            this._renderer.endFrame();

            Globals.frame++;

            // Each rendering will consume one render event.
            if (this._lazyRendering) {
                this._needUpdate -= 1;
            }
            
            // When rendering stops, we provoke a corresponding callback.
            if (this._lazyRendering && this._needUpdate < 0) {
                this._onAnimationEnd();
            }
        }
    };

    /**
     * @description the callback when canvas DOM's size gets changed.
     * @param {integer} width - the size
     * @param {integer} height - ditto
     * @return {undefined}
     */
    Canvas.prototype.resize = function(width, height) {
        this._refreshRendering();

        Globals.devicePixelRatio = window.devicePixelRatio || 1;
        var actualWidth = Math.floor(width * devicePixelRatio);
        var actualHeight = Math.floor(height * devicePixelRatio);

        Globals.width = actualWidth;
        Globals.height = actualHeight;

        this._sceneCamera.resize(actualWidth, actualHeight);
        this._sceneCamera.update();

        this._ruler.resize(actualWidth, actualHeight);
        this._magnifyGlass.resize(actualWidth, actualHeight);
        this._section.resize(actualWidth, actualHeight);
        this._changeMaterial.resize(actualWidth, actualHeight);

        this._renderScene.resize(actualWidth, actualHeight);
        this._vr.resize(actualWidth, actualHeight);
        this._panorama.resize(actualWidth, actualHeight);

        this._renderer.invalidate();

        this.canvas.style.width = width + "px";
        this.canvas.style.height = height + "px";
        this.canvas.width = actualWidth;
        this.canvas.height = actualHeight;

        this._canvasHud.style.width = width + "px";
        this._canvasHud.style.height = height + "px";
        this._canvasHud.width = actualWidth;
        this._canvasHud.height = actualHeight;
    }; // end of Canvas.prototype.resize

    /**
     * @description dump the screen into an PNG thumbnail. If width and height 
     * are both null, the current canvas size will be used. If only 
     * height is left null, it will be computed proportional to the 
     * given width with aspect ratio kept. When the closeup is set to true, 
     * the scene will be enlarged temporarily to use the entire canvas.
     * @param {integer} width - the size of the dumped image
     * @param {integer} height - ditto
     * @param {boolean} closeup - when true, a closeup view will be dumped.
     * @param {object} commentRenderData - the comments data to be rendered onto the dumped image. It can be left null.
     * @return {undefined}
     */

    Canvas.prototype.dump = function(width, height, closeup, commentRenderData, filter, cameraData) {
        // If both width and height are left empty, we use the current canvas size.
        if (!width && !height) {
            width = Globals.width;
            height = Globals.height;
        } else if (!height) {
            // If height is null, we keep the aspect ratio.
            height = width * Globals.height / Globals.width;
        }

        // Resize the canvas size and camera.
        var oldWidth = Math.floor(Globals.width / Globals.devicePixelRatio);
        var oldHeight = Math.floor(Globals.height / Globals.devicePixelRatio);

        var savedCamera;

        var newWidth = Math.floor(width / Globals.devicePixelRatio);
        var newHeight = Math.floor(height / Globals.devicePixelRatio);

        if (newWidth !== oldWidth || newHeight !== oldHeight) {
            this.resize(newWidth, newHeight);
        }

        if (closeup) {
            // Make the camera close enough to the scene.
            var distance;
            var ratio = 1.0 / Math.sin(this._sceneCamera._fov * Math.PI / 180.0 * 0.5);
            if (width >= height) {
                distance = this._scene.radius * ratio;
            } else {
                distance = this._scene.radius / (width / height) * ratio;
            }
            savedCamera = this._sceneCamera.dump();
            this._sceneCamera.zoomTo(distance);
        }

        if (cameraData) {
            savedCamera = this._sceneCamera.dump();
            this._sceneCamera.restore(cameraData);
        }
        // Render the scene
        this._renderer.invalidate();
        this._scene.background.setColor([0.96, 0.96, 0.96, 1.0]);
        var temp = this._sceneCamera.isBimCullingEnabled();
        this._sceneCamera.setBimCullingEnabled(false);
        if (commentRenderData /*|| this._inAppNavigation.isEnabled()*/) { //we don't need pr when dump godview
            // TODO: SSAO is becoming a pr SSAO now, so only one frame of the 
            // rendering will not cover this dump action, we need to think of 
            // a better way to dump screen with PR later
            this._renderScene.setAOEnabled(false);  
            this.renderScene();
        } else {
            this._renderScene.setProgressiveEnabled(true); 
            this._renderScene.setOITEnabled(true);
            this._renderScene.setAOEnabled(this._aoEnabled);
            this._renderScene.setProgressiveRenderingLatency(15);
            this.renderScene();
            this._renderScene.setOITEnabled(false);
            this._renderScene.setProgressiveRenderingLatency(-1);
        }
        this._sceneCamera.setBimCullingEnabled(temp);   

        this._scene.background.setColor([1, 1, 1, 0]);
        
        this._renderer.invalidate();

        var thumbnail = null;
        // Dump the screen to the thumbnail
        if (commentRenderData || filter) {

            // the default value for canvas filter is "none" so only apply the filter
            // if the canvas has the filter attribute (older browsers don't support it)
            if (filter && this._contextHud.filter) {
                this._contextHud.filter = filter;
            }

            this._contextHud.clearRect(0, 0, this._canvasHud.width, this._canvasHud.height);
            this._contextHud.drawImage(this.canvas, 0, 0);

            if (commentRenderData) {
                // Need to compute the screen position of the comment because the one
                // in renderData is not ready yet. It becomes ready in next frame after
                // CommentManager.update is called.
                var screenPosition =  this._sceneCamera.project(commentRenderData.position);
                var pos = { x : screenPosition[0], y : screenPosition[1] };


                this._contextHud.beginPath();
                this._contextHud.arc(pos.x, pos.y, 10, 0, 360, false);
                this._contextHud.fillStyle = "#F75223";
                this._contextHud.fill();
                this._contextHud.closePath();
            }

            thumbnail = this._canvasHud.toDataURL("image/jpg");
            
            if (filter && this._contextHud.filter) {
                this._contextHud.filter = "none";
            }
        } else {
            thumbnail = this.canvas.toDataURL("image/jpg");
        }

        // Restore the canvas to the original size.
        if (closeup || cameraData) {
            this._sceneCamera.restore(savedCamera);
        }

        // See the comments for related code in update().
        if (newWidth !== oldWidth || newHeight !== oldHeight) {
            if (Globals.isMobile) {
                this._resizeWidth = oldWidth;
                this._resizeHeight = oldHeight;
                this._canResize = false;
            } else {
                this.resize(oldWidth, oldHeight);
            }
        }
        this._refreshRendering();

        return thumbnail;
    };

    /**
     * @description set the background of the rendering.
     * @param {object} image - an HTML image DOM
     * @return {undefined}
     */
    Canvas.prototype.setBackgroundImage = function(image) {
        this._scene.background.setImages(image);
        this._refreshRendering();
    };

    /**
     * @description the background image rendering mode
     * @param {enumerate} mode - either SKYBOX_WALLPAPER or SKYBOX_SKYDOME. In
     *   WALLPAPER mode, the background is a static image. In SKYDOME mode, it is like 
     *   skydome and background will rotate with the scene model.
     * @return {undefined}
     */
    Canvas.prototype.setBackgroundMode = function(mode) {
        this._scene.background.setBackgroundMode(mode);
        this._refreshRendering();
    };

    /**
     * @description set the visibility of layers
     * @param {array} layersOn - the indices of layers needs to be turned on
     * @param {array} layersOff - the indices of layers needs to be turned off
     * @return {undefined}
     */
    Canvas.prototype.setLayersVisible = function(layersOn, layersOff) {
        var changedOn = this._scene.setLayersVisible(layersOn, true);
        var changedOff = this._scene.setLayersVisible(layersOff, false);
    
        if (changedOn || changedOff) {
            this._stateManager.onLayerChanged();
            this._refreshRendering();
        }
    };

    /**
     * @description set the visibility of single layer
     * @param {array} layerIndex - the index of layer in the scene
     * @param {boolean} visibility - true for visible or false for not.
     * @return {undefined}
     */
    Canvas.prototype.setLayerVisible = function(layerIndex, visibility) {
        if (this._scene.setLayerVisible(layerIndex, visibility)) {
            this._stateManager.onLayerChanged();
            if (!this._scene.clipping.isEnabled()) {
                this._scene.updateBBox();                 
            }
            this._refreshRendering();
        }
    };

    /**
     * @description get the flag of if there is profile line info getting from the revit model file
     * @return {boolean}
     */
    Canvas.prototype.hasProfileLines= function() {
        return this._scene.hasProflileLines;
    };

    /**
     * @description get the flag of if there is line info getting from the rhino model file
     * @return {boolean}
     */
    Canvas.prototype.hasCurveOrLine = function() {
        return this._scene.hasCurveOrLine;
    };
    
    /**
     * @description set the flag of rendering lines of the model
     * @return {undefined}
     */
    Canvas.prototype.setRenderingLineEnable = function(enabled) {
        this._renderScene.setLineRendering(enabled);
        this._refreshRendering();
    };
    
    /**
     * @description set the flag of orientation
     * @return {undefined}
     */
    Canvas.prototype.setOrientationEnable = function(enabled) {
        this.orientation.setEnabled(enabled);
        this._refreshRendering();
    };
    
    /**
     * @description set light intensity
     * @param {float} intensity - the intensity of light, ranging from 0 (dim) to 1 (bright)
     * @return {undefined}
     */
    Canvas.prototype.setLightingIntensity = function(intensity) {
        this._refreshRendering();
        this._scene.setLightingIntensity(intensity);
        this._stateManager.onLightingChanged();
    };

    /**
     * @description set the intensity of specular light
     * @param {float} intensity - the intensity of specular light, ranging from 0 (dim) to 1 (bright)
     * @return {undefined}
     */
    Canvas.prototype.setSpecularShinness = function(intensity) {
        this._refreshRendering();
        this._scene.setLightingIntensity(intensity);
        this._scene.setSpecularShinness(200 - intensity * 160);

        console.log(intensity);

        this._stateManager.onLightingChanged();
    };

    /**
     * @description turn on/off specular light
     * @param {boolean} enabled - enable the specular light
     * @return {undefined}
     */
    Canvas.prototype.setSpecularEnabled = function(enabled) {
        this._stateManager.onLightingChanged();
        this._renderScene.setSpecularEnabled(enabled);
        this._refreshRendering();
    };

    /**
     * @description set the height of light
     * @param {float} angle - ranges in [0, pi/2]. pi/2 when light is at north polar.
     * @return {undefined}
     */
    Canvas.prototype.setLightingLatitude = function(angle) {
        this._refreshRendering();
        this._scene.setLightingLatitude(angle);

        this._stateManager.onLightingChanged();
    };

    /**
     * @description set the direction of light
     * @param {float} angle - ranges in [0, pi*2]. 0 when light is at east.
     * @return {undefined}
     */
    Canvas.prototype.setLightingLongitude = function(angle) {
        this._refreshRendering();
        this._scene.setLightingLongitude(angle);

        this._stateManager.onLightingChanged();
    };

    /**
     * @description turn on/off the shadow
     * @param {boolean} enabled - true for shadow on.
     * @return {undefined}
     */
    Canvas.prototype.setShadowEnabled = function(enabled) {
        this._renderScene.setShadowEnabled(enabled);
        this._stateManager.onShadowChanged();
        this._refreshRendering();
    };

    /**
     * @description turn on/off the gamma calibration. The sRGB is not a linear color space, so we need to map our linear output from PS shader to it using gamma correction.
     * @param {boolean} enabled - true for enable. 
     * @return {undefined}
     */
    Canvas.prototype.setGammaEnabled = function(enabled) {
        this._renderScene.setGammaEnabled(enabled);
        this._refreshRendering();
    };

    /**
     * @description enable VR
     * @param {boolean} enabled - enable VR
     * @return {undefined}
     */
    Canvas.prototype.setVREnabled = function(enabled) {
        if (this._vr.enabled === enabled) {
            return;
        }

        // VR implicitly needs first person view being enabled.
        this._vr.setEnabled(enabled);
        this.setFirstPersonViewEnabled(enabled);
        this._stateManager.onVREnabled(enabled);
    };

    /**
     * @description change the convergence of two eyes in VR mode.
     * @param {float} value - larger convergence, the depth cue is more stronger.
     * @return {undefined}
     */
    Canvas.prototype.setVRConvergence = function(value) {
        this._vr.setConvergence(value);
        this._refreshRendering();
    };

    /**
     * @description change the distance of two eyes in VR mode.
     * @param {float} value - it is in centimeters.
     * @return {undefined}
     */
    Canvas.prototype.setVRSeparation = function(value) {
        this._vr.setSeparation(value);
        this._refreshRendering();
    };

    /**
     * @description render the two lens center points when enabled
     * @param {boolean} enabled - true for enabled
     * @return {undefined}
     */
    Canvas.prototype.setVRCalibration = function(enabled) {
        this._vr.setCalibrationEnabled(enabled);
        this._refreshRendering();
    };

    /**
     * @description warp the output to counter the lens distortion.
     * @param {boolean} enabled - true for enabled
     * @return {undefined}
     */
    Canvas.prototype.setVRWarpEnabled = function(enabled) {
        this._vr.setWarpEnabled(enabled);
        this._refreshRendering();
    };

    /**
     * @description render the bounding box of each drawable in the scene. For debugging only.
     * @param {boolean} enabled - true for enabled
     * @return {undefined}
     */
    Canvas.prototype.setBBoxEnabled = function(enabled) {
        this._renderScene.setBBoxEnabled(enabled);
        if (enabled) {
            this._scene.generateBBox(this._resourceManager);
        }
        this._refreshRendering();
    };

    /**
     * @description callback when the model is loaded and stops at the first time.
     * @return {undefined}
     */
    Canvas.prototype.initialRotateCompleted = function() {
        var $q = Globals.frontendCallbacks.getPromiseLibrary();

        var deferred = $q.defer();

        this.initialRotateCompletedCallback = function() {
            deferred.resolve();
        };

        return deferred.promise;
    };

    /**
     * @description restore the view mode, i.e., 1st or 3rd person view after
     * navigation is stopped.
     * @return {undefined}
     */
    Canvas.prototype.restoreViewMode = function() {
        this.setFirstPersonViewEnabled(this._viewModeBeforeNavi);
    };

    /**
     * @description get the length of a model-specified navigation animation.
     * @return {undefined}
     */
    Canvas.prototype.getNavigationDuration = function() {
        console.log("canvas.getNavigationDuration drops since 0.5.5");
        return 0;
    };

    /**
     * @description enable model-specified navigation animation.
     * @param {boolean} enabled - enable the navigation.
     * @return {undefined}
     */
    Canvas.prototype.setNavigationEnabled = function(enabled) {
        console.log("canvas.setNavigationEnabled drops since 0.5.5");
    };

    /**
     * @description start model-specified navigation animation.
     * @return {undefined}
     */
    Canvas.prototype.startNavigation = function() {
        console.log("canvas.startNavigation drops since 0.5.5");
    };

    /**
     * @description go to a specific position on a model-specified navigation animation path.
     * @param {float} pos - the position in terms of time on the path. pos ranges in (0, 1)
     * @return {undefined}
     */
    Canvas.prototype.setNavigationPosition = function(pos) {
        console.log("canvas.setNavigationPosition drops since 0.5.5");
    };

    /**
     * @description stop model-specified navigation animation.
     * @return {undefined}
     */
    Canvas.prototype.stopNavigation = function() {
        console.log("canvas.stopNavigation drops since 0.5.5");
    };

    /**
     * @description check if the current scene has a model-specified navigation animation path.
     * @return {boolean} - true if navigation is enabled
     */
    Canvas.prototype.isNavigationValid = function() {
        console.log("canvas.isNavigationValid drops since 0.5.5");
        return false;
    };

    /**
     * @description switch between 1st person view and 3rd person view.
     * @param {boolean} enabled - true for 1st person view and false for 3rd person view.
     * @param {boolean} isRestricted - set to turn to disable all camera interactions except for the rotation.
     * @return {undefined}
     */
    Canvas.prototype.setFirstPersonViewEnabled = function(enabled, isRestricted) {
        this._sceneCamera.setFirstPerson(enabled, isRestricted);
        this.cameraManipulator.resetFirstPersonView(enabled);
        this._eventEmitter.emit("firstPersonViewEnabled", enabled);
    };

    /**
     * @description check if 1st person view is enabled.
     * @return {boolean} - true if first-person view is enabled
     */
    Canvas.prototype.isFirstPersonViewEnabled = function() {
        return this._sceneCamera.isFirstPerson();
    };

    /**
     * @description enable the restricted view
     * @param {boolean} enabled - true for yes
     * @return {undefined} 
     */
    Canvas.prototype.setRestrictedViewEnabled = function(enabled) {
        this._sceneCamera.setFirstPerson(enabled, enabled);
        this.cameraManipulator.resetFirstPersonView(enabled);
    };

    /**
     * @description check if it is a restricted view
     * @return {boolean} - true if current camera is in restricted view.
     */
    Canvas.prototype.isRestrictedViewEnabled = function() {
        return this._sceneCamera.isRestricted();
    };

    /**
     * @description turn on ambient shadow
     * @param {boolean} enabled - true for yes.
     * @return {undefined}
     */
    Canvas.prototype.setAOEnabled = function(enabled) {
        this._aoEnabled = enabled;
        // We need to interrupt the PR if it is now for the AO is controlled
        // by PR.
        this._renderScene.setProgressiveEnabled(false);
        this._aoEnabled = enabled;
        this._refreshRendering();
        // Don't enable AO rendering here as it is controlled by lazyRendering.
        if (enabled) {
            this._renderScene.updateAO();
        }
    };
    
    /**
     * @description change the color of sketch.
     * @param {float} contrast - determines the color of sketch lines; ranges in (0, 100]. 0 for a very bright color (i.e., white), and 100 for the darkest color (i.e., dark black).
     * @return {undefined}
     */
    Canvas.prototype.setSketchContrast = function(contrast) {
        this._renderScene.setProgressiveEnabled(false);
        this._renderScene.setSketchContrast(contrast);
        this._refreshRendering();
    };
    
    /**
     * @description enable the sketch rendering of a scene.
     * @param {float} detail - a [0, 100] value. The larger value the model sketch lines will appear on the model surfaces.
     * @return {undefined}
     */
    Canvas.prototype.setSketchDetailLevel = function(detail) {
        this._renderScene.setProgressiveEnabled(false);
        this._renderScene.setSketchDetailLevel(detail);
        this._refreshRendering();
    };

    /**
     * @description check if the sketch is enabled.
     * @param {boolean} enabled - true for yes.
     * @return {undefined}
     */
    Canvas.prototype.setSketchEnabled = function(enabled) {
        this._renderScene.setProgressiveEnabled(false);
        this._renderScene.setSketchEnabled(enabled);
        this._refreshRendering();
    };
    
    /**
     * @description enable t the sketch color mode. By default sketch is in B/W mode.
     * @param {boolean} enabled - true for yes.
     * @return {undefined}
     */
    Canvas.prototype.setSketchColorEnabled = function(enabled) {
        this._renderScene.setProgressiveEnabled(false);
        this._renderScene.setSketchColorEnabled(enabled);
        this._refreshRendering();
    };

    /**
     * @description set a color that overrides materials of all drawables in
     * the scene. All the drawables will appear in the same color. 
     * @param {array} color - the RGBA of overrided color
     * @return {undefined}
     */
    Canvas.prototype.setOverridedMaterial = function(color) {
        this._renderScene.setProgressiveEnabled(false);
        this._renderScene.setOverridedMaterial(color);
        this._refreshRendering();
    };

    Canvas.prototype._onAnimationStart = function() {
        this._renderScene.setAOEnabled(false);
        this._renderScene.setOITEnabled(false);
    };

    Canvas.prototype._onAnimationEnd = function () {
        // When the camera stops, we render another frame with BIM culling disabled.
        if (this._sceneCamera.isBimCullingEnabled()) {
            this._needUpdate += 1.01;
            this._sceneCamera.setBimCullingEnabled(false);
            // We need to invalidate the rendering states for instancing shaders here
            // as it may be the first time of using them and they haven't acquired the
            // global rendering states.
            this._renderer.renderState.invalidateLight();
            this._renderer.renderState.invalidateShadow();
            this._renderer.renderState.invalidateClip();
            return ;
        }

        // Don't render progressively in tool modes. 
        var prEnabled = !(this._mode === MODE_SECTION && this.isSectionInteractEnabled()) &&
                          !this._widget.isEnabled() &&
                          this._mode !== MODE_CHANGE_MATERIAL &&
                          this._mode !== MODE_MEASURE &&
                          this._mode !== MODE_PROTRACTOR &&
                          this._mode !== MODE_MAGNIFY &&
                         !this._renderScene.isProgressiveEnabled();

        this._renderScene.setAOEnabled(this._aoEnabled && prEnabled);
        this._renderScene.setOITEnabled(prEnabled);

        // We should disable PR if we just finish one pass of PR, e.g., we enter
        // _onAnimationEnd again when we finish one pass of PR. when we disable PR
        // we should disable OIT and AO but about to be on, vice versa
        this._renderScene.setProgressiveEnabled(prEnabled);

        if (prEnabled) {
            // We need to refresh rendering for starting PR. Adding 1.01 to
            // make 0 < this._needUpdate < 1.
            // it would cause error when this._needUpdate > 1.0
            this._needUpdate += 1.01;
       
            if(this._needUpdate > 1) {
                this._needUpdate = 0.9999;
            }

        } else {
            this._needUpdate = 0;
        }
    };

    /**
     * @description dump the current scene's camera states.
     * @return {Object} - the current scene camera
     */
    Canvas.prototype.getSceneCameraData = function() {
        return this._sceneCamera.dump();
    };

    /**
     * @description dump the current scene's clipping states.
     * @return {object} - the scene clipping range.
     */
    Canvas.prototype.getSceneClippingData = function() {
        if (this._scene.clipping.isEnabled()) {
            var that = this;
            return {
                planes: that._scene.clipping.getClippingPlanes(true),
                points: that._scene.clipping.getClippingPoints(true)
            };
        }

        return null;
    };

    /**
     * @description get the information of all layers in the current scene.
     * @return {array} - the array of layers
     */
    Canvas.prototype.getLayerData = function() {
        return this._scene.layers;
    };

    /**
     * @description get the information of all views in the current scene.
     * @return {array} - the array of views.
     */
    Canvas.prototype.getViewData = function() {
        return this._scene.views;
    };

    /**
     * @description return the main light information.
     * @return {object}
     */
    Canvas.prototype.getSceneMainLight = function() {
        return this._scene.getMainLight();
    };

    /**
     * @description fetch the scene camera.
     * @return {object} - the current scene camera object
     */
    Canvas.prototype.getSceneCamera = function() {
        return this._sceneCamera;
    };

    /**
     * @description check if the section is enabled.
     * @return {boolean} - if section is enabled
     */
    Canvas.prototype.isSectionEnabled = function() {
        return this._section.enabled;
    };

    /**
     * @description enable the section
     * @param {boolean} enabled - true for yes.
     * @return {undefined}
     */
    Canvas.prototype.setSectionEnabled = function(enabled) {
        this._stateManager.updateMode(MODE_SECTION, enabled);
        this._section.setEnabled(enabled, this._renderer);

        this._stateManager.onSectionEnabled(enabled);
        this._refreshRendering();
    };

    Canvas.prototype.isBimModel = function() {
        return Globals.bim;
    };
    
    /**
     * @description enable the bim focus
     * @param {boolean} enabled - true for yes.
     * @return {undefined}
     */
    Canvas.prototype.setFocusElementEnabled = function(enabled) {
        this._focusElement.setEnabled(enabled && Globals.bim);
        
        this._stateManager.onFocusElementEnabled(enabled);
        this._refreshRendering();
    };
    
    /**
     * @description enable the bim focus for picking element in the 3d scene
     * @param {boolean} enabled - true for yes.
     * @return {undefined}
     */
    Canvas.prototype.setSelectElementEnabled = function(enabled) {
        this._focusElement.setElementSelect(enabled);
    };
    
    /**
     * @description check if the FocusElement is enabled.
     * @return {boolean} - if FocusElement is enabled
     */
    Canvas.prototype.isFocusElementEnabled = function() {
        return this._focusElement.enabled;
    };

    Canvas.prototype.setSectionSensitivity = function(sensitivity) {
        this._section.setSensitivity(sensitivity);
    };

    /**
     * @description enable the rotation mode of section
     * @param {boolean} enabled - true for yes.
     * @return {undefined}
     */
    Canvas.prototype.setSectionRotatable = function(enabled) {
        this._section.setRotatable(enabled);
        this._refreshRendering(1);
        this._renderer.renderState.invalidateClip();
    };
    
    /**
     * @description enable the section interaction. When it is set to false,
     * section's interaction widget does not show.
     * @param {boolean} enabled - true of yes.
     * @return {undefined}
     */
    Canvas.prototype.setSectionInteractEnabled = function(enabled) {
        this._section.setInteractEnabled(enabled);
        this._refreshRendering();
    };

    /**
     * @description check if the section's interaction is on.
     * @return {boolean} - if section is interactive
     */
    Canvas.prototype.isSectionInteractEnabled = function() {
        return this._section.isInteractEnabled();
    };

    /**
     * @description reset the section to initial state.
     * @return {undefined}
     */
    Canvas.prototype.resetSection = function() {
        this._section.reset(this._renderer);
        //this._renderScene.setSectionEnabled(true);
        this._stateManager.onSectionChanged();
        this._refreshRendering();
    };

    /**
     * @description set the section states.
     * @param {array} clipMin - the normalized minimum point position
     * @param {array} clipMax - ditto.
     * @return {undefined}
     */
    Canvas.prototype.setSectionRanges = function(clipMin, clipMax) {
        this._section.setClipRanges(clipMin, clipMax);
        this._stateManager.onSectionChanged();
        this._refreshRendering();
    };

    Canvas.prototype.isRulerEnabled = function() {
        return this._ruler.isEnabled();
    };

    Canvas.prototype.setRulerSnappingEnabled = function(enabled) {
        return this._ruler.setSnappingEnabled(enabled);
    };
    
    /**
     * @description toggle the ruler 
     * @param {boolean} enabled - true for yes.
     * @return {undefined}
     */
    Canvas.prototype.setRulerEnabled = function(enabled) {
        this._stateManager.updateMode(MODE_MEASURE, enabled);
        this._ruler.setEnabled(enabled);
        this._stateManager.onMeasureEnabled(enabled);
        this._refreshRendering();
    };
    
    /**
     * @description return the default length unit of the scene.
     * @return {string} - can be either "cm", "feet" or other.
     */
    Canvas.prototype.getRulerDefaultUnit = function() {
        return this._scene.unit;
    };

    Canvas.prototype.isProtractorEnabled = function() {
        return this._protractor.isEnabled();
    };

    Canvas.prototype.setProtractorSnappingEnabled = function(enabled) {
        return this._protractor.setSnappingEnabled(enabled);
    };
    
    /**
     * @description toggle the ruler 
     * @param {boolean} enabled - true for yes.
     * @return {undefined}
     */
    Canvas.prototype.setProtractorEnabled = function(enabled) {
        this._stateManager.updateMode(MODE_PROTRACTOR, enabled);
        this._protractor.setEnabled(enabled);
        this._stateManager.onMeasureEnabled(enabled);
        this._refreshRendering();
    };
    
    /**
     * @description return is the magnify glass (zoom with rectangle) effective 
     * @return {boolean} - is the magnify glass enabled
     */
    Canvas.prototype.isMagnifyGlassEnable = function() {
        return this._magnifyGlass.isEnabled();
    };

    /**
     * @description enable the magnify glass (zoom with rectangle) 
     * @param {boolean} enabled - true for yes
     * @return {undefined}
     */
    Canvas.prototype.setMagnifyGlassEnable = function(enabled) {
        this._stateManager.updateMode(MODE_MAGNIFY, enabled);
        this._renderScene.setProgressiveEnabled(false);
        this._magnifyGlass.setEnabled(enabled);
    };

    /**
     * @description set the glass line thickness.
     * @param {float} lineWidth - the line thickness. The default is 1.
     * @return {undefined}
     */
    Canvas.prototype.setMagnifyGlassLineWidth = function(lineWidth) {
        this._magnifyGlass.setLineWidth(lineWidth);
    };

    /**
     * @description enable the material change.
     * @param {boolean} enabled - true for yes
     * @return {undefined}
     */
    Canvas.prototype.setChangeMaterialEnabled = function(enabled) {
        if (!Globals.isMobile) {
            this._stateManager.updateMode(MODE_CHANGE_MATERIAL, enabled);
            this._changeMaterial.setEnabled(enabled);
            this._stateManager.onChangeMaterialEnabled(enabled);
            this._refreshRendering();
        }
    };

    /**
     * @description change the material's color
     * @param {string} material - the material name
     * @param {color} color - a RGB color in 3 floats.
     * @return {undefined}
     */
    Canvas.prototype.setChangeMaterialColor = function(material, color) {
        this._changeMaterial.setMaterialColor(material, color);
        this._refreshRendering();
    };

    /**
     * @description change the material's transparency
     * @param {string} material - the material name
     * @param {transparency} transparency - a value between 0 and 1.
     * @return {undefined}
     */
    Canvas.prototype.setChangeMaterialColorTransparency = function(material, transparency) {
        this._changeMaterial.setMaterialTransparency(material, transparency);
        this._stateManager.onSceneChanged();
        this._refreshRendering();
    };

    /**
     * @description return the name of picked color in material change mode.
     * @return {string} - the picked material name
     */
    Canvas.prototype.getChangeMaterialPickedMaterial = function() {
        // Since on mobile there is no change material control, we disable
        // these change material interaction functions.
        if (!Globals.isMobile) {
            return this._changeMaterial.getPickedMaterial();
        }
        return null;
    };

    /**
     * @description release the picked material. 
     * @return {undefined}
     */
    Canvas.prototype.clearChangeMaterialPickedMaterial = function() {
        if (!Globals.isMobile) {
            this._changeMaterial.clearPickedMaterial();
            this._refreshRendering();
        }
    };

    /**
     * @description restore the materials to their original colors.
     * @return {undefined}
     */
    Canvas.prototype.restoreChangeMaterialColors = function() {
        if (!Globals.isMobile) {
            this._changeMaterial.restoreMaterials();
            this._stateManager.onSceneChanged();
            this._refreshRendering();
        }
    };

    /**
     * @description save the material colors.
     * @return {undefined}
     */
    Canvas.prototype.backupChangeMaterialColors = function() {
        if (!Globals.isMobile) {
            this._changeMaterial.backupMaterials();
        }
    };

    /**
     * @description WARNING! not functional now.
     * @param {object} data - the screen shader update data.
     * @return {undefined}
     */
    Canvas.prototype.updateScreenShareData = function(data) {
        this._screenShare.updateClientData(data);
        this._refreshRendering();
    };

    /**
     * @description focus to a comment.
     * @param {object} comment - the frontend comment object.
     * @return {undefined}
     */
    Canvas.prototype.setCommentFocused = function(comment) {
        if (this._commentManager.setFocusedComment(comment, this._sceneCamera, this._vr.enabled)) {
            this._stateManager.onCommentChanged();
        }
    };

    /**
     * @description change the transition speed of comments.
     * @param {object} speed - the speed (1-30).
     * @return {undefined}
     */
    Canvas.prototype.setCommentTransitionSpeed = function(speed) {
        this.cameraManipulator.setTransitionSpeed(speed);
        this._commentManager.setTransitionSpeed(speed);
    };

    /**
     * @description change to a user view. All user views are created by model author
     * and stored in the model scene file.
     * @param {object} viewData - the view data.
     * @return {undefined}
     */
    Canvas.prototype.switchToUserView = function(viewData) {
        this.cameraManipulator.switchToUserView(viewData, this._vr.enabled);

        if (viewData) {
            //this._stateManager.onCommentChanged();

            // If this view has its own set of visible drawables, we need 
            // to trigger the scene graph change callback.
            if (viewData.drawables.length > 0) {
                this._stateManager.onSceneChanged();
            }
            // Ditto.
            if (viewData.layers.length > 0) {
                this._stateManager.onLayerChanged();
                this._refreshRendering();
            }

            this._renderer.invalidate();
        }
    };

    /**
     * @description return the default view of a scene
     * @param {object} 
     * @return {undefined}
     */
    Canvas.prototype.getDefaultUserView = function() {
        return this._scene.getDefaultView();
    };

    /**
     * @description fetch the rendering information for a comment. It is called by frontend which
     * saves these rendering information to the backend so next time the comment is loaded, the
     * same rendering appearance can be reconstructed.
     * @param {int} x - the x screen coordinate of the comment to be created.
     * @param {int} y - ditto
     * @return {undefined}
     */
    Canvas.prototype.createCommentRenderData = function(x, y) {
        // To restart PR since PR will block comment rendering if it occurs in the middle of PR.
        this._refreshRendering();
        return this._commentManager.retrieveRenderData(x, y, this._sceneCamera, this._renderer);
    };

    /**
     * @description initialize render data for a comment. 
     * @param {object} comment - the frontend comment object.
     * @return {undefined}
     */
    Canvas.prototype.addCommentRenderData = function(comment) {
        this._commentManager.initializeRenderData(comment, this._sceneCamera);
    };

    /**
     * @description frontend feeds the comment data into rendering.
     * @param {array} comment - an array of comments.
     * @return {undefined}
     */
    Canvas.prototype.setCommentData = function(comment) {
        this._commentManager.setCommentData(comment);
    };

    /**
     * @description enable comment
     * @param {boolean} enabled - true for yes.
     * @return {undefined}
     */
    Canvas.prototype.setCommentEnabled = function(enabled) {
        this._commentManager.setEnabled(enabled);
        this._stateManager.onCommentEnabled(enabled);
    };
    
    /**
     * @description is commenting enabled
     * @return {boolean} - true when commenting is enabled
     */
    Canvas.prototype.isCommentEnabled = function() {
        return this._commentManager.isEnabled();
    };

    /**
     * @description change the pan speed when using touch
     * @param {float} velocity - speed
     * @return {undefined}
     */
    Canvas.prototype.setTouchPanSpeed = function(velocity) {
        this.cameraManipulator.setTouchPanSpeed(velocity);
    };

    /**
     * @description change the zoom speed when using touch
     * @param {float} velocity - speed
     * @return {undefined}
     */
    Canvas.prototype.setTouchZoomSpeed = function(velocity) {
        this.cameraManipulator.setTouchZoomSpeed(velocity);
    };

    /**
     * @description change the rotate speed when using touch
     * @param {float} velocity - speed
     * @return {undefined}
     */
    Canvas.prototype.setTouchRotateSpeed = function(velocity) {
        this.cameraManipulator.setTouchRotateSpeed(velocity);
    };

    /**
     * @description change the pan speed when using mouse
     * @param {float} velocity - speed
     * @return {undefined}
     */
    Canvas.prototype.setMousePanSpeed = function(velocity) {
        this.cameraManipulator.setMousePanSpeed(velocity);
    };

    /**
     * @description change the zoom speed when using mouse
     * @param {float} velocity - speed
     * @return {undefined}
     */
    Canvas.prototype.setMouseZoomSpeed = function(velocity) {
        this.cameraManipulator.setMouseZoomSpeed(velocity);
    };

    /**
     * @description change the rotate speed when using mouse
     * @param {float} velocity - speed
     * @return {undefined}
     */
    Canvas.prototype.setMouseRotateSpeed = function(velocity) {
        this.cameraManipulator.setMouseRotateSpeed(velocity);
    };

    /**
     * @description change the pan speed when using keyboard
     * @param {float} velocity - speed
     * @return {undefined}
     */
    Canvas.prototype.setKeyPanSpeed = function(velocity) {
        this.cameraManipulator.setKeyPanSpeed(velocity);
    };

    /**
     * @description change the forward speed when using keyboard
     * @param {float} velocity - speed
     * @return {undefined}
     */
    Canvas.prototype.setKeyForwardSpeed = function(velocity) {
        this.cameraManipulator.setKeyForwardSpeed(velocity);
    };

    /**
     * @description change scene camera's fov. Only effective when camera
     * is in perspective projection mode.
     * @param {integer} fov - a value in (0,189) that defines the vertical field of view.
     * @return {undefined}
     *
     */
    Canvas.prototype.setFov = function(fov) {
        this._sceneCamera.setTargetFov(fov);
        this._refreshRendering();
    };

    /**
     * @description enable/disable panorama widget
     * @param {boolean} enabled - true or false
     * @return {undefined}
     */
    Canvas.prototype.setPanoramaEnabled = function(enabled) {
        return this._panorama.setEnabled(enabled);
    };
    
    /**
     * @description update panorama data
     * @param {object} modelInformation - the current model information of this page
     * @param {array} promises - an array of download promises
     * @param {vec3} comments - the comments data which has panorama images attached
     * @return {promise} - it takes a while to load the panorama images
     */
    Canvas.prototype.updatePanorama = function(modelInformation, promises, type, comments, commentPosition, cameraData) {
        return this._panorama.update(modelInformation, promises, type, comments, commentPosition || this._sceneCamera.eye, cameraData);
    };
    
    Canvas.prototype.navigationPinPoint = function(x, y) {
        var worldPosition = this._inAppNavigation.pinPoint(x, y);
        if (worldPosition !== null) {
            this._savedViewMode = this.isFirstPersonViewEnabled();
            this.setFirstPersonViewEnabled(true, true);
            this.cameraManipulator.setInAppNaviAdjusting(true);
            
            this._inAppNavigation.getGodView();
            
            return this._inAppNavigation.getMapCoord(worldPosition);
        }
        return null;
    };

    /**
     * @desription enter the navigation adding point mode
     * @param {boolean} enabled - yes or no
     */
    Canvas.prototype.navigationSetAddPointMode = function(enabled) {
        this._stateManager.updateMode(MODE_NAVIGATION_ADDPOINT, enabled);
    };

    Canvas.prototype.navigationDumpMiniMap = function(eyeX, eyeY, widthRange, heightRange, imgWidth, imgHeight, isUpdateDepthMap, useSketchEffect, resetScreenPosition) {
        //get the god view camera, only when we decided the height
        //we can get the correct projection matrix, so it has to pin point
        //first, then do the get camera thing
        var camera = this._inAppNavigation.getGodView(eyeX, eyeY, widthRange, heightRange, imgWidth, imgHeight, resetScreenPosition);
        
        var backgroundEnabled = false;
        //Disable background first since it will surround the scene and make the mini map wrong
        if (this._scene.skybox && this._scene.skybox.enabled) {
            backgroundEnabled = true;
            this._scene.skybox.enabled = false;
        }
        
        if (isUpdateDepthMap) {
            this._inAppNavigation.generateDepthMap();
        }
        
        // Let navigation take over
        var savedCamera = this._sceneCamera;

        // Dump the minimap
        this._sceneCamera = camera;

        // 1.Switch to normal shadow
        this._renderScene.setShadowCamera(camera);
        this._renderScene.useFineShadow(true);

        // 2.Set the section
        var isSectionEnabled = this.isSectionEnabled();
        this.setSectionEnabled(true);
        this._renderScene.updateAO();
        var minClip = this._scene.clipping.getMin();
        var maxClip = this._scene.clipping.getMax();

        this._scene.clipping.set(minClip, [maxClip[0], maxClip[1], this._inAppNavigation.getViewHeight()]);

        // 3.Update Shadow
        this._renderScene.updateShadow();
        // 4.Dump image 
        // if sketch enabled, need to set some parameters to make the mini map looks nice
        // lightening 0.735
        // light latitude  1.1938052083641213 and longitude 3.392920065876977
        // penDetail 2 & inkContrast 35

        var savedParameter = {};

        if (useSketchEffect) {
            savedParameter.isShadowEnabled = this._renderScene.isShadowEnabled();
            this.setSketchEnabled(true);
            this.setShadowEnabled(false);
            savedParameter.lightening = this._scene.getMainLight().getIntensity();
            savedParameter.latitude = this._scene.getMainLight().getLatitude();
            savedParameter.longitude = this._scene.getMainLight().getLongitude();
            savedParameter.penDetail = this._renderScene.getSketch().getDetail();
            savedParameter.inkContrast = this._renderScene.getSketch().getContrast();

            this.setLightingIntensity(0.735);
            this.setLightingLatitude(1.1938052083641213);
            this.setLightingLongitude(3.392920065876977);
            this.setSketchDetailLevel(2);
            this.setSketchContrast(35);
        }
        
        var minimap = this.dump(this._inAppNavigation.mapWidth, this._inAppNavigation.mapHeight);
        
        //5.Restore all the status
        if (useSketchEffect) {
            this.setLightingIntensity(savedParameter.lightening);
            this.setLightingLatitude(savedParameter.latitude);
            this.setLightingLongitude(savedParameter.longitude);
            this.setSketchDetailLevel(savedParameter.penDetail);
            this.setSketchContrast(savedParameter.inkContrast);
            
            this.setSketchEnabled(savedParameter.isSketchEnabled);
            this.setShadowEnabled(savedParameter.isShadowEnabled);
        }

        this._scene.clipping.set(minClip, maxClip);
        this.setSectionEnabled(isSectionEnabled);

        // 6.Update Shadow again to restore original shadow mapHeight
        this._sceneCamera = savedCamera;
        // As the pixel ratio may be floating number, the resolution of window
        // may change after the dump the minimap after two times of rounding
        // off (e.g., 1 pixel difference). We need to adjust scene camera
        // viewport to match the window size. 
        this._sceneCamera.resize(Globals.width, Globals.height);
        this._renderScene.setShadowCamera(savedCamera);
        this._renderScene.updateShadow();
        this._renderScene.updateAO();
        this._inAppNavigation.setMiniMap(minimap);
        
        //Enable background again
        if (backgroundEnabled) {
            this._scene.skybox.enabled = true;
        }
        return minimap;
    };
    
    Canvas.prototype.navigationFloorPlanInit = function(range, imgWidth) {
        this._inAppNavigation.setFloorPlanEnabled(true);
        this._inAppNavigation.getGodViewForFloorPlan(range, imgWidth);
    };
    
    Canvas.prototype.navigationGetScreenPosList = function() {
        return this._inAppNavigation.getScreenPosList();
    };

    Canvas.prototype.navigationSetEnabled = function(enabled) {
        this._inAppNavigation.setEnabled(enabled);
        this._stateManager.onNavigationEnabled(enabled);
        this._refreshRendering();
    };
   
    Canvas.prototype.navigationNavigate = function(stepFraction) {
        return this._inAppNavigation.navigate(stepFraction);
    };
    
    Canvas.prototype.navigationRestart = function() {
        this._inAppNavigation.restart();
    };
    
    Canvas.prototype.navigationLoadData = function(data) {
        this._inAppNavigation.loadData(data);
        this.navigationDumpMiniMap();
    };

    // In in app navigation part, (path point) + (focus point) = (key point)
    Canvas.prototype.navigationSpecifyPathPoint = function(x, y) {
        this._savedViewMode = this.isFirstPersonViewEnabled();
        this.setFirstPersonViewEnabled(true, true);
        this.cameraManipulator.setInAppNaviAdjusting(true);
        return this._inAppNavigation.lookAt(x, y);
    };

    // When focus is specified, we add a key point
    Canvas.prototype.navigationSpecifyFocusPoint = function(x, y) {
        var res = this._inAppNavigation.addKeyPoint(x, y);
        //exit restriction mode
        if (res) {
            this.setFirstPersonViewEnabled(this._savedViewMode, false);
            this.cameraManipulator.setInAppNaviAdjusting(false);
        }
        return res;
    };

    Canvas.prototype.navigationCancalSepcifyFocusPoint = function() {
        //exit restriction mode
        this.setFirstPersonViewEnabled(this._savedViewMode, false);
        this.cameraManipulator.setInAppNaviAdjusting(false);
    };

    Canvas.prototype.navigationAdjustPathPoint = function(idx, x, y) {
        var res = this._inAppNavigation.adjustPathPoint(idx, x, y);
        
        if (res) {
            this._savedViewMode = this.isFirstPersonViewEnabled();
            this.setFirstPersonViewEnabled(true, true);
            this.cameraManipulator.setInAppNaviAdjusting(true);
        }
        
        return res;
    };
    
    Canvas.prototype.navigationAdjustFocusPoint = function(idx, x, y) {
        var res = this._inAppNavigation.adjustFocusPoint(idx, x, y);
        if (res) {
            this.setFirstPersonViewEnabled(this._savedViewMode, false);
            this.cameraManipulator.setInAppNaviAdjusting(false);
        }
        return res;
    };
    
    Canvas.prototype.navigationDeleteKeyPoint = function(idx) {
        this._inAppNavigation.deleteKeyPoint(idx);
    };

    Canvas.prototype.navigationGetMapCoord = function() {
        return this._inAppNavigation.getMapCoord();
    };
    
    Canvas.prototype.navigationSetSpeed = function(speed){
        this._inAppNavigation.setSpeed(speed);
    };

    Canvas.prototype.navigationLookAt = function(x, y, tx, ty) {
        return this._inAppNavigation.lookAt(x, y, tx, ty);
    };

    Canvas.prototype.navigationSetViewHeightByRatio = function(ratio) {
        this._inAppNavigation.setViewHeightByRatio(ratio);
    };
    
    Canvas.prototype.navigationGetViewHeightRatio = function() {
        return this._inAppNavigation.getViewHeightRatio();
    };
    
    Canvas.prototype.navigationGetMiniMap = function() {
        return this._inAppNavigation.getMiniMap();
    };
    
    Canvas.prototype.navigationStop = function(forceStop) {
        this._inAppNavigation.stop(forceStop);
        if (this._vr.enabled) {
            this.orientation.reset(this._sceneCamera); 
        }
    };
    
    Canvas.prototype.navigationGetTrajectories = function() {
        return this._inAppNavigation.getTrajectories();
    };
    
    Canvas.prototype.navigationJumpTo = function(ratio) {
        return this._inAppNavigation.jumpTo(ratio);
    };

    Canvas.prototype.navigationGetSteps = function() {
        return this._inAppNavigation.getSteps();
    };
    
    Canvas.prototype.startCameraOrbitRotating = function() {
        if (!(this._sceneCamera.animator instanceof CameraAnimatorOrbit)) {
            var animator = new CameraAnimatorOrbit();
            animator.bind(this._sceneCamera);
            animator.start();
        }
    };

    /**
     * Set the rotation of the terrain model.
     * @param {number} angle - The angle of rotation in degrees. It ranges from [0, 360).
     */
    Canvas.prototype.setTerrainRotation = function(angle) {
        if (this._scene.terrain) {
            this._scene.terrain.setRotation(angle);
            this._scene.updateBBox();
            this._refreshRendering();
        }
    };
    /**
     * Set the scaling factor of the terrain model.
     * @param {number} scale - The scale factor ranges in (0, inf)
     */
    Canvas.prototype.setTerrainScaling = function(scale) {
        if (this._scene.terrain) {
            this._scene.terrain.setScaling(scale);
            this._scene.updateBBox();
            this._refreshRendering();
        }
    };
    /**
     * Set the translation of the terrain model.
     * @param {number} x - The translation distance in x, ranges in (-inf, +inf).
     * @param {number} y - Ditto
     * @param {number} z - Ditto.
     */
    Canvas.prototype.setTerrainTranslation = function(x, y, z) {
        if (this._scene.terrain) {
            this._scene.terrain.setTranslation(x, y, z);
            this._scene.updateBBox();
            this._refreshRendering();
        }
    };

    /**
     * Get the transform of the terrain.
     * @return {Array<number>} - [angle, scaling, x, y, z]
     */
    Canvas.prototype.getTerrainTransform = function() {
        if (this._scene.terrain) {
            var angle = this._scene.terrain.getRotation();
            var translation = this._scene.terrain.getTranslation();
            var scaling = this._scene.terrain.getScaling();

            return [scaling, angle, translation[0], translation[1], translation[2]];
        }

        return null;
    };
    
    /**
     * @description register a plugin
     * @param {string} jsurl - the URL of plugin
     * @return {undefined}
     */
    Canvas.prototype.registerPlugin = function(jsurl) {
        this._pluginManager.loadPlugin(jsurl);
    };

    /**
     * @description unregister a plugin
     * @param {string} jsurl - the URL of plugin
     * @return {undefined}
     */
    Canvas.prototype.unregisterPlugin = function(jsurl) {
        this._pluginManager.unregisterPlugin(jsurl);
    };

    Canvas.prototype._refreshRendering = function(refreshes) {
        this._renderScene.setProgressiveEnabled(false);
        this._sceneCamera.setBimCullingEnabled(this._bimCullingEnabled);

        // When we were at pause state and are about to render again caused
        // by a rendering refresh, we need to trigger a callback.
        if (this._needUpdate < 1 && this._lazyRendering) {
            this._onAnimationStart();
        }

        // How many times of rendering we want to have.
        refreshes = refreshes || 3;

        // Using 1.01 ensure this._needUpdate > 0 and we
        // can trigger another rendering.
        this._needUpdate += refreshes * 1.01;
        if (this._needUpdate > 20.01) {
            this._needUpdate = 20.01;
        }
    };

    Canvas.prototype.transformPerspectiveToOrthogonal = function() {
        this.cameraManipulator.transformPerspectiveToOrthogonal();
        this._refreshRendering();
    };

    Canvas.prototype.transformOrthogonalToPerspective = function() {
        this.cameraManipulator.transformOrthogonalToPerspective();
        this._refreshRendering();
    };

    /**
     * @description get BIM information of the scene
     * @return {object} - BIM object
     */
    Canvas.prototype.getBim = function() {
        return this._scene.bim;
    };

    /**
     * @description get BIM elements color of the scene, null if the elements is with texture
     * @return {array} - color array
     */
    Canvas.prototype.getElementsColor = function(elements) {
        return this._focusElement.getColors(elements);
    };
    
    /**
     * @description focus a set of elements
     * @param {array} elements - an array of element IDs, e.g., ["123121", "543563"]
     * @param {boolean} changeCamera - flag to indicate if the camera should get colse to the elements. By default, it is not.
     */
    Canvas.prototype.focusElements = function(elements, changeCamera) {
        this._focusElement.focus(elements, changeCamera);
        this._refreshRendering();
    };
    
    /**
     * @description change colors a set of elements
     * @param {array} elements - an array of element IDs, e.g., ["123121", "543563"]
     * @param {array} color - a 4-elements array of color, e.g., [1.0, 0.0, 0.0, 0.5] means transparent red
     */
    Canvas.prototype.setElementsColor = function(elements, color) {
        this._renderScene.setElementsColor(elements, color);
        this._refreshRendering();
    };
    
    /**
     * @description change visibilities a set of elements
     * @param {array} elements - an array of element IDs, e.g., ["123121", "543563"]
     * @param {bool} visibility - set these elements to show or hide
     */
    Canvas.prototype.setElementsVisibility = function(elements, visibility) {
        this._renderScene.setElementsVisibility(elements, visibility);
        this._refreshRendering();
    };
    
    Canvas.prototype._initializeTouchEvents = function() {
        var that = this;
        var touchStartCords = {
            x: 0,
            y: 0
        }
            
        this.touch = new Touch(this.canvas);

        this.touch.touchStartCallback = function() {
            var passdown = true;
            touchStartCords.x = that.touch.cursor(0).x;
            touchStartCords.y = that.touch.cursor(0).y;

            if (that.touch.isDoubleClick) {
                if (window.getSelection) {
                    window.getSelection().removeAllRanges();
                } else if (document.selection) {
                    document.selection.empty();
                }
                if (!that._vr.enabled && !that._panorama.enabled) {
                    that.cameraManipulator.onTouchDoubleClick(that.touch, that._renderer, that._sceneCamera);
                }
                passdown = false;
            }

            if (passdown && that._mode === MODE_SECTION) {
                var isActivePanel = that._section.onTouchStart(that.touch, that._sceneCamera);
                if (isActivePanel) {
                    that._refreshRendering();
                    that._renderer.renderState.invalidateClip();
                }
                passdown = !isActivePanel;
                if (!that.sectionCursor && isActivePanel) {
                    that.sectionCursor = true;
                    that._eventEmitter.emit("hoveringSectionPlane");
                } else if (that.sectionCursor && !isActivePanel) {
                    that.sectionCursor = false;
                    that._eventEmitter.emit("leavingSectionPlane");
                    that._refreshRendering();
                }
            }

            if (passdown && that._mode === MODE_CHANGE_MATERIAL) {
                that._changeMaterial.onTouchStart(that.touch, that._renderer, that._sceneCamera);
                if (!passdown) {
                    that._refreshRendering();
                }
            }
            if (passdown && that._mode === MODE_MAGNIFY) {
                that._magnifyGlass.onTouchStart(that.touch);
            }
        };
        this.touch.touchMoveCallback = function() {
            if (window.getSelection) {
                window.getSelection().removeAllRanges();
            } else if (document.selection) {
                document.selection.empty();
            }
            var passdown = true;

            if (passdown && that._mode === MODE_SECTION) {
                var isActivePanel = that._section.onTouchMove(that.touch);
                if (isActivePanel) {
                    that._refreshRendering(1);
                    that._renderer.renderState.invalidateClip();
                }
                passdown = !isActivePanel;

                if (!that.sectionCursor && isActivePanel) {
                    that.sectionCursor = true;
                    that._eventEmitter.emit("hoveringSectionPlane");
                } else if (that.sectionCursor && !isActivePanel) {
                    that.sectionCursor = false;
                    that._eventEmitter.emit("leavingSectionPlane");
                    that._refreshRendering(1);
                }
            }

            if (passdown && that._mode === MODE_MAGNIFY) {
                passdown = that._magnifyGlass.onTouchMove(that.touch);
                if (!passdown) {
                    that._needUpdate++;
                }
            }

            if (passdown && !that._vr.enabled && !that._panorama.enabled) {
                that.cameraManipulator.onTouchMove(that.touch);
            }
        };
        this.touch.touchStopCallback = function() {
            if (that._vr.enabled) {
                return;
            }

            // Change the material color and update the picked object.
            if (that._mode === MODE_CHANGE_MATERIAL) {
                that._changeMaterial.onTouchStop(that.touch);
                that._refreshRendering();
            }

            if (that._mode === MODE_MEASURE) {
                that._ruler.onTouchStop(that.touch, that._renderer, that._sceneCamera);
                that._refreshRendering();
            }

            if (that._mode === MODE_PROTRACTOR) {
                that._protractor.onTouchStop(that.touch, that._renderer, that._sceneCamera);
                that._refreshRendering();
            }

            if (that._mode === MODE_NAVIGATION_ADDPOINT) {
                var cursor = that.touch.cursor(0);
                if (cursor) {
                    var dx = touchStartCords.x - cursor.x;
                    var dy = touchStartCords.y - cursor.y;
                    if ( (Math.abs(dx) + Math.abs(dy))  < 15) {
                        cursor.x = cursor.x - that.touch.canvas.offsetLeft;
                        that._eventEmitter.emit("addedNavigationPoint", cursor);
                    }
                }
            }

            if (that._mode === MODE_SECTION) {
                that._section.onTouchStop();
                that._stateManager.onSectionChanged();
                that._refreshRendering();
            }

            if (that._mode === MODE_MAGNIFY) {
                that._magnifyGlass.onTouchStop(that.touch, that._renderer);
                that._needUpdate++;
            }
        };
    };

    /**
     * Enable the transform gizmo control and attach it to terrain.
     * @param enabled {boolean} - yes or no.
     */
    Canvas.prototype.setTransformGizmoEnabled = function(enabled) {
        if (enabled) {
            this._widget.setPosition(
                this._scene.terrain.bbox[0],
                this._scene.terrain.bbox[1],
                this._scene.terrain.bbox[2]);

            var that = this;
            this._widget.setCallback(function(x, y, z) {
                if (that._widgetMovementCallback) {
                    that._widgetMovementCallback();
                }
                that._scene.terrain.translate(x, y, z);
                that._scene.updateBBox();
                that._refreshRendering();
            });
        } else {
            this._widget.setCallback(null);
        }
        
        this._widget.setEnabled(enabled);
    };

    Canvas.prototype.setTransformGizmoMovementCallback = function(cbk) {
        this._widgetMovementCallback = cbk;
    };

    Canvas.prototype._initializeMouseEvents = function() {
        var that = this;

        // mouse events
        this.mouse = new Mouse(this.canvas);

        this.mouse.mouseDownCallback = function() {
            if (!that._vr.enabled && !that._panorama.enabled) {
                that.cameraManipulator.onMouseDown(that.mouse);
            }
            if (that._mode === MODE_MAGNIFY) {
                that._magnifyGlass.onMouseDown(that.mouse);
            }
        };
        
        this.mouse.mouseMoveCallback = function() {
            var range = window.getSelection();
            if (range.type !== "Caret") {
                range.removeAllRanges();
            }

            var passdown = true;

            that._panorama.onMouseMove(that.mouse);

            if (that._mode === MODE_CHANGE_MATERIAL) {
                passdown = that._changeMaterial.onMouseMove(that.mouse, that._renderer, that._sceneCamera);
                if (!passdown) {
                    that._refreshRendering(1);
                }
            }

            if (passdown && that._mode === MODE_MAGNIFY) {
                passdown = that._magnifyGlass.onMouseMove(that.mouse);
                if (!passdown) {
                    that._needUpdate++;
                }
            }
            
            if (passdown && that._mode === MODE_SECTION) {

                var isActivePanel = that._section.onMouseMove(that.mouse, that.mouse.event.buttonDown === 1, that._sceneCamera, that._renderer);
                if (isActivePanel) {
                    that._refreshRendering(1);
                    that._renderer.renderState.invalidateClip();
                }
                passdown = !(isActivePanel && that.mouse.event.buttonDown === 1);
                if (!that.sectionCursor && isActivePanel) {
                    that.sectionCursor = true;
                    that._eventEmitter.emit("hoveringSectionPlane");
                } else if (that.sectionCursor && !isActivePanel) {
                    that.sectionCursor = false;
                    that._eventEmitter.emit("leavingSectionPlane");
                    that._refreshRendering(1);
                }
            }
            
            if (passdown && that._widget.isEnabled()) {
                passdown = that._widget.onMouseMove(that.mouse, that._renderer, that._sceneCamera);
                that._refreshRendering();
            }

            if (passdown && that._mode === MODE_MEASURE) {
                that._ruler.onMouseMove(that.mouse, that._renderer, that._sceneCamera);
                that._refreshRendering(1);
            }

            if (passdown && that._mode === MODE_PROTRACTOR) {
                that._protractor.onMouseMove(that.mouse, that._renderer, that._sceneCamera);
                that._refreshRendering(1);
            }

            if (passdown) {
                if (!that._vr.enabled && !that._panorama.enabled) {
                    that.cameraManipulator.onMouseMove(that.mouse);
                }
            }
        };
                        
        var material = that._scene.materialManager.createMaterialAdhoc("test");
        
        this.mouse.mouseUpCallback = function() {
            if (!that.mouse.moved) {
                // Change the material color and update the picked object.
                if (that._mode === MODE_CHANGE_MATERIAL) {
                    that._changeMaterial.onMouseUp(that.mouse);
                    that._refreshRendering();
                }

                // The ruler measurement
                if (that._mode === MODE_MEASURE) {
                    that._ruler.onMouseUp(that.mouse, that._renderer, that._sceneCamera);
                    that._refreshRendering();
                }

                if (that._mode === MODE_PROTRACTOR) {
                    that._protractor.onMouseUp(that.mouse, that._renderer, that._sceneCamera);
                    that._refreshRendering();
                }

                if (that._mode === MODE_NAVIGATION_ADDPOINT) {
                    that._eventEmitter.emit("addedNavigationPoint", that.mouse);
                }

                if (Globals.bim && that._focusElement.enabled) {
                    window.setTimeout(function() {
                        if (!that._doubleClick) {
                            var focusedElement = that._focusElement.onMouseUp(that.mouse, that._renderer);
                            var res = that._scene.model.graph.getElementPaths(focusedElement);
                            if (res) {
                                that._eventEmitter.emit("onElementSelected", res);
                            } else {
                                that._eventEmitter.emit("onElementSelected", null);
                            }
                            that._refreshRendering();
                        }
                        
                    }, 200);
                }
            }

            if (that._mode === MODE_SECTION) {
                that._section.onMouseUp(that.mouse, that._renderer, that._sceneCamera);
                that._stateManager.onSectionChanged();
                that._refreshRendering();
            }

            if (that._mode === MODE_MAGNIFY) {
                that._magnifyGlass.onMouseUp(that.mouse, that._renderer);
                that._needUpdate = 0;
                that._refreshRendering();
            }

            if (!that._vr.enabled  && !that._panorama.enabled) {
                that._widget.onMouseUp(that.mouse);
                that.cameraManipulator.onMouseUp(that.mouse);
            }
        };
        
        that.mouse.mouseWheelCallback = function() {

            if (!that._vr.enabled  && !that._panorama.enabled) {
                that.cameraManipulator.onMouseWheel(that.mouse);
            }
            
            if (!that._panorama.enabled) {
                that._panorama.onMouseWheel(that.mouse);
            }

            if (that._mode === MODE_MEASURE) {
                that._ruler.onMouseWheel(that.mouse, that._renderer, that._sceneCamera);
            }

            if (that._mode === MODE_PROTRACTOR) {
                that._protractor.onMouseWheel(that.mouse, that._renderer, that._sceneCamera);
            }

            if (that._mode === MODE_SECTION) {
                that._section.onMouseWheel(that.mouse);
            }
        };
        
        that.mouse.mouseDoubleClickCallback = function() {
            if (window.getSelection) {
                window.getSelection().removeAllRanges();
            } else if (document.selection) {
                document.selection.empty();
            }

            if (!that._vr.enabled && !that._panorama.enabled) {
                that._doubleClick = true;
                window.setTimeout(function() {
                    that._doubleClick = false;
                }, 250);
                that.cameraManipulator.onMouseDoubleClick(that.mouse, that._renderer);
            }
        };
    };

    Canvas.prototype._initializeKeyboardEvents = function() {
        var that = this;
        // keyboard events
        this.keyboard = new Keyboard();
        this.keyboard.onKeyDownCallback = function(key) {
            if (!that._vr.enabled && !that._panorama.enabled) {
                that.cameraManipulator.onKeyDown(key);
            }
            if (Globals.bim && that._focusElement.enabled && (key === 17 || key === 91)) {
                that._focusElement.setMultiselect(true);
            }
        };
        this.keyboard.onKeyUpCallback = function(key) {
            if (!that._vr.enabled && !that._panorama.enabled) {
                that.cameraManipulator.onKeyDown(key);
            }
            if (Globals.bim && that._focusElement.enabled && (key === 17 || key === 91)) {
                that._focusElement.setMultiselect(false);
            }
        };
    };
    
    Canvas.prototype._initializeGyrosensorEvents = function() {
    };
    
    Canvas.prototype._loadModel = function(modelInformation, modelPromises, cameraInfo, sectionInfo, 
            onComplete1) {
        var step = 0.1;
        var loader = new LoadScene(this._scene.id === "551d4326e437414c17000005", this._scene,
                this._sceneCamera, this._resourceManager, this._renderScene);
        var that = this;
        return loader.load(modelInformation, modelPromises,
            // phase 1
            function(sceneData) {
                that._eventEmitter.emit("loadingPhase1Done", modelInformation);

                if (cameraInfo) {
                    // FIXME: before 0.4.0 we don't dump fov of camera.
                    cameraInfo.fov = cameraInfo.fov || 46;
                    that._sceneCamera.restore(cameraInfo);
                }
                if (sectionInfo) {
                    var min = sectionInfo.min || sectionInfo.planes;
                    var max = sectionInfo.max || sectionInfo.points;
                    that._scene.clipping.set(min, max);
                }
                
                // Reset the human height if the scene is old and the scaleRatio is not 1
                if (that._scene.scaleRatio !== 1) {
                    that._inAppNavigation.ORDINARY_PEOPLE_HEIGHT = 5.5 / that._scene.scaleRatio;
                }
                if (that._scene.hasProflileLines) {
                    that.setRenderingLineEnable(false);
                }

                // When it is a large scene, we have to disable rendering update
                // during loading.
                //
                if (sceneData.nodes > 100000 || sceneData.meshKbytes > 100000) {
                    that._visible = false;
                    var animator = new CameraAnimatorInstant();
                    animator.bind(that._sceneCamera);
                    that._sceneCamera.update();
                    that._sceneCamera.animator.unbind();
                } else {
                    // Also we should turn off the bim culling for this small scenes.
                    if (sceneData.version > 1) {
                        that._scene.isBimCullingNeeded = false;
                    }
                }
            },
            // phase 2
            function(sceneData) {
                that._commentManager.upgradeRenderData(sceneData);
                
                that._loadDebug();

                that.state = modelo3d.RENDERING;
                that._lazyRendering = true;
                that._visible = true;

                that._renderScene.onSceneChanged();

                that._refreshRendering();
                that._eventEmitter.emit("loadingPhase2Done", modelInformation);
                
                that._sceneCamera.setCullingEnabled(true);
                Globals.frame = 1; // start counting frames
            },
            // progress
            function(per) {
                // When every the scene gets changed, we need to invalidate the renderer.
                if (Globals.state === modelo3d.LOADING) {
                    that._renderer.invalidate();
                    that._eventEmitter.emit("loadingPhase2Progress", per);
                    // MOD-6873, if the model is too big, we only render the mode 10 times during laoding
                    // process, and the user can not use mouse event to change it.
                    if (per > step && !that._visible) {
                        that.update(true);
                        step += 0.1;
                    }
                }
            }
        );
    };

    return Canvas;
})();
    
