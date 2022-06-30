//
// m3d_camera_manipulator.js
// Manipulate the camera with mouse or touch
//
//  


import Globals                  from "../../m3d_globals.js"
import SceneCamera              from "../../03scene/camera/m3d_scene_camera.js"
import CameraAnimatorTransition from "../../03scene/camera/m3d_camera_animator_transition.js";
import CameraAnimatorOrbit      from "../../03scene/camera/m3d_camera_animator_orbit.js";
import DepthQuery               from "./m3d_depth_query.js";


export default (function() {
    "use strict";

    function CameraManipulator(scene, camera, resourceManager, orientation, eventEmitter) {
        // private:
        this._scene  = scene;
        this._camera = camera;
        this._depthQuery = new DepthQuery(scene, resourceManager);
        this._animator = new CameraAnimatorTransition(eventEmitter);
        // FIXME: tweak the following numbers to get a good UX.
        // Speed to control the touch laptop & mobile devices
        this._touchPanSpeedScaling    = 1.86 * Globals.devicePixelRatio;
        this._touchZoomSpeedScaling   = 0.0596 * Math.sqrt(Globals.devicePixelRatio);
        this._touchRotateSpeedScaling = 0.44 * Globals.devicePixelRatio;

        // Speed to control the desktop
        // PS:trackpad belongs to desktop here
        this._mousePanSpeedScaling    = 0.37;
        this._mouseZoomSpeedScaling   = 0.278;
        this._mouseRotateSpeedScaling = 0.45;
        this._keyRotateSpeed          = 12;

        // Speed to control keyboard
        this._keyPanSpeed             = 1.0;
        this._keyForwardSpeed         = 0.0092;

        this._orientation             = orientation;

        this._pressed                 = false;      // if left button is pressed down.
        this._hasSavedFPV             = false;      // is saved first person view
        this._isFPV                   = false;      // camera status
        this._adjusting               = false;      // is adjusting point direction, for in app nav
        this._isPanorama              = false;      // is panorama mode
        
        // public:
        this.eventEmitter = eventEmitter;
        this.isOrthoView = false;
    };

    CameraManipulator.prototype.destroy = function() {
        this._camera = null;
        this._depthQuery.destroy();
        this._depthQuery = null;
    };

    CameraManipulator.prototype.onMouseDown = function(mouse) {
        this._restoreFPV();
        if (mouse.event.buttonDown === 1) {
            this._exitTransit();
            this._pressed = true;
        }
    };

    CameraManipulator.prototype.onMouseMove = function(mouse) {
        if (mouse.event.buttonDown === 0) {
            this._exitOrbit();
        }
        if (mouse.event.buttonDown === 1) {
            if (this._adjusting) {
                this._camera.rotate(-mouse.dx * this._mouseRotateSpeedScaling, 0);
            } else if(this._isPanorama) {
                this._camera.rotate(-mouse.dx * this._mouseRotateSpeedScaling, -mouse.dy * this._mouseRotateSpeedScaling);
            } else {
                this._camera.rotate(mouse.dx * this._mouseRotateSpeedScaling, mouse.dy * this._mouseRotateSpeedScaling);
            }
        } else if (mouse.event.buttonDown === 2) {
            this._saveFPV(false);
            this._exitTransit();
            this._camera.zoom(mouse.dx * 0.01 * Globals.devicePixelRatio);
        } else if (mouse.event.buttonDown === 3) {
            this._saveFPV(false);
            this._exitTransit();
            this._camera.pan(mouse.dx * this._mousePanSpeedScaling, mouse.dy * this._mousePanSpeedScaling);
        }

        if (mouse.event.buttonDown !== 0 && this.isOrthoView){
            this.eventEmitter.emit("exitOrthoView");
            this.isOrthoView = false;
        }

        if (this._pressed && this._adjusting) {
            this.eventEmitter.emit("getMapPosition");
        }
    };
    CameraManipulator.prototype.onMouseUp = function(mouse) {
        this._restoreFPV();
        if (mouse.event.buttonDown === 1) {
            this._pressed = false;
        }
    };
    CameraManipulator.prototype.onMouseDoubleClick = function(mouse, renderer) {
        // Only available in 3rd person view
        this._exitTransit();
        if (!this._camera.isFirstPerson()) {
            var worldPosition = this._depthQuery.unproject(mouse.x, mouse.y, renderer, this._camera);

            if (worldPosition !== null) {
                this._camera.lookTo(worldPosition);

                if (this.isOrthoView) {
                    this.eventEmitter.emit("exitOrthoView");
                    this.isOrthoView = false;
                }
            }
        }
    };
    CameraManipulator.prototype.onMouseWheel = function(mouse) {
        this._restoreFPV();
        this._saveFPV(false);
        this._exitTransit();
        var delta = mouse.delta * this._mouseZoomSpeedScaling;
        this._camera.zoom(delta);
    };

    CameraManipulator.prototype.onTouchMove = function(touch) {
        var cursor0 = touch.cursor(0);
        this._exitTransit();
        var dx, dy;
        if (touch.numCursors === 1) { // One finger to rotate
            this._restoreFPV();
            cursor0 = touch.cursor(0);
            if(this._isPanorama) {
                this._camera.rotate(-cursor0.dx * this._touchRotateSpeedScaling,
                                    -cursor0.dy * this._touchRotateSpeedScaling);
            } else {
                this._camera.rotate(cursor0.dx * this._touchRotateSpeedScaling,
                                    cursor0.dy * this._touchRotateSpeedScaling);
            }
        } else if (touch.numCursors === 2) { // Two fingers to pinch or move
            this._restoreFPV();
            this._saveFPV(false);
            cursor0 = touch.cursor(0);
            var cursor1 = touch.cursor(1);

            // If the movement direction of two cursors
            // are the same, it is a pan.
            var direction = cursor0.dx * cursor1.dx + cursor0.dy * cursor1.dy;

            if (direction > 0) { // pan
                dx = (cursor0.dx + cursor1.dx) * this._touchPanSpeedScaling;
                dy = (cursor0.dy + cursor1.dy) * this._touchPanSpeedScaling;

                this._camera.pan(dx, dy);
            } else { // pinch
                var x0 = cursor0.x - cursor0.dx;
                var y0 = cursor0.y - cursor0.dy;
                var x1 = cursor1.x - cursor1.dx;
                var y1 = cursor1.y - cursor1.dy;

                dx = x0 - x1;
                dy = y0 - y1;
                var prevDist = Math.sqrt(dx * dx + dy * dy);

                dx = cursor0.x - cursor1.x;
                dy = cursor0.y - cursor1.y;
                var nowDist = Math.sqrt(dx * dx + dy * dy);

                var diffDist = nowDist - prevDist;
                // number is determined by user experience.
                // TODO: in future, we may use PPI to determine a
                // more physically correct zooming speed.
                var offset = Math.sign(diffDist) * this._touchZoomSpeedScaling;
                this._camera.zoom(offset);
            }
        } else { // move the object.
            this._restoreFPV();
            this._saveFPV(false);
            dx = 0;
            dy = 0;
            for (var i = 0; i < touch.numCursors; ++i) {
                var t = touch.cursor(i);

                dx += t.dx;
                dy += t.dy;
            }

            dx /= touch.numCursors;
            dy /= touch.numCursors;

            dx *= this._touchPanSpeedScaling;
            dy *= this._touchPanSpeedScaling;

            this._camera.pan(dx, dy);
        }

        if (touch.numCursors !== 0  && this.isOrthoView) {
            if (this.eventEmitter) {
                this.eventEmitter.emit("exitOrthoView");
            }
            
            this.isOrthoView = false;
        }
        if (this.eventEmitter) {
            this.eventEmitter.emit("getMapPosition");
        }
    };

    CameraManipulator.prototype.onTouchDoubleClick = function(touch, renderer, camera) {
        if (!this._camera.isFirstPerson()) {
            this._exitTransit();
            var cursor0 = touch.cursor(0);

            // Close-up view
            var worldPosition = this._depthQuery.unproject(cursor0.x, cursor0.y, renderer, camera);

            if (worldPosition !== null) {
                this._camera.lookTo(worldPosition);

                if (this.isOrthoView) {
                    if (this.eventEmitter) {
                        this.eventEmitter.emit("exitOrthoView");
                    }
                    this.isOrthoView = false;
                }
            }
        }
    };

    CameraManipulator.prototype.onKeyDown = function(key) {
        // uses both arrow keys and wasd
        switch (key) {
            // right, D, d
            case 39:
            case 68:
            case 100:
                {
                    this._exitTransit();
                    this._restoreFPV();
                    this._saveFPV(true);
                    this._camera.rotate(this._keyRotateSpeed, 0);
                    if (this._adjusting) {
                        this.eventEmitter.emit("getMapPosition");
                    }
                }
                break;
            // up, W, w
            case 38:
            case 87:
            case 119:
                {
                    this._exitTransit();
                    this._restoreFPV();
                    this._saveFPV(false);
                    this._camera.forward(this._keyForwardSpeed);
                }
                break;
            // left, A, a
            case 37:
            case 65:
            case 97:
                {
                    this._exitTransit();
                    this._restoreFPV();
                    this._saveFPV(true);
                    this._camera.rotate(-this._keyRotateSpeed, 0);
                    if (this._adjusting) {
                        this.eventEmitter.emit("getMapPosition");
                    }
                }
                break;
            // down, S, s
            case 40:
            case 83:
            case 115:
                {
                    this._exitTransit();
                    this._restoreFPV();
                    this._saveFPV(false);
                    this._camera.forward(-this._keyForwardSpeed);
                }
                break;
        }

    };

    // save camera status in camera manipulator
    // then set camera view mode for camera motion
    CameraManipulator.prototype._saveFPV = function(enabled) {
        if(!this._hasSavedFPV) {
           this._isFPV = this._camera.isFirstPerson();
           this._hasSavedFPV = true;
           this._camera.setFirstPerson(enabled);
        }
    };

    CameraManipulator.prototype._exitTransit = function() {
        if (this._camera._restricted) {
            return;
        }
        this._exitOrbit();
        if (this._camera.animator instanceof CameraAnimatorTransition) {
            this._camera.animator.stop();
        }
    };

    CameraManipulator.prototype._exitOrbit = function() {
        if (this._camera.animator instanceof CameraAnimatorOrbit) {
            this._camera.animator.stop();
        }
    }

    CameraManipulator.prototype._restoreFPV = function() {
        if (this._hasSavedFPV) {
           this._hasSavedFPV = false;
           this._camera.setFirstPerson(this._isFPV);
        }
    };

    CameraManipulator.prototype.resetFirstPersonView = function(enabled) {
        this._isFPV = enabled;
        this._hasSavedFPV = false;
    };

    CameraManipulator.prototype.switchToTopView = function() {
        this._hasSavedFPV = false;
        this._camera.setFirstPerson(false);
        this._camera.reset(false);
        this._camera.rotateTo(Math.PI * 0.49999, -Math.PI * 0.49999);
        this.isOrthoView = true;
    };
    CameraManipulator.prototype.switchToBottomView = function() {
        this._hasSavedFPV = false;
        this._camera.setFirstPerson(false);
        this._camera.reset(false);
        this._camera.rotateTo(Math.PI * -0.49999, -Math.PI * 0.49999);
        this.isOrthoView = true;
    };
    CameraManipulator.prototype.switchToLeftView = function() {
        this._hasSavedFPV = false;
        this._camera.setFirstPerson(false);
        this._camera.reset(false);
        this._camera.rotateTo(0, Math.PI);
        this.isOrthoView = true;
    };
    CameraManipulator.prototype.switchToRightView = function() {
        this._hasSavedFPV = false;
        this._camera.setFirstPerson(false);
        this._camera.reset(false);
        this._camera.rotateTo(0, 0);
        this.isOrthoView = true;
    };
    CameraManipulator.prototype.switchToFrontView = function() {
        this._hasSavedFPV = false;
        this._camera.setFirstPerson(false);
        this._camera.reset(false);
        this._camera.rotateTo(0, Math.PI * -0.5);
        this.isOrthoView = true;
    };
    CameraManipulator.prototype.switchToBackView = function() {
        this._hasSavedFPV = false;
        this._camera.setFirstPerson(false);
        this._camera.reset(false);
        this._camera.rotateTo(0, Math.PI * 0.5);
        this.isOrthoView = true;
    };
    CameraManipulator.prototype.switchToWorldView = function() {
        this._hasSavedFPV = false;
        this._camera.setFirstPerson(false);
        // The world view is always in perspective projection.
        this._camera.setPerspective(true);
        this._camera.reset(false);
        this.isOrthoView = false;
    };

    CameraManipulator.prototype.exitOrthoView = function() {
        if (this.isOrthoView){
            this.eventEmitter.emit("exitOrthoView");
            this.isOrthoView = false;
        }
    };

    /**
     * @description change to a user view. 
     * @param {object} viewData - the view data.
     * @param {boolean} isVrEnabled - in VR mode?
     */
    CameraManipulator.prototype.switchToUserView = function(viewData, isVrEnabled) {
        this._restoreFPV();
        if (viewData) {
            this._scene.setActiveView(viewData.name);

            this._scene.clipping.reset();
            if(this._camera.animator instanceof CameraAnimatorTransition) {
                this._camera.animator.stop();
            }
            this._animator.bind(this._camera);
            this._animator.start(viewData, isVrEnabled);

            if (this._orientation && this._orientation.enabled) {
                this._orientation.reset(this._camera);
            }
        }
    };

    CameraManipulator.prototype.setTransitionSpeed = function(speed) {
        this._animator.setTransitionSpeed(speed);
    };

    CameraManipulator.prototype.setTouchPanSpeed = function(velocity) {
        this._touchPanSpeedScaling    = velocity * Globals.devicePixelRatio;
    };

    CameraManipulator.prototype.setTouchZoomSpeed = function(velocity) {
        this._touchZoomSpeedScaling   = velocity * Math.sqrt(Globals.devicePixelRatio);
    };

    CameraManipulator.prototype.setTouchRotateSpeed = function(velocity) {
        this._touchRotateSpeedScaling = velocity * Globals.devicePixelRatio;
    };

    CameraManipulator.prototype.setMousePanSpeed = function(velocity) {
        this._mousePanSpeedScaling    = velocity;
    };

    CameraManipulator.prototype.setMouseZoomSpeed = function(velocity) {
        this._mouseZoomSpeedScaling = velocity;
        this._camera.setZoomMinMax(velocity);
    };

    CameraManipulator.prototype.setMouseRotateSpeed = function(velocity) {
        this._mouseRotateSpeedScaling    = velocity;
    };

    CameraManipulator.prototype.setKeyPanSpeed = function(velocity) {
        this._keyPanSpeed     = velocity;
    };

    CameraManipulator.prototype.setKeyForwardSpeed = function(velocity) {
        this._keyForwardSpeed = velocity;
    };

    CameraManipulator.prototype.setInAppNaviAdjusting = function (enabled) {
        this._adjusting = enabled;
    };
    
    CameraManipulator.prototype.setPanoramaEnabled = function (enabled) {
        this._isPanorama = enabled;
    };
    
    CameraManipulator.prototype.recompileShader = function(resourceManager, states) {
        this._depthQuery.recompileShader(resourceManager, states);
    };

    CameraManipulator.prototype.transformPerspectiveToOrthogonal = function() {
        this._camera.transformPerspectiveToOrthogonal();
    };

    CameraManipulator.prototype.transformOrthogonalToPerspective = function() {
        this._camera.transformOrthogonalToPerspective();
    };
    
    CameraManipulator.prototype.setCamera = function(camera) {
        this._camera = camera;
    };

    return CameraManipulator;
})();
    
