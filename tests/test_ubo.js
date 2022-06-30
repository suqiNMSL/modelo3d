//
// test_ubo.js
// Test the performance of uniform block object
//
//  


import DrawableLibrary from "../03scene/drawables/m3d_drawable_library.js";
import LoadManual  from "../07loadsave/m3d_load_manual.js";
import Globals     from "../m3d_globals.js";


export default (function() {
    "use strict";
    
    var culling = true;

    function TestUBO(canvas) {
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

        this._canvas._sceneCamera.zoomTo(10.0);
    };

    var DIMENSION = 10;

    TestUBO.prototype._createScene = function() {
        var loader = new LoadManual(this._canvas._scene, 
            this._canvas._sceneCamera, this._canvas._renderScene);

        var drawableSphere;
        for (var x = -DIMENSION; x <= DIMENSION; x++) {
            for (var y = -DIMENSION; y <= DIMENSION; y++) {
                for (var z = -DIMENSION; z <= DIMENSION; z++) {
                    var r = Math.random() * 0.5 + 0.5;
                    var g = Math.random() * 0.5 + 0.5;
                    var b = Math.random() * 0.5 + 0.5;
                    var drawableSphere = DrawableLibrary.createSolidSphere(this._canvas._resourceManager, [r, g, b],
                        0.5, [x, y, z]);
                    loader.addDrawable(drawableSphere);
                }
            }
        }

        loader.load();
    };

    TestUBO.prototype.bindKeyboard = function(keyboard) {
        var that = this;
        var keyboardCallback = keyboard.onKeyDownCallback;
        keyboard.onKeyDownCallback = function(key) {
            if (!that._keyboard(key)) {
                keyboardCallback(key);
            }
        };
    };

    TestUBO.prototype._keyboard = function(key) {
        switch (key) {
            case 70: // 'f'
            case 71: // 'g'
                break;
        }
        return false;
    };

    TestUBO.prototype._print = function() {
        this._text.innerHTML = "";
    };

    TestUBO.prototype.update = function() {
        this._print();
        this._canvas._renderer.renderState.invalidateStates();
    };

    return TestUBO;
})();


