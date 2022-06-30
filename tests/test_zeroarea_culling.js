//
// test_zeroarea_culling.js
// Test the effectivness of our zeroarea culling
//
//  


import DrawableLibrary from "../03scene/drawables/m3d_drawable_library.js";
import LoadManual  from "../07loadsave/m3d_load_manual.js";
import Globals     from "../m3d_globals.js";


export default (function() {
    "use strict";
    
    var culling = true;

    function TestZeroAreaCulling(canvas) {
        // private:
        this._canvas = canvas;
        this._closeUp = false;
        
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

        // Initialize the scene
        this._createScene();
        
        // Global configuration
        canvas.setAOEnabled(false);
        canvas.setShadowEnabled(false);

        this._canvas._sceneCamera.zoomTo(4000.0);
    };

    TestZeroAreaCulling.prototype._createScene = function() {
        var loader = new LoadManual(this._canvas._scene, 
            this._canvas._sceneCamera, this._canvas._renderScene);

        var drawableSphere;
        for (var x = -5; x <= 5; x++) {
            for (var y = -5; y <= 5; y++) {
                for (var z = -5; z <= 5; z++) {
                    var drawableSphere = DrawableLibrary.createSolidSphere(this._canvas._resourceManager, [0, 0, 1],
                        0.5, [x, y, z]);
                    loader.addDrawable(drawableSphere);
                }
            }
        }

        loader.load();
    };

    TestZeroAreaCulling.prototype.bindKeyboard = function(keyboard) {
        var that = this;
        var keyboardCallback = keyboard.onKeyDownCallback;
        keyboard.onKeyDownCallback = function(key) {
            if (!that._keyboard(key)) {
                keyboardCallback(key);
            }
        };
    };

    TestZeroAreaCulling.prototype._keyboard = function(key) {
        switch (key) {
            case 70: // 'f'
                culling = !culling;
                this._canvas._sceneCamera.setCullingEnabled(culling);
                this._canvas._refreshRendering();
                return true;
            case 71: // 'g'
                this._closeUp = !this._closeUp;
                if (this._closeUp) {
                    this._canvas._sceneCamera.zoomTo(35.0);
                } else {
                    this._canvas._sceneCamera.zoomTo(4000.0);
                }
                this._canvas._refreshRendering();
                return true;
        }
        return false;
    };

    TestZeroAreaCulling.prototype._print = function() {
        this._text.innerHTML = 
            "<p>Press 'f' to toggle on/off the zeroarea culling.<br>" +
            "Press 'g' to toggle on/off the close-up mode.<br>" +
            "Zeroarea culling: " + (culling? "on" : "off") + ".</p>";
    };

    TestZeroAreaCulling.prototype.update = function() {
        this._print();
        this._canvas._renderer.renderState.invalidateStates();
    };

    return TestZeroAreaCulling;
})();


