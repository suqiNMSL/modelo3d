//
// test_benchmark_cpu.js
// Benchmark/profile the CPU code of each frame and see anything can be optimized
// - use devtools of Chrome
// - wrap forloop in drawDrawables() with console.time/console.timeEnd to check CPU time.
//
//  

import DrawableLibrary from "../03scene/drawables/m3d_drawable_library.js";
import LoadManual  from "../07loadsave/m3d_load_manual.js";

export default (function() {

    "use strict";

    function TestBenchmarkCPU(canvas) {
        // Inheritance:
        Empty.apply(this, arguments);

        this._facing = true;
    };

    TestBenchmarkCPU.prototype._createScene = function() {
        var loader = new LoadManual(this._canvas._scene, 
            this._canvas._sceneCamera, this._canvas._renderScene);

        var drawableSphere;
        for (var x = -20; x <= 20; x++) {
            for (var y = -20; y <= 20; y++) {
                for (var z = -20; z <= 20; z++) {
                    drawableSphere = DrawableLibrary.createSolidSphere(this._canvas._resourceManager, 
                        [0, 0, 1], 0.25, [x, y, z]);
                    loader.addDrawable(drawableSphere);
                }
            }
        }

        loader.load();
        
    };

    TestBenchmarkCPU.prototype.update = function() {
        this._canvas._lazyRendering = false;
        this._print();
    };

    TestBenchmarkCPU.prototype.bindKeyboard = function(keyboard) {
        Empty.prototype.bindKeyboard.apply(this, arguments);
    };

    TestBenchmarkCPU.prototype._keyboard = function(key) {
        var enabled = true;
        switch (key) {
            case 70: // 'f'
                if (this._facing) {
                    this._canvas._sceneCamera.pan(2000.0, 0); // move scene out of camera
                    this._facing = false;
                } else {
                    this._canvas._sceneCamera.pan(-2000.0, 0); // move in
                    this._facing = true;
                }
                this._canvas._refreshRendering();
                return true;
        }
        return false;
    };

    TestBenchmarkCPU.prototype._print = function(culled) {
        this._text.innerHTML = 
            "<p>Press 'f' to the move objects out of/in to view.</p>";
    };

    return TestBenchmarkCPU;
})();

