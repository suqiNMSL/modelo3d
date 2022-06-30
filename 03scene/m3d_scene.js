// m3d_scene.js
// The scene object/drawable
//
//  


import Globals              from "../m3d_globals.js";
import MyMath               from "../00utility/m3d_math.js";
import Light                from "./m3d_light.js";
import SceneClipping        from "./m3d_scene_clip.js";
import Drawable             from "./drawables/m3d_drawable.js";
import DrawableInstanced    from "./drawables/m3d_drawable_instanced.js";
import Node                 from "./graph/m3d_node.js";
import MaterialManager      from "./m3d_material_manager.js";
import Background           from "./m3d_background.js";


export default (function() {
    "use strict";

    function Scene(resourceManager) {
        // private:
        this._lights          = [];
        
        // public:
        this.model      = null;
        this.terrain    = null;
        this.background = new Background(resourceManager);

        // FIXME: make most of them private
        //
        this.layers          = [];      // Layers of drawables.
        this.views           = {};      // The user defined views
        this.defaultView     = null;    // The default view

        this.materialManager = new MaterialManager(resourceManager); // The matetial manager
        
        this.bbox            = MyMath.aabb.create(); // The current bbox of visible drawables
        this.scale           = 1.0;     // Half of the length of the largest bbox edge
        this.scaleRatio      = 1.0;
        this.radius          = 0;       // The radius of bounding sphere of the scene

        this.faces           = 1;       // 0: this model is created in a bad way, it has broken faces (inconsistent wind order).
                                        // 1: each object in this model has only one face.
                                        // 2: each object in this model has two faces, e.g., skp models.

        // FIXME: use lights from model data.
        this._lights[0]      = new Light();
        
        this.clipping        = new SceneClipping(this);
        
        this.isBimCullingNeeded = false;
        this.hasCurveOrLine = false; //Is there line info extracted from model, for rhino model
        this.hasProfileLines = false; //Is there line info extracted from model, for revit model

        this.compressed = false; // whether the scene geometry is compressed; check out comments in 
                                 // m3d_mesh_attributes.js.
    }; 

    // Do a clean exit when the scene is about to reload.
    Scene.prototype.destroy = function() {
        if (this.model) {
            this.model.destroy();
        }
        this.model = null;
        delete this.model;

        if (this.background) {
            this.background.destroy();
        }
        this.background = null;
        delete this.background;

        if (this.terrain) {
            this.terrain.destroy();
        }
        this.terrain = null;
        delete this.terrain;

        var i, len;
        for (i = 0, len = this.layers.length; i < len; i++) {
            this.layers[i].destroy();
        }
        this.layers = null;
        delete this.layers;

        this.materialManager.destroy();
        this.materialManager = null;
        delete this.materialManager;

        this.bbox        = null;

        this._lights     = null;
        this.clipping    = null;
    };
    
    Scene.prototype.setLayerVisible = function(layerIndex, visible) {
        // Update the visibility of each drawable.
        var layer = this.layers[layerIndex];

        return layer.setVisible(visible);
    };
    
    Scene.prototype.setLayersVisible = function(layerIndexes, visible) {

        for (var i = 0; i < layerIndexes.length; i++) {
            var layerIndex = parseInt(layerIndexes[i]);
            var layer = this.layers[layerIndex];
            layer.setVisible(visible);
        }
        
        if (!this.clipping.isEnabled()) {
            // Update the bbox of the scene
            this.updateBBox();
        }
        return true;
    };

    Scene.prototype.updateBBox = function() {
        var bbox = MyMath.aabb.createFromArray([
             Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE,
            -Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE]);

        // FIXME: the bbox will be infinite when neither model and terrain is
        // visible, the following camera computation will be wrong but as the
        // canvas is empty, we're good.

        if (this.model) {
            // FIXME: on BIM product, we don't have either layer or view control so
            // that the bbox of the model never changes.
            this.model.updateBBox();
            MyMath.aabb.union(bbox, bbox, this.model.bbox);
        }

        if (this.terrain) {
            MyMath.aabb.union(bbox, bbox, this.terrain.bbox);
        }

        this.setBBox(bbox);
    };

    Scene.prototype.setActiveView = function(viewName) {
        if(this.views[viewName].drawables.length === 0 && this.views[viewName].layers.length === 0) {
            return;
        }
        
        var view = this.views[viewName];
        view.visible = true;
        var i = 0;
        var len = 0;
        if (view.drawables.length) {
            for (i = 0, len = view.drawables.length; i < len; i++) {
                view.drawables[i].visible = false;
            }
                
            for (i = 0, len = view.drawables.length; i < len; i++) {
                view.drawables[i].visible = true;
            }
        }
        
        if (!this.clipping.isEnabled()) {
            this.updateBBox();
        }
    };

    Scene.prototype.getDefaultView = function() {
        return this.defaultView.name;
    };

    // Get the layer with same name
    Scene.prototype.getLayerByName = function(layerName) {
        for (var i = 0, len = this.layers.length; i < len; i++) {
            if (this.layers[i].name === layerName) {
                return this.layers[i];
            }
        }

        return null;
    }; 

    Scene.prototype.setLightingIntensity = function(intensity) {
        this._lights[0].setIntensity(intensity);
    };
    Scene.prototype.setSpecularShinness = function(intensity) {
        this._lights[0].setSpecularShinness(intensity);
    };

    Scene.prototype.setLightingLatitude = function(angle) {
        this._lights[0].setLatitude(angle);
    }; 

    Scene.prototype.setLightingLongitude = function(angle) {
        this._lights[0].setLongitude(angle);
    }; 
    
    Scene.prototype.setMainLight = function(light) {
        this._lights[0] = light;
    };
    
    Scene.prototype.getMainLight = function() {
        return this._lights[0];
    };
    
    // Set the bbox of the scene directly
    Scene.prototype.setBBox = function(bbox) {
        this.bbox = MyMath.aabb.createFromArray(bbox);
        MyMath.aabb.expand(this.bbox);
        var size = MyMath.aabb.size(this.bbox);
        this.scale = Math.max(size.width, Math.max(size.height, size.depth)) * 0.5;
        this.radius = MyMath.aabb.length(this.bbox) * 0.5;
    };

    // Whether we need to render one face twice, for front and back faces. 
    Scene.prototype.needRenderDoubleSided = function() {
        return (this.faces < 1 || (this.faces <= 1 && this.clipping.isEnabled()));
    };

    Scene.prototype.setElementsVisible = function(elements, visible) {
        // Set the nodes visibility one by one.
        var nodes = [];
        var drawables = {};
        for (var i = 0, len = elements.length; i < len; i++) {
            var l = elements[i].getNodes();
            for (var j = 0, len1 = l.length; j < len1; j++) {
                var node = l[j];

                node.visible = visible;
                drawables[node.drawable.name] = drawable;
            }
        }

        for (var d in drawables) {
            drawables[d].updateVisibility();
        }
    };

    Scene.prototype.setElementsMaterial = function(elements, material) {
        if (material.hasTexture) {
            console.warn("can't change element material to material with textures");
            return ;
        }

        // Get the material ID 
        // var materialId = this.

        // Change node's material one by one.
        var nodes = [];
        for (var i = 0, len = elements.length; i < len; i++) {
            var l = elements[i].getNodes();
            for (var j = 0, len1 = l.length; j < len1; j++) {
                var node = l[j];

                node.drawable.setNodeMaterial(node, materialId);
            }
        }
    };

    return Scene;
})();
    
