//
// m3d_material.js
// The material base class
//
//  


export default (function() {
    "use strict";

    function MaterialParameter() {
        this.upload  = null;
        this.value   = null;
        this.texUnit = 0;     // only valid when value is a texture
    };

    MaterialParameter.prototype.uploadTexture = function(uniform) {
        // FIXME: this is a hotfix for value undefined
        if (this.value) {
            this.value.use(this.texUnit);
        }
        uniform.upload(this.texUnit);
    };

    MaterialParameter.prototype.uploadValue = function(uniform) {
        uniform.upload(this.value);
    };
    
    return MaterialParameter;
})();
