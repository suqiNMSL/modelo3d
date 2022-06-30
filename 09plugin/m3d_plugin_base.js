//
// m3d_plugin_base.js
// The base class of plugin
//
//  


export default (function() {
    "use strict";

    function Plugin(url, $elem) {
        // private:
        //

        // public:
        this.url       = url;     // The URL of plugin JS source
        this.$elem     = $elem;   // The DOM element of this JS script
        this.exclusive = false;   // If this plugin will push other plugins out.
        this.enabled   = false;   // Enabled or not.

    };
    
    // Init callback
    Plugin.prototype.initialize = function(resourceManager) {
    };
    
    // Uninit callback
    Plugin.prototype.destroy = function() {
    };
    
    // Update callback
    Plugin.prototype.update = function() {
        
        return 0.0;
    };

    // Enable/disable
    Plugin.prototype.setEnabled = function(enabled) {
        if (this.enabled !== enabled) {
            this.enabled = enabled;
        }
    };

    return Plugin;
})();


