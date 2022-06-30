//
// m3d_load_manual.js
// Construct the scene manually
//
//  

import Layer   from "../03scene/m3d_layer.js";
import Utils   from "../00utility/m3d_utils.js";

export default (function() {
    "use strict";

    function LoadManual(sceneObject, cameraObject, renderer) {
        this._sceneObject     = sceneObject;
        this._cameraObject    = cameraObject;
        this._renderer        = renderer;
    };

    LoadManual.prototype.addDrawable = function(drawableObject) {
        this._sceneObject.drawables.push(drawableObject);
        if (this._sceneObject.layers.length === 0) {
            this._sceneObject.layers.push(new Layer("default", 0, [1, 1, 1], true));
        }
        this._sceneObject.layers[0].drawables.push(drawableObject);
        drawableObject.layer = this._sceneObject.layers[0];
    };
    
    LoadManual.prototype.removeDrawable = function(drawableObject) {
        var index;
        index = Utils.indexOf(this._sceneObject.drawables, drawableObject);
        if (index !== -1) {
            this._sceneObject.drawables.splice(index, 1);
        }

        index = Utils.indexOf(this._sceneObject.layers[0].drawables, drawableObject);
        if (index !== -1) {
            this._sceneObject.layers[0].drawables.splice(index, 1);
        }
    };

    LoadManual.prototype.load = function() {
        // Compute the bbox of scene
        this._sceneObject.updateBBox();
        // Update the renderer
        this._renderer.onSceneChanged(this._sceneObject);
        // Update the camera
        this._cameraObject.reset(true);
    };
    
    return LoadManual;
})();
    
