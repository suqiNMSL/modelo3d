//
// m3d_load_bim_revit.js
// Load the bim information for revit
//
//  

import Globals         from "../../m3d_globals.js";
import ShaderLibrary   from "../../02resource/m3d_shader_library.js"
import BIM             from "../../03scene/bim/m3d_bim.js";

export default (function() {
    "use strict";
    
    function BimLoaderRevit(sceneObject, resourceManager) {
        this._sceneObject     = sceneObject;
        this._resourceManager = resourceManager;
        this._sceneObject.bim = new BIM(sceneObject);
    };

    BimLoaderRevit.prototype.destroy = function() {
        delete this._sceneObject;
    };

    BimLoaderRevit.prototype.load = function(bimJson) {
        var bim = null;
        if (typeof(bimJson) === "string") {
            bim = JSON.parse(bimJson);
        } else {
            bim = bimJson;
        }
        // Validate elements
        // FIXME: comment out following code because they are used only in debug mode.
        //var graph = this._sceneObject.graph;
        //for (var i = 0, len = graph.nodes.length; i < len; i++) {
        //    if (graph.nodes[i].drawable === null) {
        //        console.log(graph.nodes[i].name + " does not have drawable");
        //    }
        //}

        // Load bim information for each element
        var b = this._sceneObject.bim;
        
        // Load rooms
        var mesh = this._resourceManager.getMesh("cube");
        mesh.createSolidCube();
        
        var shaderType = "constant";
        var shader = this._resourceManager.getShader(shaderType, ["MODEL_TRANSFORM"]);
        if (!shader.ready) {
            var shaderSource = ShaderLibrary[shaderType];
            shader.createFromShaderSource(shaderSource, ["MODEL_TRANSFORM"]);
            if (!shader.ready) {
                throw("modelo3d error at creating shader '" + shaderType + "'!");
            }
        }
        
        b.create(bim, shader, mesh);
    };
    
    return BimLoaderRevit;

})();
