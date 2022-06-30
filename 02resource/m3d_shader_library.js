//
// m3d_shader_libraries.js
// shader library
//
//  

import ShaderSource from "./m3d_shader_source.js";

export default (function() {
    "use strict";

    var ShaderLibrary = {};

    ShaderLibrary["blit"] = new ShaderSource("blit", 
            "blit.vs", ["blit.fs", "blit_simple.inc"], 
            {
                "highPrecision" : true,
                "position"      : true,
                "uv"            : true
            });

    ShaderLibrary["accumulate"] = new ShaderSource("accumulate", 
            "blit.vs", ["blit.fs", "blit_accumulate.inc"], 
            {
                "highPrecision" : true,
                "position"      : true,
                "uv"            : true
            });
    ShaderLibrary["normaldepth"] = new ShaderSource("normaldepth", 
            ["main.vs", "modelo_main.vs", "transform_simple.inc"], ["main.fs", "normaldepth_main.fs"], 
            {
                "highPrecision" : true,
                "vpMatrix"      : true,
                "viewMatrix"    : true,
                "modelMatrix"   : true,
                "position"      : true,
                "normal"        : true,
                "depth"         : true,
                "uv"            : true
            });
    ShaderLibrary["solid"] = new ShaderSource("solid", 
            ["main.vs", "modelo_main.vs", "transform_simple.inc"], ["main.fs", "modelo_main.fs", "material_solid.inc", "shade_adhoc.inc"], 
            {
                "highPrecision" : true,
                "vpMatrix"      : true,
                "modelMatrix"   : true,
                "position"      : true,
                "normal"        : true,
                "uv"            : true
            });
    ShaderLibrary["mark"] = new ShaderSource("mark", 
            ["main.vs", "modelo_main.vs", "transform_mark.inc"], ["main.fs", "mark_main.fs"], 
            {
                "highPrecision" : true,
                "vpMatrix"      : true,
                "vertexid"      : true
            });
    ShaderLibrary["color"] = new ShaderSource("color", 
            ["main.vs", "modelo_main.vs", "transform_simple.inc"], ["main.fs", "modelo_main.fs", "material_color.inc", "shade_adhoc.inc"], 
            {
                "highPrecision" : true,
                "vpMatrix"      : true,
                "modelMatrix"   : true,
                "position"      : true,
                "normal"        : true,
                "color"         : true
            });
    ShaderLibrary["texture"] = new ShaderSource("texture", 
            ["main.vs", "modelo_main.vs", "transform_simple.inc"], ["main.fs", "modelo_main.fs", "material_texture.inc", "shade_adhoc.inc"], 
            {
                "highPrecision" : true,
                "vpMatrix"      : true,
                "modelMatrix"   : true,
                "position"      : true,
                "normal"        : true,
                "uv"            : true
            });

    ShaderLibrary["glass"] = new ShaderSource("glass", 
            ["main.vs", "modelo_main.vs", "transform_simple.inc"], ["main.fs", "modelo_main.fs", "material_solid.inc", "shade_glass.inc"], 
            {
                "highPrecision" : true,
                "vpMatrix"      : true,
                "modelMatrix"   : true,
                "position"      : true,
                "normal"        : true
            });
    ShaderLibrary["plain"] = new ShaderSource("plain",
            ["main.vs", "modelo_main.vs", "transform_nonormal.inc"], ["main.fs", "modelo_main.fs", "material_solid.inc", "shade_nolight.inc"], 
            {
                "highPrecision" : true,
                "vpMatrix"      : true,
                "modelMatrix"   : true,
                "position"      : true
            });
    ShaderLibrary["plain_texture"] = new ShaderSource("plain_texture",
            ["main.vs", "modelo_main.vs", "transform_nonormal.inc"], ["main.fs", "modelo_main.fs", "material_texture.inc", "shade_direct.inc"], 
            {
                "highPrecision" : true,
                "vpMatrix"      : true,
                "modelMatrix"   : true,
                "position"      : true,
                "uv"            : true
            });
    ShaderLibrary["constant"] = new ShaderSource("constant",
            ["main.vs", "modelo_main.vs", "transform_nonormal.inc"], ["main.fs", "modelo_main.fs", "material_solid.inc", "shade_direct.inc"], 
            {
                "highPrecision" : true,
                "vpMatrix"      : true,
                "modelMatrix"   : true,
                "position"      : true
            });
    ShaderLibrary["constant2d"] = new ShaderSource("constant2d",
            "blit.vs", "blit_direct.fs", 
            {
                "highPrecision" : true,
                "position"      : true
            });
    
    ShaderLibrary["skybox"] = new ShaderSource("skybox",
            ["main.vs", "modelo_main.vs", "transform_skybox.inc"], ["main.fs", "modelo_main.fs", "material_skybox.inc", "shade_direct.inc"], 
            {
                "highPrecision" : true,
                "vpMatrix"      : true,
                "modelMatrix"   : true,
                "uv"            : true
            }); 
    ShaderLibrary["oit_accum"] = new ShaderSource("oit_accum", 
            ["main.vs", "modelo_main.vs", "transform_simple.inc"], ["main.fs", "modelo_main.fs", "material_solid.inc", "shade_oit_accum.inc"], 
            {
                "highPrecision" : true,
                "vpMatrix"      : true,
                "viewMatrix"    : true,
                "modelMatrix"   : true,
                "position"      : true,
                "normal"        : true,
                "depth"         : true
            });
    ShaderLibrary["oit_reveal"] = new ShaderSource("oit_reveal", 
            ["main.vs", "modelo_main.vs", "transform_simple.inc"], ["main.fs", "modelo_main.fs", "material_solid.inc", "shade_oit_reveal.inc"], 
            {
                "highPrecision" : true,
                "vpMatrix"      : true,
                "viewMatrix"    : true,
                "modelMatrix"   : true,
                "position"      : true,
                "normal"        : true,
                "depth"         : true
            });
    
    ShaderLibrary["ssao"] = new ShaderSource("ssao",
            "blit.vs", ["blit.fs", "blit_ssao2.inc"], 
            {
                "highPrecision" : true
            }); 

    ShaderLibrary["shadowsmooth"] = new ShaderSource("shadowsmooth",
            "blit.vs", ["blit.fs", "blit_shadow.inc"], 
            {
                "highPrecision" : true,
                "position"      : true,
                "uv"            : true
            }); 
    
    ShaderLibrary["sketch"] = new ShaderSource("sketch",
            "blit.vs", ["blit.fs", "blit_sketch.inc"], 
            {
                "highPrecision" : true,
                "position"      : true,
                "uv"            : true
            }); 

    ShaderLibrary["contour"] = new ShaderSource("contour",
            "blit.vs", ["blit.fs", "blit_contour.inc"], 
            {
                "highPrecision" : true,
                "position"      : true,
                "uv"            : true
            }); 
    ShaderLibrary["contouroverlay"] = new ShaderSource("contouroverlay",
            "blit.vs", ["blit.fs", "blit_contour_overlay.inc"], 
            {
                "highPrecision" : true,
                "position"      : true,
                "uv"            : true
            }); 
    ShaderLibrary["oit"] = new ShaderSource("oit",
            "blit.vs", ["blit.fs", "blit_oit.inc"], 
            {
                "highPrecision" : true,
                "position"      : true,
                "uv"            : true
            }); 
            
    ShaderLibrary["vr_wrap"] = new ShaderSource("vr_wrap",
            "blit.vs", ["blit.fs", "blit_vr_wrap.inc"], 
            {
                "highPrecision" : true,
                "position"      : true,
                "uv"            : true
            }); 

    return ShaderLibrary;
})();

