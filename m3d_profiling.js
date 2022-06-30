//
// m3d_profiling.debug.js
// Collect profiling information
//
//  


export default (function() {
    "use strict";

    var profiling = {
        fps                               : 0,
        // Low level GL profiling stats
        numDrawCallsPerFrame              : 0,
        numDrawPrimitivesPerFrame         : 0,
        numShaderStateChangesPerFrame     : 0,
        numUniformSyncPerFrame            : 0,
        numDepthStateChangePerFrame       : 0,
        numTextureStateChangePerFrame     : 0,
        numFramebufferStateChangePerFrame : 0,
        numOtherStateChangePerFrame       : 0,
        numClearPerFrame                  : 0,

        textureKBytes    : 0,
        textureCount     : 0,
        meshKBytes       : 0,
        meshCount        : 0,
        framebufferCount : 0,
        shaderCount      : 0,

        // high-level rendering stats. Numbers of
        // vertices drawn in each frame
        numDrawOpaquesPerFrame      : 0,
        numDrawLinesPerFrame        : 0,
        numDrawMaskedsPerFrame      : 0,
        numDrawTransparentsPerFrame : 0,

        numInteriorsPrimitives      : 0,
        numInteriorFixedsPrimitives : 0,
        numExteriorsPrimitives      : 0,
        numSurroundingsPrimitives   : 0,
                    
        // Culling profiling
        numClippingCulledVertices : 0,
        numBimCulledVertices : 0,
        numFrustumCulledVertices : 0,
        numZeroAreaCulledVertices : 0,
    };
       
    var round = function round(val) {
        var str = val + "";
        return str.substring(0, 4);
    };
    var round2 = function round2(val) {
        return Math.round((val * 100) / 100);
    };

    profiling.toString = function() {
        var ret = 
            "FPS:                   " + round(this.fps) + "<br>" + 
            "#drawcalls:            " + this.numDrawCallsPerFrame + "<br>" +
            "#shader switches:      " + this.numShaderStateChangesPerFrame + "<br>" +
            "#primitives:           " + this.numDrawPrimitivesPerFrame + "<br>" +
            "#uniform sync:         " + this.numUniformSyncPerFrame + "<br>" +
            "#texture switches:     " + this.numTextureStateChangePerFrame + "<br>" +
            "#framebuffer switches: " + this.numFramebufferStateChangePerFrame + "<br>" +
            "#depth state changes:  " + this.numDepthStateChangePerFrame + "<br>" +
            "#other state changes:  " + this.numOtherStateChangePerFrame + "<br>" +
            "#clear:                " + this.numClearPerFrame + "<br>" +
            "<br>" +
            "texture memory (Kb):" + round2(this.textureKBytes) + "<br>" +
            "texture number:     " + round2(this.textureCount) + "<br>" +
            "mesh memory (Kb):   " + round2(this.meshKBytes) + "<br>" +
            "mesh number:        " + round2(this.meshCount) + "<br>" +
            "framebuffer number: " + round2(this.framebufferCount) + "<br>" +
            "shader number:      " + round2(this.shaderCount) + "<br>" +
            "<br>" +
            "opaques:       " + this.numDrawOpaquesPerFrame + "<br>" +
            "transparents:  " + this.numDrawTransparentsPerFrame + "<br>" +
            "maskeds:       " + this.numDrawMaskedsPerFrame + "<br>" +
            "lines:         " + this.numDrawLinesPerFrame + "<br>" +
            "<br>" +
            "clipping culled:       " + this.numClippingCulledVertices + "<br>" +
            "bim culled:            " + this.numBimCulledVertices + "<br>" +
            "zeroarea culled:       " + this.numZeroAreaCulledVertices + "<br>" +
            "frustum culled:        " + this.numFrustumCulledVertices + "<br>" +
            "<br>" +
            "<div style='background:green'>sourroundings:       " + this.numSurroundingsPrimitives+ "</div>" +
            "<div style='background:blue'>interiors:           " + this.numInteriorsPrimitives+ "</div>" +
            "<div style='background:yellow'>interiors-fixed:     " + this.numInteriorFixedsPrimitives+ "</div>" +
            "<div style='background:red'>exteriors:           " + this.numExteriorsPrimitives + "</div>";

        return ret;
    };


    return profiling;
})();
