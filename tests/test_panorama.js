//
// test_frustum_culling.js
// Test the effectivness of our frustum culling
//
//  

import Globals       from "../m3d_globals.js";
import DrawableLibrary   from "../03scene/drawables/m3d_drawable_library.js";
import CameraUtility from "../03scene/camera/m3d_camera_utility.js";
import BaseCamera    from "../03scene/camera/m3d_base_camera.js";
import RenderTarget  from "../04renderer/m3d_rendertarget.js";
import LoadManual    from "../07loadsave/m3d_load_manual.js";

export default (function() {
    "use strict";
    
    function TestPanorama(canvas) {
        // private:
        this._canvas = canvas;
        
        
        // Create the text panel
        var mainBody = document.getElementsByTagName("body")[0];
        this._text = document.createElement("div");
        this._text.style.color = 'blue';
        this._text.style.fontSize = Globals.isMobile? '10pt' : '9pt';
        this._text.style.position = 'absolute';
        this._text.style.top = '430px';
        this._text.style.left = '10px';
        this._text.innerHTML = "";
        mainBody.appendChild(this._text);

        this._createScene();

        // Global configuration
        canvas.setAOEnabled(false);
        canvas.setShadowEnabled(false);
    };

    TestPanorama.prototype.renderScene = function() {
        this._canvas._panorama.render(this._canvas._renderer);
        return 0;
    };

    TestPanorama.prototype._createScene = function() {
        var that = this;

        this._canvas.setPanoramaEnabled(true);
        var modelInformation = {};
        modelInformation.modelId = "551d4326e437414c17000005";
        this._canvas.updatePanorama(modelInformation, {}, {})
            .then(function() {
                that._canvas._eventEmitter.emit("loadingPhase2Done", modelInformation);

            });
    };

    TestPanorama.prototype.update = function() {
        this._canvas._renderer.renderState.invalidateStates();
    };

    TestPanorama.prototype.bindKeyboard = function(keyboard) {
        var that = this;
        var keyboardCallback = keyboard.onKeyDownCallback;
        keyboard.onKeyDownCallback = function(key) {
            if (!that._keyboard(key)) {
                keyboardCallback(key);
            }
        };
    };

    TestPanorama.prototype._keyboard = function(key) {
        var perspective = true;
        switch (key) {
        }
                
        this._canvas._refreshRendering();
    };

    TestPanorama.prototype._print = function(culled) {
        this._text.innerHTML = 
            "<p>Browse the scene to see how many cubes gets <br> culled by scene camera's frustum.<br>" +
            "Press 'f' to toggle orthogonal and perspective camera.<br>" +
            "Press 'g' to toggle interaction.<br><br>" +
            "Projection: " + (this._canvas._sceneCamera.isPerspective()? "perspective" : "ortho") + "<br>" +
            (this._interactive? "Culled: " + culled + " out of " + this._cubes.length : "cube: " + culled) + " </p>";
    };

    return TestPanorama;
})();


