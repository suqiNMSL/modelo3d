//
// m3d_utils.js
// Utilities
//
//  

export default (function() {
    "use strict";

    var Utils = {};

    Utils.isArray = function(obj) {
        return Object.prototype.toString.call(obj) === '[object Array]';
    };

    Utils.indexOf = function (arr, elem) {
        if (!Utils.isArray(arr)) {
            console.error("Not an array!");
            return -1;
        }

        for (var i = 0, len = arr.length; i < len; ++i) {
            if (arr[i] === elem) {
                return i;
            }
        }

        return -1;
    };

    return Utils;
})();
    

