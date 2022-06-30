//
// m3d_focus_element.js
// Pick an element
//
//  

import Globals        from "../../m3d_globals.js"
import MyMath         from "../../00utility/m3d_math.js";
import RenderTarget   from "../../04renderer/m3d_rendertarget.js";
import RenderNodes    from "../../04renderer/m3d_rendernodes.js";
import PickQuery      from "./m3d_pick_query.js"
import DepthQuery     from "./m3d_depth_query.js"

export default (function() {
    "use strict";
    
    function FocusElement(scene, resourceManager, renderScene, camera) {
        // public:
        this.enabled          = false;
        this._multiselect     = false;
        this._elementSelect   = true;
        // private:
        this._focused         = {}; // the focused elements
        this._scene           = scene;
        this._renderScene     = renderScene;
        this._camera          = camera;
        this._resourceManager = resourceManager;
        
        this._pickQuery  = null;
        this._depthQuery = new DepthQuery(scene, resourceManager);

        this._focusRegion = MyMath.aabb.create();
    };

    FocusElement.prototype.destroy = function() {
        if (this._pickQuery) {
            this._pickQuery.destroy();
            this._pickQuery = null;
            delete this._pickQuery;
        }

        this._depthQuery.destroy();
        this._depthQuery = null;
        delete this._depthQuery;

        this._scene = null;
        delete this._scene;
        this._resourceManager = null;
        delete this._resourceManager;
    };
 
    FocusElement.prototype.setEnabled = function(enabled) {
        // We only deal with the model elements. 
        if (enabled && this._pickQuery === null) {
            this._pickQuery  = new PickQuery(this._scene, this._scene.model.drawables, this._resourceManager);
        }
        this.enabled = enabled;
        this._renderScene.setElementsEnabled(enabled);
        this._renderScene.adjustOverrideStatus();
    };

    FocusElement.prototype.onMouseUp = function(mouse, renderer) {
        if (!this.enabled || !this._elementSelect) {
            return ;
        }
        return this._select(mouse.x, mouse.y, renderer);
    };

    FocusElement.prototype.setMultiselect = function(enabled) {
        this._multiselect = enabled;
    };
    
    FocusElement.prototype.setElementSelect = function(enabled) {
        this._elementSelect = enabled;
    };

    FocusElement.prototype.onTouchStop = function() {
        console.error("not implemented");
    };

    FocusElement.prototype.recompileShader = function(resourceManager, states) {
        if (this._pickQuery) {
            this._pickQuery.recompileShader(resourceManager, states);
        }
        this._depthQuery.recompileShader(resourceManager, states);
    };

    FocusElement.prototype._select = function(x, y, renderer) {
        var focused = null;

        // Find the drawable that intersects the pick ray using object ID
        // rasterization.
        var drawable = this._pickQuery.pick(x, y, renderer, this._camera);
        if (drawable !== null) {
            // point: the ray starting point
            // direction: the ray direction
            // position: the position in world space should be contained by the bbox of this element.
            var position = this._depthQuery.unproject(x, y, renderer, this._camera);
            var point = vec3.create();
            var direction = vec3.create();
            this._camera.shootRay(x, y, point, direction);

            // Find the intersected element leaf using ray-bbox intersection.
            focused = drawable.pickNode(point, direction, position, this._scene.model.graph);

            
            if (focused) {
                // Trace the intersected element drawable with element type.
                focused = focused.getElement();
                modelo3d.debug("element " + focused.name + " is picked");
            }
        }
        
        if (focused) {
            MyMath.aabb.copy(this._focusRegion, focused.bbox);
            if (this._multiselect) {
                if (!this._focused[focused.name]) {
                    this._focused[focused.name] = focused;
                } else {
                    delete this._focused[focused.name];
                }
            } else {
                this._focused = {};
                this._focused[focused.name] = focused;
                this._camera.lookTo(MyMath.aabb.center(this._focusRegion), MyMath.aabb.length(this._focusRegion) / 2);
            }
            var nodes = [];
            for (var name in this._focused) {
                MyMath.aabb.union(this._focusRegion, this._focusRegion, this._focused[name].bbox);
                var _nodes = this._focused[name].getNodes();
                for (var j = 0, len2 = _nodes.length; j < len2; j++) {
                    nodes.push(_nodes[j]);
                }
            }
            //MOD-8926 TODO:
            //Ingore the skp, s3d and other non-BIM model file with only one drawable
            if (this._scene.model.graph.elementsNum <= 2) {
                nodes = [];
                this._renderScene.clearRenderNodes(RenderNodes.NORMAL);
            } else {
                this._renderScene.setRenderNodesMateterial(nodes, null, RenderNodes.NORMAL);
            }
        } else {
            if (!this._multiselect) {
                this._focused = {};
                this._renderScene.clearRenderNodes(RenderNodes.NORMAL);
            }
        }
        
        this._renderScene.adjustOverrideStatus();
        return this._focused;
    };

    FocusElement.prototype.focus = function(elementNames, changeCamera) {
        if (!this.enabled) {
            return;
        }
        
        if (!elementNames || elementNames.length < 1) {
            this._focused = {};
            this._renderScene.clearRenderNodes(RenderNodes.NORMAL);
            this._renderScene.adjustOverrideStatus();
            return ;
        }

        MyMath.aabb.copy(this._focusRegion, this._scene.model.graph.elements[elementNames[0]].bbox);
        var nodes = [];
        for (var i = 0, len = elementNames.length; i < len; i++) {
            // Collect focused nodes.
            var elementName = elementNames[i];

            var element = this._scene.model.graph.elements[elementName];
            var _nodes = element.getNodes();
            
            for (var j = 0, len2 = _nodes.length; j < len2; j++) {
                nodes.push(_nodes[j]);
            }
            // Find the bbox of focused elements
            MyMath.aabb.union(this._focusRegion, this._focusRegion, element.bbox);

            // Update the internal focused elements
            this._focused[elementName] = element;
        }

        if (this._scene.model.graph.elementsNum <= 2) {
            this._renderScene.clearRenderNodes(RenderNodes.NORMAL);
        } else {
            this._renderScene.setRenderNodesMateterial(nodes, null, RenderNodes.NORMAL);
            this._renderScene.adjustOverrideStatus();
        }
        
        if (changeCamera) {
            this._camera.lookTo(MyMath.aabb.center(this._focusRegion), MyMath.aabb.length(this._focusRegion) / 2);
        }
    };
    
    FocusElement.prototype.getColors = function(elements) {
        if (!elements || elements.length < 1) {
            return ;
        }
        
        var fileLevelElements = this._scene.bim.elements;
        var graphElements = this._scene.model.graph.leaves;
        var elementColors = [];
        for (var i = 0, len = elements.length; i < len; i++) {
            var elementName = elements[i];
            if (elementName === null) {
                continue;
            }
            for (var file in fileLevelElements) {
                var levelElements = fileLevelElements[file];
                for (var level in levelElements) {
                    var element = levelElements[level][elementName];
                    if (element) {
                        var color = null;
                        //FIXME: can not get the accurate color if there is more than one
                        //color in the element
                        for (var j = 0, len1 = element.N.length; j < len1; j++) {
                            var drawable = graphElements[element.N[j]].drawable;
                            if (drawable.mesh.isTriangle()) {
                                color = drawable.material.getDiffuse().slice(0,3);
                                break;
                            }
                        }
                        elementColors.push(color);
                    }
                }
            }
        }
        return elementColors;
    };
    
    
    
    return FocusElement;
})();
    
