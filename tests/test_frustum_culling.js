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
    
    function TestFrustumCulling(canvas) {
        // private:
        this._canvas = canvas;
        this._cubes = [];
        this._wiredCubes = [];
        this._testCamera = null;
        this._frustum = null;
        this._interactive = true;
        this._showSolid = true;
        this._buffer = new Uint8Array(Globals.width * Globals.height * 4);
        
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

    TestFrustumCulling.prototype.renderScene = function() {
        if (this._interactive) {
            this._canvas._renderer.clear(this._renderTarget0, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            if (this._showSolid) { 
                this._canvas._renderer.drawDrawables(this._renderTarget0, this._cubes, 
                        this._canvas._sceneCamera, null, null, null, null, null, gl.CCW);
            }
            this._canvas._renderer.drawDrawables(this._renderTarget0, this._wiredCubes, 
                    this._canvas._sceneCamera, null, null, null, null, null, gl.CCW);
        } 
        return 0;
    };

    TestFrustumCulling.prototype._createScene = function() {
        this._renderTarget0 = new RenderTarget("default", this._canvas._resourceManager,
            Globals.width, Globals.height, { "clearColor": [1.0, 1.0, 1.0, 0.0]});

        this._renderTarget = new RenderTarget("default", this._canvas._resourceManager,
            Globals.width / 4, Globals.height / 4, { "clearColor": [0.0, 1.0, 0.0, 1.0]});

        this._testCamera = new BaseCamera();
        this._testCamera.resize(Globals.width / 4, Globals.height / 4);
        this._testCamera._phi = Math.PI * 0.4999;
        this._testCamera._theta = 0;
        this._testCamera._distance = 30;
        this._testCamera.update();

        var mesh = CameraUtility.createFrustumWireframe(this._testCamera, this._canvas._resourceManager);
        this._frustum = DrawableLibrary.createWiredDrawable(this._canvas._resourceManager, mesh, [0, 0, 0]);


        // Initialize the scene
        var loader = new LoadManual(this._canvas._scene, this._canvas._sceneCamera, this._canvas._renderScene);

        var drawableCube;
        var drawableWiredCube;
        for (var x = -5; x <= 5; x++) {
            for (var y = -5; y <= 5; y++) {
                var z = 0;

                var drawableCube = DrawableLibrary.createSolidCube(this._canvas._resourceManager, [1, 0, 0],
                    0.5, [x, y, z]);
                var drawableWiredCube = DrawableLibrary.createWiredCube(this._canvas._resourceManager, [0, 0, 1],
                    0.5, [x, y, z]);
                loader.addDrawable(drawableCube);
                loader.addDrawable(drawableWiredCube);

                this._cubes.push(drawableCube);
                this._wiredCubes.push(drawableWiredCube);
            }
        }

        loader.load();
    };

    TestFrustumCulling.prototype.update = function() {
        this._canvas._renderer.renderState.invalidateStates();
        
        if (this._interactive) {
            var w = Globals.width / 4;
            var h = Globals.height / 4;
            var x = 0;
            var y = 0;
            this._canvas._renderer.renderState.viewport([x, y, w, h]);
            gl.scissor(x, y, w, h);
            gl.enable(gl.SCISSOR_TEST);
            this._canvas._renderer.clear(this._renderTarget, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.disable(gl.SCISSOR_TEST);

            this._frustum.mesh = CameraUtility.createFrustumWireframe(this._canvas._sceneCamera, 
                    this._canvas._resourceManager);

            this._canvas._renderer.drawDrawable(this._renderTarget, this._frustum,
                    this._testCamera, false, null, null, false);

            this._canvas._renderer.drawDrawables(this._renderTarget, this._wiredCubes, 
                    this._testCamera, false, null, null, false);

            var culled = 0;
            for (var i = 0, len = this._cubes.length; i < len; i++) {
                if (!this._canvas._sceneCamera.cull(this._cubes[i])) {
                    this._canvas._renderer.drawDrawable(this._renderTarget, this._cubes[i], 
                            this._testCamera, false, null, null, false);
                } else {
                    culled++;
                }
            }
        
            this._print(culled);
        } else {
            var index = 0;
            for (var x = -5; x <= 5; x++) {
                for (var y = -5; y <= 5; y++) {
                    this._canvas._renderer.clear(this._renderTarget0, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

                    this._canvas._renderer.drawDrawable(this._renderTarget0, this._cubes[index], 
                            this._canvas._sceneCamera, null, null, null, gl.CCW);
                    this._canvas._renderer.drawDrawable(this._renderTarget0, this._wiredCubes[index], 
                            this._canvas._sceneCamera, null, null, null, gl.CCW);
                
                    var computeCulled = false;
                    if (this._canvas._sceneCamera.cull(this._cubes[index]) &&
                        this._canvas._sceneCamera.cull(this._wiredCubes[index])) {
                        computeCulled = true;
                    }

                    var actualCulled = true;
                    gl.readPixels(0, 0, Globals.width, Globals.height, gl.RGBA, gl.UNSIGNED_BYTE, this._buffer);
                    for (var i = 0; i < Globals.height; i += 10) {
                        for (var j = 0; j < Globals.width; j += 10) {
                            var pos = (i * Globals.width + j) * 4;
                            if (this._buffer[pos + 0] < 255 ||
                                this._buffer[pos + 1] < 255 ||
                                this._buffer[pos + 2] < 255 ||
                                this._buffer[pos + 3] < 255) {
                                actualCulled = false;
                            }
                        }
                    }

                    if (actualCulled !== computeCulled) {
                        console.error("culling computation error for (%d, %d) cube", x, y);
                        if (actualCulled) {
                            console.log("It should be culled");
                        }
                    }

                    index++;
                    this._print(index);
                }
            }
        }
        
    };

    TestFrustumCulling.prototype.bindKeyboard = function(keyboard) {
        var that = this;
        var keyboardCallback = keyboard.onKeyDownCallback;
        keyboard.onKeyDownCallback = function(key) {
            if (!that._keyboard(key)) {
                keyboardCallback(key);
            }
        };
    };

    TestFrustumCulling.prototype._keyboard = function(key) {
        var perspective = true;
        switch (key) {
            case 70: // 'f'
                perspective = this._canvas._sceneCamera.isPerspective();
                this._canvas._sceneCamera.setPerspective(!perspective);
                return true;
            case 71: // 'g', interactive
                this._interactive = !this._interactive;
                break;
            case 72: // 'h'
                this._showSolid = !this._showSolid;
                break;
        }
                
        this._canvas._refreshRendering();
    };

    TestFrustumCulling.prototype._print = function(culled) {
        this._text.innerHTML = 
            "<p>Browse the scene to see how many cubes gets <br> culled by scene camera's frustum.<br>" +
            "Press 'f' to toggle orthogonal and perspective camera.<br>" +
            "Press 'g' to toggle interaction.<br><br>" +
            "Projection: " + (this._canvas._sceneCamera.isPerspective()? "perspective" : "ortho") + "<br>" +
            (this._interactive? "Culled: " + culled + " out of " + this._cubes.length : "cube: " + culled) + " </p>";
    };

    return TestFrustumCulling;
})();

