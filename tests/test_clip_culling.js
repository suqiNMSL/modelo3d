//
// test_clip_culling.js
// Test the effectivness of our clipping culling
//
//  


import Globals     from "../m3d_globals.js";
import DrawableLibrary from "../03scene/drawables/m3d_drawable_library.js";
import LoadManual  from "../07loadsave/m3d_load_manual.js";

export default (function() {
    "use strict";

    function TestClipCulling(canvas) {
        // private:
        this._canvas = canvas;
        this._drawables = [];

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
    };

    TestClipCulling.prototype._createScene = function() {
        var loader = new LoadManual(this._canvas._scene, 
            this._canvas._sceneCamera, this._canvas._renderScene);

        var drawableSphere;
        for (var x = -5; x <= 5; x++) {
            for (var y = -5; y <= 5; y++) {
                for (var z = -5; z <= 5; z++) {
                    var drawableSphere = DrawableLibrary.createSolidSphere(this._canvas._resourceManager, [0, 0, 1],
                        0.5, [x, y, z]);
                    this._drawables.push(drawableSphere);
                    loader.addDrawable(drawableSphere);
                }
            }
        }

        loader.load();
    };

    TestClipCulling.prototype.bindKeyboard = function(keyboard) {
        var that = this;
        var keyboardCallback = keyboard.onKeyDownCallback;
        keyboard.onKeyDownCallback = function(key) {
            if (!that._keyboard(key)) {
                keyboardCallback(key);
            }
        };
    };

    TestClipCulling.prototype._keyboard = function(key) {
        var enabled = true;
        switch (key) {
            case 70: // 'f'
                enabled = !this._canvas._scene.clipping.isEnabled();
                if (enabled) {
                    this._canvas._scene.clipping.set([-3.5, -3.5, -3.5], [3.5, 3.5, 3.5]);
                } else {
                    this._canvas._scene.clipping.reset();
                }
                this._canvas._stateManager.onSectionEnabled(enabled);
                this._canvas._refreshRendering();
                return true;
        }
        return false;
    };

    TestClipCulling.prototype._print = function(culled) {
        this._text.innerHTML = 
            "<p>'Press' f to toggle on/off the clip culling.<br>" +
            "Clip: " + (this._canvas._scene.clipping.isEnabled()? "on" : "off") + ".<br>" + 
            "Culled: " + culled + " out of " + this._drawables.length + " </p>";
    };

    TestClipCulling.prototype.update = function() {
        this._canvas._renderer.renderState.invalidateStates();

        var culled = 0;
        for (var i = 0, len = this._drawables.length; i < len; i++) {
            if (this._canvas._sceneCamera.cull(this._drawables[i])) {
                culled++;
            } 
        }

        this._print(culled);
    };

    return TestClipCulling;
})();


