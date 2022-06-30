//
// test_context_lost.js
// See how modelo3d recovers for context lost case
//
//  

import DrawableLibrary    from "../03scene/drawables/m3d_drawable_library.js";
import LoadManual     from "../07loadsave/m3d_load_manual.js";
import MeshAttributes from "../02resource/m3d_mesh_attribute.js";

export default (function() {
    "use strict";

    function ContextLost(canvas) {
        this._canvas = canvas;
        this._createScene();
    };

    function MakeID() {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (var i=0; i < 12; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }

        return text;
    }

    ContextLost.prototype._createScene = function() {
        // Initialize the scene
        var loader = new LoadManual(this._canvas._scene, this._canvas._sceneCamera, this._canvas._renderScene);
        for (var i = 0; i < 100; ++i) {
            var x = Math.random() * 200.0 - 100.0;
            var y = Math.random() * 200.0 - 100.0;
            var z = Math.random() * 200.0 - 100.0;
            var drawableCube = DrawableLibrary.createSolidCube(this._canvas._resourceManager, [1, 0, 0],
                0.5, [x, y, z]);
            loader.addDrawable(drawableCube);
        }

        // Use webgl extension to simulate context lost
        if (0) {
            var ext = gl.getExtension('WEBGL_lose_context');
            
            var that = this;
            var countdown = 5;
            var id = setInterval(function() {
                var msg = "lose context after " + countdown + " seconds...";
                console.log(msg);
                if (countdown === 0) {
                    clearInterval(id);
                    ext.loseContext();
                }
                countdown--;
                
            }, 1000);
        } else {
            // Crash the webgl context by allocating too many buffers
            for (var j = 0; j < 10; ++j) {
                try {
                    var vertices = new Float32Array(30 * 1024 * 1024);
                    var indices = new Uint32Array(30 * 1024 * 1024);
                    for (var i = 0; i < 30 * 1024 * 1024; i += 3) {
                        var x = Math.random() * 200.0 - 100.0;
                        var y = Math.random() * 200.0 - 100.0;
                        var z = Math.random() * 200.0 - 100.0;
                        vertices[i]     = x;
                        vertices[i + 1] = y;
                        vertices[i + 2] = z;

                        indices[i] = i;
                        indices[i + 1] = i + 1;
                        indices[i + 2] = i + 2;
                    }
                
                    var attributes = new MeshAttributes();
                    attributes.builtin(gl.FLOAT);
                    var mesh = this._canvas._resourceManager.getMesh("mesh" + j);
                    mesh.create(gl.TRIANGLES, attributes, vertices, indices, gl.UNSIGNED_INT);

                    if (gl.getError() !== gl.NO_ERROR) {
                        return false;
                    }
                } catch (e) {
                    console.log(e);
                }
            }
        }
        
        loader.load();

        this._canvas._scene.setBBox([-100, -100, -100, 100, 100, 100]);

        return true;
    };

    ContextLost.prototype.update = function() {
    };

    ContextLost.prototype.bindKeyboard = function(keyboard) {
        var that = this;
        var keyboardCallback = keyboard.onKeyDownCallback;
        keyboard.onKeyDownCallback = function(key) {
            if (!that._keyboard(key)) {
                keyboardCallback(key);
            }
        };
    };

    ContextLost.prototype._keyboard = function(key) {
        switch (key) {
            case 72: // 'h'
                break;
        }
                
        this._canvas._refreshRendering();
    };

    return ContextLost;
})();

