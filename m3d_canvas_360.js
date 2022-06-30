//
// m3d_canvas_360.js
// Draw 360 degree images.
//
//  


import Globals                  from "./m3d_globals.js"
import HWInfo                   from "./00utility/m3d_hwinfo.js";
import ResourceManager          from "./02resource/m3d_resource_manager.js";
import SceneCamera              from "./03scene/camera/m3d_scene_camera.js";
import OffsetCamera             from "./03scene/camera/m3d_offset_camera.js";
import CameraAnimatorInstant    from "./03scene/camera/m3d_camera_animator_instant.js";
import CameraAnimatorMorphing   from "./03scene/camera/m3d_camera_animator_morphing.js";
import SkyBox                   from "./03scene/drawables/m3d_skybox.js";
import Renderer                 from "./04renderer/m3d_renderer.js";
import RenderTarget             from "./04renderer/m3d_rendertarget.js";
import LoadPano                 from "./07loadsave/m3d_load_pano.js"
import CameraManipulator        from "./08ui/tool/m3d_camera_manipulator.js"; 
import Orientation              from "./08ui/input/m3d_orientation.js";
import Touch                    from "./08ui/input/m3d_touch.js";
import Mouse                    from "./08ui/input/m3d_mouse.js";
import Keyboard                 from "./08ui/input/m3d_keyboard.js";
import WebVR                    from "./04renderer/m3d_webvr.js";

export default (function() {
    "use strict";

    function _Indicator(id) {
        this.id             = id;
        this.ray            = {
                                start: vec3.create(),
                                direction: vec3.create() 
                              };
    };

    /**
     * @description The constructor of panorama image rendering canvas object which provides the interface for all 3D functionalities.
     * @constructor 
     * @param {string} canvasName - the name for a HTML5 canvas which 3D renderings goes to.
     * @param {integer} width - the size of canvas object.
     * @param {integer} height - ditto.
     * @param {boolean} isMobile - false if in a desktop browser and true when on mobile.
     * @param {object} frontendCallbacks - an interface of frontend that modelo3d needs to talk to 
     */
    function Canvas360(canvasName, width, height, isMobile, frontendCallbacks, eventEmitter) {
        // private:
        this._visible      = false; // Whether this canvas is visible or not.
        this._needUpdate   = 0; // Force next frame to be updated only once
        this._canResize    = false;

        this._resourceManager   = null;
        this._scene             = null;
        this._renderer          = null;
        this._sceneCameras      = [];
        this._stateManager      = null;
        this._eventEmitter      = eventEmitter;
        this._morphingAnimators = [];
        this._leftSkyboxes      = [];
        this._rightSkyboxes     = [];
        this._indicators        = {};
        this._viewDirection     = vec3.create();
        this._loader            = null;
        
        // public:
        this.cameraManipulator = null;
        this.mouse             = null;
        this.keyboard          = null;
        this.touch             = null;
        this.orientation       = null;
        this.canvas            = null;

        var hwInfo = new HWInfo();
        Globals.gpuMemory         = hwInfo.vramSize / 5; // suppose we need to load 5 large model at same time.
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

        // Initialize rendering and UI
        this._resourceManager      = new ResourceManager();
        this._renderer             = new Renderer(this._resourceManager);
        this._sceneCameras[0]      = new SceneCamera(null);         // For the morphing between two panoramas we need 
                                                                    // to adjust each camera's fov value, that's why 
                                                                    // we need two cameras
        this._sceneCameras[1]      = new SceneCamera(null);
        this._leftCamera           = new OffsetCamera();
        this._rightCamera          = new OffsetCamera();

        this._convergence          = 0.1;
        this._separation           = 1.0;
        this._stereo               = false; // Since there is depth cue, it is not true VR.
        this._renderTarget         = null;
        this._current              = 0;
        this._morphing             = false;
        this._aligment             = false;
        
        this._sceneCameras[0].setCullingEnabled(false);
        this._sceneCameras[0].setFirstPerson(true);
        vec3.set(this._sceneCameras[0].eye, 0, 0, 0);
        this._morphingAnimators[0]   = new CameraAnimatorMorphing();
        
        this._sceneCameras[1].setCullingEnabled(false);
        this._sceneCameras[1].setFirstPerson(true);
        vec3.set(this._sceneCameras[1].eye, 0, 0, 0);
        this._morphingAnimators[1]   = new CameraAnimatorMorphing();
        
        if (Globals.isMobile) {
            //if mobile we need set the camera into target position right away
            this._sceneCameras[0]._targetFov = this._sceneCameras[0]._fov = 78.0;
            this._sceneCameras[0]._targetPhi = this._sceneCameras[0]._phi = 0;
            this._sceneCameras[0]._targetTheta = this._sceneCameras[0]._theta = 0;

            this._sceneCameras[0].animator = new CameraAnimatorInstant();
            this._sceneCameras[0].animator.bind(this._sceneCameras[0]);
            
            this._sceneCameras[1].animator = new CameraAnimatorInstant();
            this._sceneCameras[1].animator.bind(this._sceneCameras[1]);
        } else {
            this._sceneCameras[0].setTargetFov(78.0);
            this._sceneCameras[0]._targetPhi = 0;
            this._sceneCameras[0]._targetTheta = 0;
        }
        
        this._leftCamera.setCullingEnabled(false);
        this._rightCamera.setCullingEnabled(false);

        this._renderTarget = new RenderTarget("default", this._resourceManager, 
        Globals.width, Globals.height, { blend: true, depthTest: false});

        // Initialize the scene's skybox
        this._leftSkyboxes[0] = new SkyBox(this._resourceManager, "left_0");
        this._leftSkyboxes[0].setMode(SkyBox.SKYBOX_CUBEMAP);
        this._leftSkyboxes[1] = new SkyBox(this._resourceManager, "left_1");
        this._leftSkyboxes[1].setMode(SkyBox.SKYBOX_CUBEMAP);

        this._rightSkyboxes[0] = new SkyBox(this._resourceManager, "right_0");
        this._rightSkyboxes[0].setMode(SkyBox.SKYBOX_CUBEMAP);
        this._rightSkyboxes[1] = new SkyBox(this._resourceManager,"right_1");
        this._rightSkyboxes[1].setMode(SkyBox.SKYBOX_CUBEMAP);

        // VR device orientation events
        this.orientation = Globals.isMobile ? new Orientation() : null;

        this.cameraManipulator = new CameraManipulator(null, this._sceneCameras[0], this._resourceManager, 
                                                       null, this._eventEmitter);
        
        this.cameraManipulator.setPanoramaEnabled(true);
        
        this._webvr = new WebVR(this._resourceManager, null, this._eventEmitter);

        //
        // Register mouse/touch events.
        //
        var that = this;

        var isTouchPad = (/hp-tablet/gi).test(navigator.appVersion);
        var hasTouchEvents = "ontouchstart" in window && !isTouchPad;
        if (hasTouchEvents) {
            this.touch = new Touch(this.canvas);

            this.touch.touchStartCallback = function() {

                if(that.touch.isDoubleClick) {
                    if (window.getSelection) {
                        window.getSelection().removeAllRanges();
                    } else if (document.selection) {
                        document.selection.empty();
                    }
                    if (!that._stereo) {
                        that.cameraManipulator.onTouchDoubleClick(that.touch, that._renderer,that._sceneCameras[that._current]);
                    }
                }
            };
            this.touch.touchMoveCallback = function() {
                if (window.getSelection) {
                    window.getSelection().removeAllRanges();
                } else if (document.selection) {
                    document.selection.empty();
                }

                if (!that._stereo) {
                    if (that.touch.numCursors === 2) {
                        var cursor0 = that.touch.cursor(0);
                        var cursor1 = that.touch.cursor(1);

                        // If the movement direction of two cursors
                        // are the same, it is a pan.
                        var direction = cursor0.dx * cursor1.dx + cursor0.dy * cursor1.dy;

                        if (direction <= 0) { // pinch
                            var x0 = cursor0.x - cursor0.dx;
                            var y0 = cursor0.y - cursor0.dy;
                            var x1 = cursor1.x - cursor1.dx;
                            var y1 = cursor1.y - cursor1.dy;

                            var dx = x0 - x1;
                            var dy = y0 - y1;
                            var prevDist = Math.sqrt(dx * dx + dy * dy);

                            dx = cursor0.x - cursor1.x;
                            dy = cursor0.y - cursor1.y;
                            var nowDist = Math.sqrt(dx * dx + dy * dy);

                            var diffDist = nowDist - prevDist;
                            // number is determined by user experience.
                            // TODO: in future, we may use PPI to determine a
                            // more physically correct zooming speed.
                            var offset = Math.sign(diffDist);
                            var fov = that._sceneCameras[that._current].getTargetFov() + (offset > 0? -1.0 : 1.0);
                            that._sceneCameras[that._current].setTargetFov(fov);
                        }
                    } else {
                        that.cameraManipulator.onTouchMove(that.touch);
                    }
                } 
                
            };
            this.touch.touchStopCallback = function() {
                if (that._stereo) {
                    return;
                }
            };
        }

        // mouse events
        this.mouse = new Mouse(this.canvas);

        this.mouse.mouseDownCallback = function() {
            if (!that._stereo) {
                that.cameraManipulator.onMouseDown(that.mouse);
            }
        };
        this.mouse.mouseMoveCallback = function() {
            var range = window.getSelection();
            if(range.type !== "Caret") {
                range.removeAllRanges();
            }

            if (!that._stereo) {
                that.cameraManipulator.onMouseMove(that.mouse);
            }
        };
        this.mouse.mouseUpCallback = function() {
            if (!that._stereo) {
                that.cameraManipulator.onMouseUp(that.mouse);
            }
            if (that._aligment && !this.moved) {
                that._aligment = false;
                var worldPos = that.getWorldPosition(this.x, this.y);
                var cameraInfo = {
                                    phi   : -that._sceneCameras[that._current]._phi,
                                    theta : -that._sceneCameras[that._current]._theta,
                                    fov   : that._sceneCameras[that._current]._fov
                                 };
                that._eventEmitter.emit("getPanoramaWorldPosition", worldPos, cameraInfo);
            }
        };
        this.mouse.mouseWheelCallback = function() {
            var fov = that._sceneCameras[that._current].getTargetFov() + (that.mouse.delta > 0? 1.0 : -1.0);
            that._sceneCameras[that._current].setTargetFov(fov);
        };
        this.mouse.mouseDoubleClickCallback = function() {
            if (window.getSelection) {
                window.getSelection().removeAllRanges();
            } else if (document.selection) {
                document.selection.empty();
            }
        };

        // keyboard events
        this.keyboard = new Keyboard();
        this.keyboard.onKeyDownCallback = function(key) {
            if (!that._stereo) {
                that.cameraManipulator.onKeyDown(key);
            }
        };

        // Tab visibility events
        // http://stackoverflow.com/questions/1060008/is-there-a-way-to-detect-if-a-browser-window-is-not-currently-active/1060034#1060034
        this._changeVisibility = function(evt) {
            //that._stateManager.onVisibilityChange(evt || window.event);
        };
        if ("hidden" in document) {
            document.addEventListener("visibilitychange", this._changeVisibility);
        } else if ("webkitHidden" in document) {
            document.addEventListener("webkitvisibilitychange", this._changeVisibility);
        } else if ("msHidden" in document) {
            document.addEventListener("msvisibilitychange", this._changeVisibility);
        }
    };

    /**
     * @description The destructor of panorama image rendering canvas object.
     * Need a clean exit when the scene is about to reload. Otherwise
     * it will cause significant memory leak.
     * @destructor
     */
    Canvas360.prototype.destroy = function() {
        this.cameraManipulator.destroy();

        this._renderTarget.destroy();
        this._resourceManager.destroy();

        delete this._renderScene;
        delete this._resourceManager;

        if (Globals.isMobile) {
            this.orientation.detach();
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

        this._eventEmitter = null;

        // Release GL context
        gl = null;
        this.canvas = null;

        // Remove hidden event callback
        if ("hidden" in document) {
            document.removeEventListener("visibilitychange", this._changeVisibility);
        } else if ("mozHidden" in document) {
            document.removeEventListener("mozvisibilitychange", this._changeVisibility);
        } else if ("webkitHidden" in document) {
            document.removeEventListener("webkitvisibilitychange", this._changeVisibility);
        } else if ("msHidden" in document) {
            document.removeEventListener("msvisibilitychange", this._changeVisibility);
        }
    };

    /**
     * @description initialize the indicators from the model page's comment info
     */
    Canvas360.prototype.setIndicators = function(indicators) {
        this._indicators = {};
        for (var i = 0; i < indicators.length; i++) {
            var id = indicators[i].id;
            this._indicators[id] = new _Indicator(id);
            vec3.copy(this._indicators[id].ray.start, indicators[i].position);
            vec3.normalize(this._indicators[id].ray.direction, this._indicators[id].ray.start);
        }
    };
    
    /**
     * @description private function to detect if the indicator visible
     */
    Canvas360.prototype._detectIndicator = function(camera) {
        var res = this._detect(camera);
        //Send both the indicator's info and the camera's view direction for the frontend to 
        //add angles on the minimap
        this._eventEmitter.emit("updatePanoramaIndicator", res, this._viewDirection);
    };
    
    Canvas360.prototype._detectVRIndicator = function(leftCamera, rightCamera) {
        var leftIndicator = this._detect(leftCamera, 0.99);
        var rightIndicator = this._detect(rightCamera, 0.99);
        this._eventEmitter.emit("updatePanoramaVRIndicator", leftIndicator, rightIndicator);
    };
    
    Canvas360.prototype._detect = function(camera, threshold) {
        vec3.set(this._viewDirection, 
                -camera.viewMatrix[2], 
                -camera.viewMatrix[6], 
                -camera.viewMatrix[10]);
                
        threshold = threshold || 0.607;
        
        var res = [];

        for (var id in this._indicators) {
            var indicator = this._indicators[id];
            var angle = vec3.dot(indicator.ray.direction, this._viewDirection);
            
            var screenPosition = camera.project(indicator.ray.start);
            res.push({ 
                    id: indicator.id,
                    screenPosition: [screenPosition[0], screenPosition[1]],
                    angle: angle,
                    //change the threshold from 30 degree to 45
                    visible: (angle > threshold && screenPosition[2]) ? true : false,
                    focus: false
                });
        }
        
        var minIdx = -1;
        var maxAngle = 0;
        for (var i = 0, len = res.length; i < len; i++) {
            var indicator = res[i];
            indicator.visible = indicator.visible &&
                                indicator.screenPosition[0] > (camera.viewport[0] / Globals.devicePixelRatio) &&
                                indicator.screenPosition[0] < (camera.viewport[0] + camera.viewport[2]) / Globals.devicePixelRatio &&
                                indicator.screenPosition[1] > (camera.viewport[1] / Globals.devicePixelRatio) &&
                                indicator.screenPosition[1] < (camera.viewport[1] + camera.viewport[3]) / Globals.devicePixelRatio;
            if (indicator.visible && maxAngle < indicator.angle) {
                maxAngle = indicator.angle;
                minIdx = i;
            }
        } 

        if (minIdx > -1) {
            res[minIdx].focus = true;
        }
        return res;
    };
    
    /**
     * @description The load panorama data.
     * @param {object} modelInformation - the model information object
     * @param {object} promises - the file loading promises
     * @param {object} startView - the data for setting up the camera
     */
    Canvas360.prototype.load = function(modelInformation, promises, type, startView) {

        if (this._loader) {
            this._loader.cancelled = true;
        }

        var id = modelInformation.modelId;
        this._resetScene(startView);
        
        this._loader = new LoadPano(id, this._leftSkyboxes[this._current], Globals.isMobile ? this._rightSkyboxes[this._current] : null, this._resourceManager);
        var that = this;
        return that._loader.load(type, promises,
                function(sceneData) {
                    that._loader = null;
                    if (Globals.isMobile) {
                        that.orientation = new Orientation();
                        that.orientation.modulate = !that._stereo;;
                        that.orientation.attach(that._sceneCameras[that._current]);
                    }
                    
                    that._visible = true;       //enable rendering when load finished

                    // The sceneData's separation is cm.
                    that._setVRSeparation(sceneData ? ((sceneData.separation || 6.5) * 10.0) : 65);
                    that._loaded = true;
                }
            );
    };

    /**
     * @description reset the scene and camera for morphing
     */
    Canvas360.prototype._resetScene = function(startView) {
        this._visible = false;
        if (Globals.isMobile && startView) {
            startView.phi = 0;
        }
        if (this._leftSkyboxes[0].enabled && this._morphing) {
            this._morphingAnimators[this._current].bind(this._sceneCameras[this._current]);
            this._morphingAnimators[this._current].start(null, null, null, 10.0);
            this._morphingAnimators[1 - this._current].bind(this._sceneCameras[1 - this._current]);
            
            if (startView) {
                this._sceneCameras[1 - this._current]._targetFov = this._sceneCameras[1 - this._current]._fov = startView.fov;
                this._sceneCameras[1 - this._current]._targetPhi = this._sceneCameras[1 - this._current]._phi = startView.phi;
                this._sceneCameras[1 - this._current]._targetTheta = this._sceneCameras[1 - this._current]._theta = startView.theta;
                this._morphingAnimators[1 - this._current].start(null, null, 140, startView.fov);
            } else {
                this._morphingAnimators[1 - this._current].start(this._sceneCameras[this._current]._phi, this._sceneCameras[this._current]._theta, 140, 78.0);
            }

            this._current = 1- this._current;
            this.cameraManipulator.setCamera(this._sceneCameras[this._current]);
        } else if (startView) {
            this._sceneCameras[this._current]._targetFov = startView.fov;
            this._sceneCameras[this._current]._fov = startView.fov + 1e-3;;
            this._sceneCameras[this._current]._targetPhi = startView.phi;
            this._sceneCameras[this._current]._phi = startView.phi + 1e-3;
            this._sceneCameras[this._current]._targetTheta = this._sceneCameras[this._current]._theta = startView.theta;
        }
    };
    
    /**
     * @description render scene based on different platform and cases
     */
    Canvas360.prototype._renderScene = function() {
        this._renderer.clear(this._renderTarget, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        if (this._stereo) {
            var w = Globals.width;
            var h = Globals.height;
            this._leftCamera.update(this._sceneCameras[this._current], -this._convergence, -this._separation * 0.5);
            this._leftCamera.setViewport(new Int32Array([0, 0, w / 2, h]));
            this._renderer.drawSkybox(this._renderTarget, this._leftSkyboxes[this._current], this._leftCamera);

            this._rightCamera.update(this._sceneCameras[this._current],  this._convergence,  this._separation * 0.5);
            this._rightCamera.setViewport(new Int32Array([w / 2, 0, w / 2, h]));
            this._renderer.drawSkybox(this._renderTarget, this._rightSkyboxes[this._current], this._rightCamera);
            this._detectVRIndicator(this._leftCamera, this._rightCamera);
        } else if (this._webvr.isPresenting()) {
            this._webvr.drawSkybox(this._sceneCameras[this._current], this._leftSkyboxes[this._current], this._rightSkyboxes[this._current], this._renderer, this._renderTarget);
        } else {
            
            if (this._sceneCameras[this._current].animator instanceof CameraAnimatorMorphing){
                this._renderer.drawSkybox(this._renderTarget, this._leftSkyboxes[1 - this._current], this._sceneCameras[1 - this._current]);
                this._renderer.endFrame();
                this._renderer.beginFrame();
                this._leftSkyboxes[this._current].setTransparency(1 - this._sceneCameras[this._current].animator.getProgress());
            } else {
                this._detectIndicator(this._sceneCameras[this._current]);
            }
            this._renderer.drawSkybox(this._renderTarget, this._leftSkyboxes[this._current], this._sceneCameras[this._current]);
        }
    };

    /**
     * @description update callback at every frame. 
     */
    Canvas360.prototype.update = function() {
        // When the screen (tab) is hidden, we don't need to run update function.
        if (!this._visible) {
            return ;
        }

        // Update the camera since last frame by inputs, e.g., touch, mouse.
        if (!this._webvr.isPresenting()) {
            //desktop
            if (!Globals.isMobile) {
                this._sceneCameras[0].update();
                this._sceneCameras[1].update();
            // mobile
            } else if (!this._stereo) {
                this._sceneCameras[this._current].update();
                this.orientation.update();            // VR
            } else {
                this.orientation.update();
            }
        }
        
        this._renderer.beginFrame();
        this._renderScene();
        this._renderer.endFrame();
    };

    Canvas360.prototype.setFov = function(fov) {
        this._sceneCameras[this._current].setTargetFov(fov);
    };
    
    Canvas360.prototype.requestAnimationFrame = function(updateCallback) {
        var animationId = 0;
        if (this._webvr.isPresenting()) {
            animationId = this._webvr._vrDisplay.requestAnimationFrame(updateCallback, this.canvas);
        } else {
            animationId = window.requestAnimationFrame(updateCallback, this.canvas);
        }
        return animationId;
    };

    /**
     * @description resize callback
     * @param {integer} width - the size of canvas
     * @param {integer} height - ditto
     */
    Canvas360.prototype.resize = function (width, height) {

        Globals.devicePixelRatio = window.devicePixelRatio || 1;
        var actualWidth = Math.floor(width * Globals.devicePixelRatio);
        var actualHeight = Math.floor(height * Globals.devicePixelRatio);
        Globals.width = actualWidth;
        Globals.height = actualHeight;

        this._sceneCameras[0].resize(actualWidth, actualHeight);
        this._sceneCameras[0].update();
        this._sceneCameras[1].resize(actualWidth, actualHeight);
        this._sceneCameras[1].update();
        
        if (Globals.isMobile) {
            this.orientation.reset(this._sceneCameras[this._current]);
        }
        
        this._renderer.invalidate();

        this.canvas.style.width = width + "px";
        this.canvas.style.height = height + "px";
        this.canvas.width = actualWidth;
        this.canvas.height = actualHeight;
    }; 

    /**
     * @description switch between 1st person view and 3rd person view.
     * @param {boolean} enabled - true for 1st person view and false for 3rd person view.
     * @param {boolean} isRestricted - set to true to disable all camera interactions except for the rotation.
     */
    Canvas360.prototype.setFirstPersonViewEnabled = function(enabled, isRestricted) {
        this._sceneCameras[this._current].setFirstPerson(enabled, isRestricted);
        this.cameraManipulator.resetFirstPersonView(enabled);
    };
    
    /**
     * @description set the flag of orientation
     * @return {undefined}
     */
    Canvas360.prototype.setOrientationEnable = function(enabled) {
        this.orientation.setEnabled(enabled);
    };
    
    Canvas360.prototype.setFlipPanorama = function(enabled) {
        this._leftSkyboxes[0].setFlipYEnabled(enabled);
        this._leftSkyboxes[1].setFlipYEnabled(enabled);
        this._rightSkyboxes[0].setFlipYEnabled(enabled);
        this._rightSkyboxes[1].setFlipYEnabled(enabled);
    };
    
    /**
     * @description enable VR
     * @param {boolean} enabled - enable VR
     */
    Canvas360.prototype.setVREnabled = function (enabled) {
        if (this._stereo === enabled) {
            return;
        }

        // VR implicitly needs first person view being enabled.
        this._stereo = enabled;
        if(Globals.isMobile) {
            this.orientation.modulate = !this._stereo;
        }
    };

    /**
     * @description change the convergence of two eyes in VR mode.
     * @param {float} value - larger convergence, the depth cue is more stronger.
     */
    Canvas360.prototype.setVRConvergence = function(value) {
        this._convergence = value;
    };

    /**
     * @description change the distance of two eyes in VR mode.
     * @param {float} value - it is in centimeters.
     */
    Canvas360.prototype._setVRSeparation = function(value) {
        this._separation = value;
    };
    
    /**
     * @description enable of disable morphing.
     * @param {bool} enabled - set the morphing flag
     */
    Canvas360.prototype.setMorphingEnabled = function(enabled) {
        this._morphing = enabled;
    };

    /**
     * @description dump the image and camera data.
     */
    Canvas360.prototype.dump = function() {
        var res = {
            image : this.canvas.toDataURL("image/jpg"),
            phi   : this._sceneCameras[this._current]._phi,
            theta : this._sceneCameras[this._current]._theta,
            fov   : this._sceneCameras[this._current]._fov,
            distance : this._sceneCameras[this._current]._targetDistance,
            at    : [this._sceneCameras[this._current]._at[0], this._sceneCameras[this._current]._at[1], this._sceneCameras[this._current]._at[2]]
        };
        return res;
    };

    Canvas360.prototype.setAlignmentMode = function(enabled) {
        this._aligment = enabled;
    };
    
    Canvas360.prototype.getWorldPosition = function(x, y) {
        x = Math.floor(x * Globals.devicePixelRatio);
        y = Math.floor(y * Globals.devicePixelRatio);
        
        var depth = 1.0;
        var inversedVPMatrix = mat4.create();
        mat4.invert(inversedVPMatrix, this._sceneCameras[this._current].vpMatrix);
        
        var worldPosition = vec3.fromValues(
                                            2.0 * (x / Globals.width - 0.5),
                                            2.0 * ((Globals.height - 1 - y) / Globals.height - 0.5),
                                            2 * depth - 1.0);

        vec3.transformMat4(worldPosition, worldPosition, inversedVPMatrix);
        return worldPosition;
    };
 
    return Canvas360;
})();

