// The scene tree.
//
//  
//

import Globals from "../../m3d_globals.js";
import Math    from "../../00utility/m3d_math.js";

export default (function() {
    "use strict";

    function SceneGraph() {
        this.nodes        = [];    // all scene nodes 
        this.nodeBBoxes   = null;  // The node bounding boxes
        this.root         = null;  // the root element of scene tree
        this.elements     = {};    // elements indexed by name
        this.elementsNum  = 0;
    };

    SceneGraph.prototype.destroy = function() {
        this.nodes = null;
        delete this.nodes;

        this.elements = null;
        delete this.elements;

        this.nodeBBoxes = null;
        delete this.nodeBBoxes;
        
        this.root = null;
        delete this.root;
    };

    SceneGraph.prototype.createNodes = function(number) {
        this.nodes = new Array(number);
        this.nodeBBoxes = new Float32Array(number * 6);
    };

    SceneGraph.prototype.getNodeBBox = function(elementIndex, bbox) {
        var j = elementIndex * 6;

        bbox[0] = this.nodeBBoxes[j];
        bbox[1] = this.nodeBBoxes[j + 1];
        bbox[2] = this.nodeBBoxes[j + 2];
        bbox[3] = this.nodeBBoxes[j + 3];
        bbox[4] = this.nodeBBoxes[j + 4];
        bbox[5] = this.nodeBBoxes[j + 5];
    };

    function _ElementPathsRet() {
        this.fileName = "";
        this.elementName = "";
    };
    /**
     * @description Find the doc id of each element 
     * @constructor 
     * @param {array} elements - the array of element objects
     * @return {array} - [{fileName: integer, elementName: integer}, {fileName:, elementName:}, ...}]
     */
    SceneGraph.prototype.getElementPaths = function(elements) {
        var ret = [];
        for (var e in elements) {
            var r = {};
            r.element = elements[e].name;
            
            ret.push(r);
        }

        return ret;
    };
    
    return SceneGraph;
})();
