//
// m3d_hwinfo.js
// Detect the RAM and other hardware information.
//
//  
//

export default (function() {
    "use strict";

    function HWInfo() {
        // public:
        this.vramSize      = 0;    // RAM size in MB
        this.littleEndian  = true; // bit order

        // Initialize
        var uaparse = new UAParser();
        var uainfo  = uaparse.getResult();
        var type =  (uainfo.device.model || "").toLowerCase();

        this.browserName    = (uainfo.browser && uainfo.browser.name || "").toLowerCase();
        this.browserVersion = (uainfo.browser && uainfo.browser.major || "").toLowerCase();

        switch (type) {
            case "iphone":
                // Since on iOS, CPU mem and GPU mem share the same
                // piece of RAM. Its total available memory left
                // for Safari is only a few hundreds MBs.
                this.vramSize = 1024;  // 1GB 
                break;
            case "ipad":
                this.vramSize = 2048; // 2GB
                break;
            default:
                this.vramSize = 3072; // 3GB
                break;
        }
    };

    return HWInfo;
})();
    
