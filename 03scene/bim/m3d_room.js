//
// m3d_room.js
// A room
//
//  

import Utils  from "../../00utility/m3d_utils.js";
import Math   from "../../00utility/m3d_math.js";
import Drawable   from "../drawables/m3d_drawable.js";

export default (function() {
    "use strict";
    
    function Room(name, id, position, bbox, area, mesh, shader, material) {

        Drawable.apply(this, [name, mesh, null, shader, material, null, bbox]);

        this._id       = id;     // the room number
        this._position = position;
        this._area     = area;

        // Initialize
        var s = Math.aabb.size(this.bbox);
        this.transform._setScaling(s.width * 0.5, s.height * 0.5, s.depth * 0.5);
        var p = Math.aabb.center(this.bbox);
        this.transform._setTranslation(p[0], p[1], p[2]);

        this.isShadowReceiver = false;
    };
    
    Room.prototype = Object.create(Drawable.prototype);
    Room.prototype.constructor = Room;

    Room.prototype.destroy = function() {
        delete this._name;
        delete this._id;
        delete this._position;
        delete this._bbox;
        delete this._area;
    };

    Room.prototype.isShadowCaster = function() {
        return false;
    };

    return Room;
})();
    

