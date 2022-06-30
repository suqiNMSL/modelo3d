//
// m3d_screenshare.js
// screen share control
//
//  

import Globals from "../../m3d_globals.js";

export default (function() {
    "use strict";

    function ScreenShare(scene, eventEmitter) {
        this._eventEmitter = eventEmitter;
        this._camera       = scene.camera;
    };

    ScreenShare.prototype.destroy = function() {
    };

    // Update the client's camera and cursor coordinate when host data arrive
    ScreenShare.prototype.updateClientData = function(data) {
        var that = this;

        // Translate the livescreen camera data to the format of camera.restore()
        data.distance = data.targetDistance;
        data.theta    = data.targetTheta;
        data.phi      = data.targetPhi;
        data.at       = data.targetAt;

        // As a client, his camera is controlled by host.
        that._camera.restore(data);

        // Update the mouse cursor position
        var positionX = data.point[0] / Globals.devicePixelRatio;
        var positionY = data.point[1] / Globals.devicePixelRatio;

        var mouseCords =  { x: positionX * Globals.width, y : positionY * Globals.height};
        that._eventEmitter.emit("updateLiveScreenMousePosition", mouseCords);
    }; 

    // Broadcast camera states to clients.
    ScreenShare.prototype.onMouseEvent = function(mouse) {
        var that = this;

        var positionX = mouse.x * Globals.devicePixelRatio;
        var positionY = mouse.y * Globals.devicePixelRatio;

        var pt = [positionX / Globals.width, positionY / Globals.height];
        var camera = this._camera;

        // FIXME: can we modify this in order to avoid translation and not break the backward
        // compatibility?

        var data = {
            point: pt,
            targetTheta: camera.targetTheta,
            targetPhi: camera.targetPhi,
            targetDistance: camera.targetDistance,
            fov: camera.fov,
            at: camera.targetAt
        };

        that._eventEmitter.emit("updateLiveScreenData", data);
    }; 

    return ScreenShare;
})();
