//
// m3d_load_scenexml_revit.js
// Load the scene graph for revit
//
//  

import Globals        from "../../m3d_globals.js";
import MyMath         from "../../00utility/m3d_math.js";
import Element        from "../../03scene/graph/m3d_element.js";

export default (function() {
    "use strict";

    function SceneXmlLoaderRevit(sceneObject) {
        this._sceneObject = sceneObject;
    };
    
    SceneXmlLoaderRevit.prototype.destroy = function() {
        delete this._sceneObject;
    };

    SceneXmlLoaderRevit.prototype.load = function(sceneXml, sceneJson) {
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

        // Create other elements.
        var xmlNode = xmlDoc.getRootNode().childNodes[0];
        for (var i = 0, len = xmlNode.children.length; i < len; i++) {
            var child = xmlNode.children[i];
            var type = child.nodeName;

            // type must be 'e'
            var element = new Element(Element.ELEMENT, child.attributes[0].nodeValue);
            element.father = rootElement;
            rootElement.children.push(element);
            graph.elements[element.name] = element;
            graph.elementsNum++;
            this._parseElement(child, element);
        }

        // Compute the bbox of each element
        for (var i = 0, len = rootElement.children.length; i < len; i++) {
            this._computeBBox(rootElement.children[i]);
        }
    };

    SceneXmlLoaderRevit.prototype._parseElement = function(xmlNode, father) {
        var graph = this._sceneObject.model.graph;
        for (var i = 0, len = xmlNode.children.length; i < len; i++) {
            var child = xmlNode.children[i];
            var type = child.nodeName;
            if (type === 'n') {
                var id = parseInt(child.attributes[0].nodeValue);
                var node = this._sceneObject.model.graph.nodes[id];
                node.father = father;
                father.children.push(node);
            } else if (type === 'i') {
                var instance = new Element(Element.INSTANCE, child.attributes[0].nodeValue);
                instance.father = father;
                father.children.push(instance);
                this._parseElement(child, instance);
            } else if (type === 'e') {
                var element = new Element(Element.ELEMENT, child.attributes[0].nodeValue);
                element.father = father;
                father.children.push(element);
                this._sceneObject.model.graph.elements[element.name] = element;
                graph.elementsNum++;
                this._parseElement(child, element);
            } else if (type === 'l') {
                var element = new Element(Element.GROUP, child.attributes[0].nodeValue);
                element.father = father;
                father.children.push(element);

                this._parseElement(child, element);
            }
        }
    };

    var bbox1 = new Float32Array(6);
    SceneXmlLoaderRevit.prototype._computeBBox = function(node) {
        for (var i = 0, len = node.children.length; i < len; i++) {
            var child = node.children[i];
            var bbox;

            if (child.hasOwnProperty("id")) { // Node
                this._sceneObject.model.graph.getNodeBBox(child.id, bbox1);
                bbox = bbox1;
            } else { // Node
                this._computeBBox(child);
                bbox = child.bbox;
            }

            MyMath.aabb.union(node.bbox, node.bbox, bbox);
        }
    };
    
    return SceneXmlLoaderRevit;

})();
    
            

