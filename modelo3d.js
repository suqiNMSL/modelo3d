//
// modelo3d.js
// modelo3d library wrapper
//
// Copyright Modelo XX - 2017, All rights reserved.


var modelo3d = {};

// Make the GL context globally for easy access.
var gl = null;

(function() {
    'use strict';

    modelo3d.isSupportWebGL = function(doc) {
        var canvas = doc.createElement("canvas");
        var canvasContext = WebGLUtils.setupWebGL(canvas, {webgl2 : false});
        
        if (!canvasContext) {
            return false;
        } else {
            return true;
        }
    };

    modelo3d.isSupportWebGL2 = function(doc) {
        var canvas = doc.createElement("canvas");
        var canvasContext = WebGLUtils.setupWebGL(canvas, {webgl2 : true});
        
        if (!canvasContext) {
            return false;
        } 
        
        var version = canvasContext.getParameter(canvasContext.VERSION);
        return (version.match("WebGL 2.0") !== null);
    };

})();
