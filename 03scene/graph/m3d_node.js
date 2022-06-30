// The scene drawable, which is one-to-one corresponding to the 
// original model scene graph drawable.
//
//  
//

import Globals from "../../m3d_globals.js";
import MyMath  from "../../00utility/m3d_math.js";
import Element from "./m3d_element.js";

export default (function() {
    "use strict";
    
    function Node(id) {
        this.id = id; 
        
        // The location of this element 
        this.region  = Node.STRUCTURE; 

        // Refer to its parent
        this.father = null;

        // The indices section of this element in this drawable.
        this.indicesOffset = 0;
        this.indicesCount  = 0;

        this.verticesCount = 0; // number of vertices

        // The drawable that contained this element. Only useful in BIM.
        this.drawable = null;

        // The visibility
        this.visible = true;
    };
    
    Node.STRUCTURE          = 0;
    Node.STRUCTURE_INTERIOR = 4;
    Node.INTERIOR           = 8;
    Node.MEP                = 12;
    Node.LANDSCAPE          = 15;

    // Get the nearest instance that contains this element.
    Node.prototype.getInstance = function() {
        var element = this.father;
        while (element.type !== Element.INSTNACE) {
            element = element.father;
            if (element === null) {
                break;
            }
        }

        return element;
    };

    // Get the nearest group that contains this element.
    Node.prototype.getGroup = function() {
        var element = this.father;
        while (element.type !== Element.GROUP) {
            element = element.father;
            if (element === null) {
                break;
            }
        }

        return element;
    };
    
    // Get the nearest element
    Node.prototype.getElement = function() {
        var element = this.father;
        while (element.type !== Element.ELEMENT) {
            element = element.father;
            if (element === null) {
                break;
            }
        }

        return element;
    };

    // Get the nearest component (either instance or group)
    Node.prototype.getComponent = function() {
        var element = this.father;
        while (element.type !== Element.GROUP && element.type !== Element.INSTANCE) {
            element = element.father;
            if (element === null) {
                break;
            }
        }

        return element;
    };

    return Node;
})();
