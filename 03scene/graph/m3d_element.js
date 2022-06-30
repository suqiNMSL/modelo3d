// m3d_element.js
// The scene drawable, which is one-to-one corresponding to the 
// original model scene graph drawable.
//
//  
//

import MyMath  from "../../00utility/m3d_math.js";

export default (function() {
    "use strict";

    function Element(type, name) {
        this.type     = type;
        this.name     = name;
        this.father   = null;
        this.children = [];
        this.bbox     = MyMath.aabb.create(); 
    };
    
    // Return all nodes that are descedants of this element.
    Element.prototype.getNodes = function() {
        var ret = [];

        var queue = [];
        
        for (var i = 0, len = this.children.length; i < len; ++i) {
            var child = this.children[i];
            if (child.children === undefined) { // element leaf/node
                ret.push(child);
            } else {
                queue.push(child);
            }
        }
        
        while (queue.length > 0) {
            var element = queue.pop();
            for (var i = 0, len = element.children.length; i < len; ++i) {
                var child = element.children[i];
                if (child.children === undefined) { // element leaf/node
                    ret.push(child);
                } else {
                    queue.push(child);
                }
            }
        }

        return ret;
    };

    // Find the doc element that has this element as desendent
    Element.prototype.getDocument = function() {
        var father = this.father;

        while (father !== null && father.type !== Element.LINK) {
            father = father.father;
        }

        if (father.type === Element.LINK) {
            return father;
        }
        return null;
    };

    Element.ROOT     = 0;
    Element.INSTANCE = 1;
    Element.GROUP    = 2;
    Element.ELEMENT  = 3; // Correspond to semantic node in the model defined by modelling.
    Element.NODE     = 4; // Correspond to drawable node (mesh + material) in the model
    Element.LINK     = 5; // Correspond to drawable node (mesh + material) in the model

    return Element;
})();
