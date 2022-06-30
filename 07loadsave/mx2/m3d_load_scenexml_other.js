//
// m3d_load_scenexml_other.js
// Load the scene graph
//
//  

import Globals        from "../../m3d_globals.js";
import MyMath         from "../../00utility/m3d_math.js";
import Element        from "../../03scene/graph/m3d_element.js";

export default (function() {
    "use strict";

    function SceneXmlLoaderOther(sceneObject) {
        this._sceneObject = sceneObject;
    };
    
    SceneXmlLoaderOther.prototype.destroy = function() {
        delete this._sceneObject;
    };

    function StackNode() {
        var father;
        var node;
    };

    function XmlTStack() {
        this._stack    = [];
        this._top      = -1; // point the stack top
    };

    XmlTStack.prototype.push = function(node, father) {
        if (this._top >= this._stack.length - 1) {
            this._stack.push(new StackNode());
        }
            
        this._top++;
        this._stack[this._top].node = node;
        this._stack[this._top].father = father;
    };

    XmlTStack.prototype.pop = function() {
        this._top--;
    };
    
    XmlTStack.prototype.empty = function() {
        return this._top < 0;
    };

    XmlTStack.prototype.front = function() {
        return this._stack[this._top];
    };


    SceneXmlLoaderOther.prototype.load = function(sceneXml, sceneJson) {
        var graph = this._sceneObject.model.graph;

        var xmlDoc;
        if (typeof(sceneXml) === "string") {
            var parser = new DOMParser;
            xmlDoc = parser.parseFromString(sceneXml, "text/xml");
        } else {
            xmlDoc = sceneXml;
        }

        // Create root element
        var rootElement = new Element(Element.ROOT, "root");  
        graph.root = rootElement;

        // Create the other elements.
        var stack = new XmlTStack;
        
        var xmlNode = xmlDoc.getRootNode().childNodes[0];
        for (var i = 0, len = xmlNode.children.length; i < len; i++) {
            var child = xmlNode.children[i];
            var type = child.nodeName;
            if (type !== "n") {
                stack.push(child, graph.root);
            }
        }

        // Construct the scene tree from xml structure.
        var types = {
            "n": Element.NODE,
            "g": Element.GROUP,
            "i": Element.INSTANCE,
            "e": Element.ELEMENT,
        };
        while (!stack.empty()) {
            var xmlNode = stack.front().node;
            var father = stack.front().father;
            stack.pop();
                
            var type = xmlNode.nodeName;
            var e = null;
                
            var name = xmlNode.attributes[0].nodeValue;
            
            if (type === "n") {
                var id = parseInt(name);
                e = graph.nodes[id];
            } else {
                e = new Element(types[type], name);  
                graph.elements[e.name] = e;
                for (var i = 0, len = xmlNode.children.length; i < len; i++) {
                    var child = xmlNode.children[i];
                    stack.push(child, e);
                }
            }

            e.father = father;
            father.children.push(e);
        }

        // Compute the bbox of each element
        for (var i = 0, len = rootElement.children.length; i < len; i++) {
            this._computeBBox(rootElement.children[i]);
        }
    };

    var bbox1 = [0, 0, 0, 0, 0, 0];
    SceneXmlLoaderOther.prototype._computeBBox = function(element) {
        for (var i = 0, len = element.children.length; i < len; i++) {
            var child = element.children[i];
            if (child.type !== undefined) {
                this._computeBBox(child);
                MyMath.aabb.union(element.bbox, element.bbox, child.bbox);
            } else {
                this._sceneObject.model.graph.getNodeBBox(child.id, bbox1);
                MyMath.aabb.union(element.bbox, element.bbox, bbox1);
            }
        }
    };
    
    return SceneXmlLoaderOther;

})();
    
            

