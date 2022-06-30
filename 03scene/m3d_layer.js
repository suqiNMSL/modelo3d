//
// m3d_layer.js
// The layer in the scene
//
//  

export default (function() {
    "use strict";
    
    function Layer(name, index, color, visible) {
        this.index   = index;   // the index of layer in the scene
        this.name    = name;
        this.color   = vec3.clone(color);
        this.visible = visible;
        this.drawables   = [];
    };

    Layer.prototype.destroy = function() {
        this.drawables = null;
        delete this.drawables;

        this.color = null;
        delete this.color;

        this.name = null;
        delete this.name;
    };

    Layer.prototype.setVisible = function(visible) {
        for (var i = 0, len = this.drawables.length; i < len; i++) {
            this.drawables[i].visible = visible;
        }
        this.visible = visible;
        
        return true;
    };

    return Layer;
})();
    
