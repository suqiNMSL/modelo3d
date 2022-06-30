// m3d_model.js
// A model is loaded from .mx file.
//
// Copyright Modelo XX - 2018, All rights reserved.

import MyMath    from "../00utility/m3d_math.js";
import Graph     from "./graph/m3d_scene_graph.js";
import Transform from "./drawables/m3d_transform.js";

export default (function() {

    function Model() {
        // private:
        
        // public:
        this.graph     = new Graph();  // The model structure
        this.transform = new Transform(null); 
        this.drawables = [];
        this.source    = "";
        this.id        = "";
        this.bbox      = [];
    };

    Model.prototype.destroy = function() {
        for (var i = 0, len = this.drawables.length; i < len; i++) {
            this.drawables[i].destroy();
        }
        this.drawables = null;
        delete this.drawables;

        this.graph.destroy();
        this.graph = null;
        delete this.graph;

        this.transform.destroy();
        this.transform = null;
        delete this.transform;
    };
    
    // Compute the bbox of model about visible drawables.
    Model.prototype.updateBBox = function() {
        var bbox = MyMath.aabb.createFromArray([
             Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE,
            -Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE]);

        var visibles = 0;

        for (var i = 0, len = this.drawables.length; i < len; i++) {
            var drawable = this.drawables[i];
            if (drawable.visible) {
                visibles++;
                MyMath.aabb.union(bbox, drawable.bbox, bbox);
            }
        }

        this.bbox = MyMath.aabb.createFromArray(bbox);
    };   

    return Model;

})();
