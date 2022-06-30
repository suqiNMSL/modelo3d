//
// m3d_globals.js
// The global variables
//
//  


export default (function() {
    "use strict";

    var globals = {};

    globals.version           = "2.5.0";
    globals.width             = 1;
    globals.height            = 1;
    globals.isMobile          = false;
    globals.devicePixelRatio  = 1.0;
    globals.littleEndian      = true;
    globals.gpuMemory         = 256; // in MB
    globals.frame             = 0; // the current frame ID
    globals.browserName       = "";
    globals.browserVersion    = "";
    globals.bim               = false; // If BIM information exists
    globals.state             = modelo3d.UNINITIALIZED; // the state of the application.

    // DO NOT REMOVE OR CHANGE STRING "CACHE_BUSTER_HOOK"
    // Used by build step to bust cache for shaders and web workers.
    globals.cacheBuster       = "CACHE_BUSTER_HOOK";
    globals.ASSET_PATH        = "/model/modelo3d/assets/";
    globals.frontendCallbacks = null;

    //
    // Configurations
    //
    globals.discardRestore    = true; // Whether discard and restore resource during tab switches
    globals.webvr             = false;
    globals.syncLoading       = true;
    globals.profiling         = false; // Turn on culling profiling and other rendering stats
    globals.compressScene     = false; // Compress the scene geometry
    globals.maxInstances      = 1000; // The maximum instanced draw.
    
    return globals;
})();

