//
// m3d_load_modelgraph.js
// Load the model scene graph 
//
//  

import Globals    from "../../m3d_globals.js";
import MyMath     from "../../00utility/m3d_math.js";
import Element    from "../../03scene/graph/m3d_element.js";
import LoadMisc   from "../m3d_load_misc.js";

export default (function() {
    "use strict";
   
    function ModelGraphLoader(sceneObject, resourceManager) {
        this._sceneObject     = sceneObject;
        this._resourceManager = resourceManager;
    };

    ModelGraphLoader.prototype.destroy = function() {
        this._sceneObject = null;
        delete this._sceneObject;
        this._resourceManager = null;
        delete this._resourceManager;
    };
    
    ModelGraphLoader.prototype.load = function(modelFilePromises, progressTracker) {
        var that = this;
        var onprogress1 = progressTracker.getSingleFileProgress();
        return modelFilePromises["modelgraph.bin"].downloadFile()
            .then(function(res) {

                return that._parse(res.data);

            }, null, function(eventData) {
                onprogress1(eventData.loaded);
            });
    };

    ModelGraphLoader.prototype._parse = function(modelGraphBin) {
        var graph = this._sceneObject.model.graph;

        var rootElement = new Element(Element.ROOT, -1);  
        graph.root = rootElement;

        var byteLength = modelGraphBin.byteLength;
        var len = byteLength / 9;
        var index = 0;
        var e_name, e_father, e_type;

        var fathers = [];
        fathers.push(rootElement);

        var currentDocName = 0;

        for (var i = 0; i < len; i++) {
            var data = new Uint8Array(modelGraphBin, i * 9, 9);
            e_name   = ((data[3] << 24) | (data[2] << 16) | (data[1] << 8) | data[0]);
            e_father = ((data[7] << 24) | (data[6] << 16) | (data[5] << 8) | data[4]);
            e_type   = data[8];

            // Find the father 
            while (fathers.length > 0 && fathers[fathers.length - 1].name !== e_father) {
                fathers.pop();
            }
            if (fathers.length === 0) {
                console.log("father of " + e_name + " is wrong");
                return Globals.frontendCallbacks.getPromiseLibrary().reject("error");
            }

            var father = fathers[fathers.length - 1];
            
            // Create the element node object
            if (e_type === Element.NODE) {
                var node = graph.nodes[e_name];

                node.father = father;
                father.children.push(node);
            } else {
                if (e_type === Element.LINK) {
                    currentDocName = e_name;
                } 

                // The element name in the tree is cat result of doc Id and element Id.
                var elementName = currentDocName + '/' + e_name;

                var element = new Element(e_type, e_name);

                graph.elements[elementName] = element;
                graph.elementsNum++;
                element.father = father
                father.children.push(element);

                fathers.push(element);
            }
        }
        
        // Compute the bbox of each element
        for (var i = 0, len = rootElement.children.length; i < len; i++) {
            this._computeBBox(rootElement.children[i]);
        }

        // DEBUGGING
        //console.log("root");
        //for (var i = 0, len = rootElement.children.length; i < len; i++) {
        //    this._printTree(1, rootElement.children[i]);
        //}

        return Globals.frontendCallbacks.getPromiseLibrary().resolve("ok");
    };

    ModelGraphLoader.prototype._printTree = function(depth, node) {
        var line = '';
        for (var i = 0; i < depth; i++) {
            line += ' ';
        }

        var types = [
            "root",
            "i",
            "g",
            "e",
            "n",
            "l",
            ];

        if (node.hasOwnProperty("id")) { // Node
            line += "n " + "id=" + node.id;
            console.log(line);
        } else {
            line += types[node.type] + " name=" + node.name;
            console.log(line);
            for (var i = 0, len = node.children.length; i < len; i++) {
                this._printTree(depth + 1, node.children[i]);
            }
        }
    };

    var bbox1 = new Float32Array(6);
    ModelGraphLoader.prototype._computeBBox = function(node) {
        for (var i = 0, len = node.children.length; i < len; i++) {
            var child = node.children[i];
            var bbox;
            if (child.hasOwnProperty("id")) { // Node
                var graph = this._sceneObject.model.graph;
                graph.getNodeBBox(child.id, bbox1);
                bbox = bbox1;
            } else { // Node
                this._computeBBox(child);
                bbox = child.bbox;
            }

            MyMath.aabb.union(node.bbox, node.bbox, bbox);
        }
    };

    return ModelGraphLoader;

})();
