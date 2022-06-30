//
// m3d_canvas.release.js
// The canvas which contains a rendering context and a number
// of gizmos
//
//  


import Globals       from "./m3d_globals.js";
import Utils         from "./00utility/m3d_utils.js";
import SetupWebGL    from "./01wrapper/m3d_wgl.release.js";
import SkyBox        from "./03scene/drawables/m3d_skybox.js";
import Canvas360     from "./m3d_canvas_360.js";
import Canvas        from "./m3d_canvas.js";

export default (function() {
    "use strict";
    
    Canvas.prototype._setupWebGL = function(isMobile, browserName, browserVersion) {
        // TODO: enable WebGL2 for webvr Globals.webvr 
        var useWebGL2 = false;

        var useVAO = true;
        if (browserName === "chrome" && browserVersion === "62") {
            // We have disable VAO for this buggy Chrome version
            useVAO = false;
        }
        
        // gl is defined in global name space.
        gl = SetupWebGL(this.canvas, {
            depth                 : true,
            alpha                 : false,   // disable the blend with DOM behind canvas
            //premultipliedalpha  : false,
            antialias             : true,
            stencil               : false,
            preserveDrawingBuffer : true,
            vao                   : useVAO,
            instancing            : false,
            webgl2                : useWebGL2
        });
        
        if (gl !== null) {
            var glversion = gl.isWebGL2? "2.0" : "1.0";

            console.group("A WebGL " + glversion + " context created");
            console.log("  color: RGBA, depth: enabled, stencil: disabled");
            console.log("  VAO: " + (useVAO? "enabled" : "disabled"));
            console.log("  Instancing: " + (gl.instancingExtension? "enabled" : "disabled"));
            console.groupEnd("A WebGL " + glversion + " context created");
        }
    };

    Canvas.prototype._initializeDebug = function() {
    };
    
    Canvas.prototype._loadDebug = function() {
    };
    
    Canvas.prototype._renderDebug = function() {
    };
    
    Canvas360.prototype._setupWebGL = function(isMobile, browserName, browserVersion) {
        // TODO: enable WebGL2 for webvr Globals.webvr 
        var useWebGL2 = false;

        var useVAO = true;
        if (browserName === "chrome" && browserVersion === "62") {
            // We have disable VAO for this buggy Chrome version
            useVAO = false;
        }
        
        // gl is defined in global name space.
        gl = SetupWebGL(this.canvas, {
            depth                 : true,
            alpha                 : false,   // disable the blend with DOM behind canvas
            antialias             : true,
            stencil               : false,
            preserveDrawingBuffer : true,
            vao                   : useVAO,
            webgl2                : useWebGL2
        });
    };

    modelo3d.debug = function() {
    };

    modelo3d.SKYBOX_WALLPAPER       = SkyBox.SKYBOX_WALLPAPER;
    modelo3d.SKYBOX_WALLPAPER_TILED = SkyBox.SKYBOX_WALLPAPER_TILED;
    modelo3d.SKYBOX_SKYDOME         = SkyBox.SKYBOX_EQUIRECTANGLE;
    
    modelo3d.UNINITIALIZED = 0;
    modelo3d.LOADING       = 1;
    modelo3d.RENDERING     = 2;

    return Canvas;
})();
