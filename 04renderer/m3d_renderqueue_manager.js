//
// m3d_render_queue_manager.js
// The drawables list for rendering resource manager 
//
//  
import RenderQueue from "./m3d_renderqueue.js";

export default (function() {
    "use strict";

    var RenderQueueManager = {
        queues : {}
    };

    RenderQueueManager.getQueue = function(selector) {
        var name = "";
        if (!selector) {
            name = "default";
        } else {
            name += selector.line         === undefined ? ""  : selector.line         ? "_Line_"          : "_Not_Line_";
            name += selector.texture      === undefined ? ""  : selector.texture      ? "_Texture_"       : "_Not_Texture_";
            name += selector.mask         === undefined ? ""  : selector.mask         ? "_Mask_"          : "_Not_Mask_";
            name += selector.transparent  === undefined ? ""  : selector.transparent  ? "_Transparent_"   : "_Not_Transparent_";
            name += selector.shadowCaster === undefined ? ""  : selector.shadowCaster ? "_ShadowCaster_"  : "_Not_ShadowCaster_";
        }

        if (!RenderQueueManager.queues[name]) {
            RenderQueueManager.queues[name] = new RenderQueue(name, selector);
        }
        return RenderQueueManager.queues[name];
    };
 
    return RenderQueueManager;
})();
    
