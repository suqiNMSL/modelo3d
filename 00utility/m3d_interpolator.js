//
// m3d_interpolator.js
// Util functions for  interpolating two values.
//
//  

export default (function() {
    "use strict";

    var Interpolator = {};
    
    Interpolator.linear = {};
    
    Interpolator.linear.vec3 = function(out, start, end, ratio) {
        var r0 = 1.0 - ratio;
        out[0] = r0 * start[0] + ratio * end[0];
        out[1] = r0 * start[1] + ratio * end[1];
        out[2] = r0 * start[2] + ratio * end[2];
    };
    
    Interpolator.linear.scalar = function(start, end, ratio) {
        return (1.0 - ratio) * start + ratio * end;
    };
    
    Interpolator.cubic = {};

    Interpolator.cubic.vec3 = function(out, start, end, ratio) {
        ratio = 3.0 * ratio * ratio - 2.0 * ratio * ratio * ratio;
        var r0 = 1.0 - ratio;

        out[0] = r0 * start[0] + ratio * end[0];
        out[1] = r0 * start[1] + ratio * end[1];
        out[2] = r0 * start[2] + ratio * end[2];
    };
    
    Interpolator.cubic.scalar = function(out, start, end, ratio) {
        ratio = 3.0 * ratio * ratio - 2.0 * ratio * ratio * ratio;
        var r0 = 1.0 - ratio;

        return r0 * start + ratio * end;
    };
    
    return Interpolator;
})();
