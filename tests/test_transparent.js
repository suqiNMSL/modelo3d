//
// test_transparency.js
// Test an tailored painter algorithm (sorting)
//
//  

import Globals       from "../m3d_globals.js";
import math          from "../00utility/m3d_math.js";
import ShaderLibrary from "../02resource/m3d_shader_library.js";
import Drawable          from "../03scene/drawables/m3d_drawable.js";
import MaterialAdhoc from "../03scene/materials/m3d_material_adhoc.js";
import LoadManual    from "../07loadsave/m3d_load_manual.js";

export default (function() {
    "use strict";

    function TestTransparent(canvas) {
        // private:
        this._canvas    = canvas;
        this._drawables     = [];
        this._materials = []; 

        this._sorting = false;

        this._createScene();
        
        // Create the text panel
        var mainBody = document.getElementsByTagName("body")[0];
        this._text = document.createElement("div");
        this._text.style.color = 'blue';
        this._text.style.fontSize = Globals.isMobile? '10pt' : '9pt';
        this._text.style.position = 'absolute';
        this._text.style.top = '430px';
        this._text.style.left = '10px';
        this._text.innerHTML = "fuck";
        mainBody.appendChild(this._text);
        
        canvas.setAOEnabled(false);
        canvas.setShadowEnabled(false);
        canvas._renderScene.setOITEnabled(false);
    };

    TestTransparent.prototype._createScene = function() {
        var loader = new LoadManual(this._canvas._scene, this._canvas._sceneCamera, this._canvas._renderScene);

        // Create planes with different transformation.
        var mesh = this._canvas._resourceManager.getMesh("test-quad");
        mesh.createQuad();

        var flags = [];
        flags.push("MODEL_TRANSFORM");

        var shader = this._canvas._resourceManager.getShader("plain-test", flags);
        if (!shader.ready) {
            shader.createFromShaderSource(ShaderLibrary["plain"], flags);
        }
        
        // create materials.
        this._materials.push(new MaterialAdhoc("red"));
        this._materials.push(new MaterialAdhoc("green"));
        this._materials.push(new MaterialAdhoc("blue"));
        
        this._materials[0].attachShader(shader);
        this._materials[1].attachShader(shader);
        this._materials[2].attachShader(shader);

        this._materials[0].setDiffuse([1, 0, 0]);
        this._materials[0].setTransparent(0.5);

        this._materials[1].setDiffuse([0, 1, 0]);
        this._materials[1].setTransparent(0.5);

        this._materials[2].setDiffuse([0, 0, 1]);
        this._materials[2].setTransparent(0.5);

        // horizontal
        for (var i = 0; i < 100; ++i) {
            var transform = mat4.create();
            var x = Math.random() * 20.0 - 10.0;
            var y = Math.random() * 20.0 - 10.0;
            var z = Math.random() * 20.0 - 10.0;
            mat4.fromTranslation(transform, [x, y, z]);
            var bbox = math.aabb.create([-1.0, -1.0, -1.0], [1.0, 1.0, 1.0]);
            math.aabb.transform(bbox, bbox, transform);
            var drawable = new Drawable("drawable" + i, mesh, null, shader, 
                    this._materials[i % 3], transform, bbox);
            loader.addDrawable(drawable);
        }
        
        // vertical
        for (var i = 0; i < 100; ++i) {
            var transform = mat4.create();
            mat4.fromRotation(transform, Math.PI * 0.5, [1, 0, 0]);
            var x = Math.random() * 20.0 - 10.0;
            var y = Math.random() * 20.0 - 10.0;
            var z = Math.random() * 20.0 - 10.0;
            mat4.translate(transform, transform, [x, y, z]);
            var bbox = math.aabb.create([-1.0, -1.0, -1.0], [1.0, 1.0, 1.0]);
            math.aabb.transform(bbox, bbox, transform);
            var drawable = new Drawable("drawable" + i, mesh, null, shader, 
                    this._materials[i % 3], transform, bbox);
            loader.addDrawable(drawable);
        }

        loader.load();
    };
    
    TestTransparent.prototype.update = function() {
        this._print();
    };
    
    TestTransparent.prototype.bindKeyboard = function(keyboard) {
        var that = this;
        var keyboardCallback = keyboard.onKeyDownCallback;
        keyboard.onKeyDownCallback = function(key) {
            if (!that._keyboard(key)) {
                keyboardCallback(key);
            }
        };
    };
    
    TestTransparent.prototype._keyboard = function(key) {
        switch (key) {
            case 70: // 'f'
                this._sorting = !this._sorting;
                break;
        }
                
        this._canvas._refreshRendering();
    };
    
    TestTransparent.prototype._print = function() {
        this._text.innerHTML = 
            "<p>Order independent transparents rendering<br>" +
            "Press 'f' to toggle sorting and not sorting: " + (this._sorting? "yes" : "no") + 
            "</p>";
    };
    
    return TestTransparent;
})();

