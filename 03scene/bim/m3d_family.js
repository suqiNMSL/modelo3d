//
// m3d_family.js
// A family
//
//  

export default (function() {
    "use strict";
    
    function Family(name) {
        this.name = name;
        this.bim = {};         // BIM information about this family
        this.elements = [];    // The elements of this family
    };

    Family.prototype.destroy = function() {
        delete this.name;
        delete this.bim;
        delete this.elements;
    };
    
    return Family;
})();
