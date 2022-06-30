//
// m3d_plugin_manager.js
// The base class of plugin
//
//  


export default (function() {
    "use strict";

    function PluginManager(resourceManager) {
        // private:
        this._plugins         = [];
        this._pluginUrls      = [];
        this._pluginNumber    = 0;
        this._isDuplicated    = false;      //if plugin has
        this._resourceManager = resourceManager;

        // public:
        //

        // initialize:
    };
    
    PluginManager.prototype.destroy = function() {
        this.unloadPlugins();
    };
    
    // Register a plugin
    // id is a DOM id
    // jsurl is the URL of javascript 
    PluginManager.prototype.loadPlugin  = function(jsurl) {

        this._isDuplicated = true;
        // Check if the plugin has been loaded already
        for (var i = 0; i < this._pluginUrls.length; i++) {
            if (this._pluginUrls[i] === jsurl) {
                console.warning(jsurl + " is already loaded.");
                this._isDuplicated = false ;
            } else {
                this._pluginUrls.push(jsurl);
            }
        }

        this._loadJS(jsurl, null);
    };
    
    PluginManager.prototype.register = function(obj) {
        if (!this._isDuplicated) {
            return;
        }
        
        this._plugins.push(obj);
        this._plugins[this._pluginNumber].initialize(this._resourceManager);
        this._pluginNumber++;
    };
    
    // Unregister a specific plugin
    PluginManager.prototype.unloadPlugin = function(jsurl) {
        /*
        if (this._plugins[jsurl]) {
            this._plugins[jsurl].destroy();
        
            var drawableHead = document.getElementsByTagName('head')[0];
            drawableHead.removeChild(this._plugins[plugin].$elem);
            
            delete this._plugins[jsurl];
            this._pluginNumber--;
        }*/
    };

    // Unregister all plugins
    PluginManager.prototype.unloadPlugins = function() {
        /*
        var drawableHead = document.getElementsByTagName('head')[0];
        for (var plugin in this._plugins) {
            this._plugins[plugin].destroy();
            drawableHead.removeChild(this._plugins[plugin].$elem);
        }
        this._plugins = {};
        this._pluginNumber = 0;
        */
    };
    
    // Update callback
    PluginManager.prototype.update = function() {
        var updated = null;

        for (var i = 0; i < this._plugins.length; i++) {
            updated += this._plugins[i].update();
            updated = 1.0;
        }
        return updated;
    };
    
    // Load plugin JS
    PluginManager.prototype._loadJS = function(jsurl, callback) {
        var drawableHead = document.getElementsByTagName('head')[0];
        var drawableScript = document.createElement('script');
        drawableScript.setAttribute('type', 'text/javascript');
        drawableScript.setAttribute('src', jsurl);
        if (callback != null) {
            drawableScript.onload = drawableScript.onreadystatechange = function(){
                if (drawableScript.ready) {
                    return false;
                }
                if (!drawableScript.readyState || drawableScript.readyState == "loaded" || drawableScript.readyState == 'complete') {
                    drawableScript.ready = true;
                    callback($(drawableScript));
                }
            };
        }
        drawableHead.appendChild(drawableScript);
    };

    return PluginManager;
})();

