//
// m3d_vr.js
// The WebVR
//
//  
//

// README
// 1. Install latest Oculus or Vive (SteamVR) runtime. Make sure that the
// Oculus/Vive demo scene works. Run the calibration/room setup/HMD setup so
// the correct room scale and/or viewer height is measured.
// 
// 2. Download latest Firefox Nightly (recommended), or Chromium WebVR experimental build from the following
// link: https://webvr.info/get-chrome/
// 
// 3. Try this demo, and see if it works in the HMD.
// https://toji.github.io/webvr-samples/04-simple-mirroring.html If it works,
// then it means that the setup is correct.
// 
// 4. Checkout Modelo WebVR branch, add a VR model (e.g. Van Gogh room) to
// 551d4326e437414c17000005 directory, and run gulp server. 
// 
// 5. In the browser, load page http://localhost:4000/local-model. Move to a
// viewpoint that is in the center of the area that you want to see in VR. The
// height of the viewpoint should be approximately 1.65 meter from the floor,
// so that in VR you'll perceive the correct height of yourself.
// 
// 6. Press "V" key and you'll enter VR mode. You can try to move around and
// see if yourself is tracked correctly. 
// 
//    6a. If you are using Vive, please open SteamVR before launching Chromium,
//    and make sure everything (tracking stations and HMD) are recognized as
//    working (green icon). You should leave SteamVR open while you are viewing
//    VR contents. 
// 
//    6b. If you are using Oculus, the Oculus app will automatically open when
//    you launch Chromium. Leave it open in the background when you are viewing
//    VR contents.
//    
//    6c. Navigating(Temp): For HTC Vive, use both controllers to navigate. 
//    Pull the trigger to move forward/backward; Press the side button to pan right/left
// 
// 7. Press "V" key again and the page will exit from VR mode. 
// 
// 8. For HMD device (Oculus, HTC Vive, etc.) Barrel distortion is not needed (https://github.com/ValveSoftware/openvr/issues/305). For mobile 
// VR device, please use m3d_vr.js instead

import Globals                  from "../m3d_globals.js";
import OffsetCameraWebVR        from "../03scene/camera/m3d_offset_camera_webvr.js"
import CameraAnimatorInstant    from "../03scene/camera/m3d_camera_animator_normal.js";

export default (function() {
    "use strict";

    if (Globals.webvr) {
        var frameData = new VRFrameData();
        var moveMagnitude = 0.01;
    }
    
    function WebVR(resourceManager, scene, eventEmitter) {
        if (!Globals.webvr) {
            return;
        }
        // public:
        
        this.enabled              = false;
        // private:
        this._ready               = false;
        this._resourceManager     = resourceManager;
        this._eventEmitter        = eventEmitter;
        this._cameras             = [];
        this._vrDisplay           = null;
        this._canvas              = null;
        this._canvasResizeCB      = null;
        this._screenWidth         = null;
        this._screenHeight        = null;        
        this._resizeBind          = this.resize.bind(this);
        
        // viewer's eye to floor distance in meters
        // default view center (the one given in sceneCamera.viewMatrix)
        // should be placed at this height
        this._defaultViewerHeight = 1.65; 
        this._poseMat             = mat4.create();
        this._prevFrameDataTimeStamp   = -0.1;

        // initialization

        // setup VR display
        if (navigator.getVRDisplays) {
            var that = this;
            navigator.getVRDisplays().then(function (displays) {
                var i, display, len = displays.length;
                for (i = 0; i < len; i++) {
                    display = displays[i];
                    if(display.isConnected && display.capabilities.canPresent) {
                        console.log("VR display: " + display.displayName + " is selected.");
                        that._vrDisplay = display;

                        break;
                    }
                }
            });
        } else {
            console.log("Your browser does not support WebVR latest version. VR is disabled.");
            return;
        }        

        this._cameras[0] = new OffsetCameraWebVR(scene);
        this._cameras[1] = new OffsetCameraWebVR(scene);
        this._animator   = new CameraAnimatorInstant();
        this._ready = true;
    };
    
    WebVR.prototype.destroy = function() {
    };

    WebVR.prototype.switchPresent = function(canvas, canvasResizeCB, camera) {
        if (!this._vrDisplay || !this._ready) {
            this.enabled = false;
            return;
        }

        var self = this;
        
        if (!this._vrDisplay.isPresenting) {
            // was not presenting, switch to presenting
            
            this.enabled = true;
            this._canvas = canvas;
            this._canvasResizeCB = canvasResizeCB;
            this._activateVR();
            var that = this;
            this._vrDisplay.requestPresent([{ source: canvas }]).then(function () {
                modelo3d.debug("VR request present succeeded");
                that._animator.bind(camera);
                self._eventEmitter.emit("webvrOn");
                window.addEventListener('resize', self._resizeBind);
            }, function () {
                console.error("VR request present failed");
            });
        }
        else {
            // was presenting, switch to not presenting
            
            this.enabled = false;
            this._deactivateVR();
            this._canvas = null;
            this._canvasResizeCB = null;

            this._vrDisplay.exitPresent().then(function () {
                modelo3d.debug("VR exit present succeeded");
                that._animator.unbind(camera);
                window.removeEventListener('resize', self._resizeBind);
                self._eventEmitter.emit("webvrOff");
            }, function () {
                console.error("VR exit present failed");
            });
        }
    };
    
    WebVR.prototype.isPresenting = function () {
        return this._ready && this.enabled && this._vrDisplay && this._vrDisplay.isPresenting;
    };

    var viewport = [0, 0, 0, 0];
    
    WebVR.prototype._activateVR = function () {
        
        modelo3d.debug("WebVR Debug: enter activateVR");

        if (!this._vrDisplay)
            return;
        
        if (this._ready) {
            var leftEye = this._vrDisplay.getEyeParameters("left");
            var rightEye = this._vrDisplay.getEyeParameters("right");
            var width = Math.max(leftEye.renderWidth, rightEye.renderWidth) * 2;
            var height = Math.max(leftEye.renderHeight, rightEye.renderHeight);
            
            // save and update canvas width
            this._screenWidth = this._canvas.width;
            this._screenHeight = this._canvas.height;
            
            if (this._canvas) {
                this._canvas.width = width;
                this._canvas.height = height;
            }
            // this._canvasResizeCB(this._renderTargetWidth, this._renderTargetHeight);
            
            this._cameras[0].resize(width / 2, height);
            this._cameras[1].resize(width / 2, height);
            viewport[0] = 0;
            viewport[1] = 0;
            viewport[2] = width / 2;
            viewport[3] = height;
            this._cameras[0].setViewport(viewport);
            viewport[0] = width / 2;            
            this._cameras[1].setViewport(viewport);
        }        
    };
    
    WebVR.prototype._deactivateVR = function () {
        if (this._canvasResizeCB) {
            this._canvasResizeCB(this._screenWidth, this._screenHeight);
        }
    };   
    
    WebVR.prototype.resize = function() {
        // input is the width and height of browser canvas size 
        this._screenWidth = window.innerWidth;
        this._screenHeight = window.innerHeight;

        // FIXME: fix resize behavior
        // if (this._vrDisplay && this._vrDisplay.isPresenting) {

        //     var leftEye = this._vrDisplay.getEyeParameters("left");
        //     var rightEye = this._vrDisplay.getEyeParameters("right");
        //     var width = Math.max(leftEye.renderWidth, rightEye.renderWidth) * 2;
        //     var height = Math.max(leftEye.renderHeight, rightEye.renderHeight);
 
        //     // if (this._canvas) {
        //     //     this._canvas.width = width;
        //     //     this._canvas.height = height;
        //     // }

        //     // this._canvasResizeCB(this._renderTargetWidth, this._renderTargetHeight);
            
        //     viewport[0] = 0;
        //     viewport[1] = 0;
        //     viewport[2] = width / 2;
        //     viewport[2] = height;
        //     this._cameras[0].setViewport(viewport);
        //     viewport[0] = viewport[2];
        //     this._cameras[1].setViewport(viewport);
        // }
    };
    
    WebVR.prototype.getPoseMatrix = function (outMat, pose) {
        var orientation = pose.orientation;
        var position = pose.position;
        if (!orientation) { orientation = [0, 0, 0, 1]; }
        if (!position) { position = [0, 0, 0]; }
        if (this._vrDisplay.stageParameters) {
            // If the headset provides stageParameters use the
            // sittingToStandingTransform to transform the pose into a space where
            // the floor in the center of the users play space is the origin.
            //console.log("Viewer position: " + pose.position + ", timestamp:" + pose.timeStamp);
            position[1] -= this._defaultViewerHeight; // remove default viewer height
            mat4.fromRotationTranslation(outMat, orientation, position);
            mat4.multiply(outMat, this._vrDisplay.stageParameters.sittingToStandingTransform, outMat);
        } else {
            // No stage parameter. Apply no height translation.
            // Ideally the sceneCamera.viewMatrix should incorporate a default user 's
            // height.
            //vec3.add(standingPosition, position, [0, this._viewerHeight, 0]);
            mat4.fromRotationTranslation(outMat, orientation, position);
        }
    }

    WebVR.prototype.draw = function(sceneCamera, renderScene, renderer) {
        if (!this._ready || !this._vrDisplay) {
            console.error("VR is not ready.");
            return;
        }
        
        this._vrDisplay.getFrameData(frameData);

        // gamepad
        // Loop over every gamepad and if we find any that have a pose use it.        
        var gamepads = navigator.getGamepads();
        var gamepad;        
        gamepad = gamepads[0];
        if (gamepad) {
            if (gamepad.buttons[1].pressed) {
                // trigger button
                sceneCamera.forward(moveMagnitude, this._cameras[0].getViewDirection());
                sceneCamera.update();
            }

            if (gamepad.buttons[2].pressed) {
                //side button
                sceneCamera.forward(moveMagnitude, this._cameras[0].getViewRightDirection());
                sceneCamera.update();
            }
        }
        gamepad = gamepads[1];
        if (gamepad) {
            if (gamepad.buttons[1].pressed) {
                // trigger button
                sceneCamera.forward(-moveMagnitude, this._cameras[0].getViewDirection());
                sceneCamera.update();
            }

            if (gamepad.buttons[2].pressed) {
                // side button
                sceneCamera.forward(-moveMagnitude, this._cameras[0].getViewRightDirection());
                sceneCamera.update();
            }
        }

        // Render the scene.
        this._cameras[0].update(sceneCamera, this._vrDisplay.getEyeParameters("left"), frameData.leftViewMatrix);
        this._cameras[1].update(sceneCamera, this._vrDisplay.getEyeParameters("right"), frameData.rightViewMatrix);

        renderScene.draw(this._cameras[0], this._cameras[1], null);

        this._vrDisplay.submitFrame();
    };

    WebVR.prototype.drawSkybox = function(sceneCamera, leftSkybox, rightSkybox, renderer, renderTarget) {
        if (!this._ready || !this._vrDisplay) {
            console.error("VR is not ready.");
            return;
        }
        
        this._vrDisplay.getFrameData(frameData);

        // Render the scene.
        this._cameras[0].update(sceneCamera, this._vrDisplay.getEyeParameters("left"), frameData.leftViewMatrix);
        this._cameras[1].update(sceneCamera, this._vrDisplay.getEyeParameters("right"), frameData.rightViewMatrix);

        renderer.drawSkybox(renderTarget, leftSkybox, this._cameras[0]);
        renderer.drawSkybox(renderTarget, rightSkybox, this._cameras[1]);

        this._vrDisplay.submitFrame();
    };


    return WebVR;
})();
