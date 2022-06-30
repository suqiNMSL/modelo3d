//
// m3d_material_pbs.js
// The material of physically based shading
//
//  

import Material      from "./m3d_material.js";
import MaterialAdhoc from "./m3d_material_adhoc.js";


export default (function() {
    "use strict";

    function MaterialPbs(name) {
        // Inheritance
        MaterialAdhoc.apply(this, arguments);
    };
    
    // MaterialPbs inherits Material
    MaterialPbs.prototype = Object.create(Material.prototype);
    MaterialPbs.prototype.constructor = MaterialPbs;
    
    //MaterialPbs.prototype.attachShader = function(shader) {
    //    if (!shader || !shader.ready) {
    //        return;
    //    }
    //    
    //    MaterialAdhoc.prototype.attachShader.apply(this, arguments);

    //    // In MaterialAdhoc we set roughness default value to > 1, and
    //    // in PBS, it should be something between 0 and 1.
    //    if (this.reservedParameters["m_uMaterial.values"].value[4] > 1) {
    //        this.reservedParameters["m_uMaterial.values"].value[4] = 0.5;
    //    }
    //};

    //MaterialPbs.prototype.setMetallic = function(metallic) {
    //    this.reservedParameters["m_uMaterial.values"].value[5] = metallic;
    //};

    //MaterialPbs.prototype.getMetallic = function() {
    //    return this.reservedParameters["m_uMaterial.values"].values[5];
    //};

    return MaterialPbs;
})();

