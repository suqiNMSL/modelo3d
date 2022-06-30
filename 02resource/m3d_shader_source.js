//
// m3d_shader_source.js
// Keep the shader sources
//
//  

import Utils        from "../00utility/m3d_utils.js";
import ShaderChunks from "./m3d_shader_chunks.js";

export default (function() {
    "use strict";
    function ShaderSource(name, vsFiles, fsFiles, options) {
        // private:

        // public:
        this.name     = name;
        this.vsSource = null;
        this.fsSource = null;
        this.ready    = false;

        var vsSource = "";
        var i, len;
        if (Utils.isArray(vsFiles)) {
            for (i = 0, len = vsFiles.length; i < len; ++i) {
                if (ShaderChunks[vsFiles[i]]) {
                    vsSource += ShaderChunks[vsFiles[i]];
                } else {
                    // It is a code snippet.
                    vsSource += vsFiles[i];
                }
            }
        } else {
            if (ShaderChunks[vsFiles]) {
                vsSource += ShaderChunks[vsFiles];
            } else {
                // It is a code snippet.
                vsSource += vsFiles;
            }
        }
        var fsSource = "";
        if (Utils.isArray(fsFiles)) {
            for (i = 0, len = fsFiles.length; i < len; ++i) {
                if (ShaderChunks[fsFiles[i]]) {
                    fsSource += ShaderChunks[fsFiles[i]];
                } else {
                    // It is a code snippet.
                    fsSource += fsFiles[i];
                }
            }
        } else {
            if (ShaderChunks[fsFiles]) {
                fsSource += ShaderChunks[fsFiles];
            } else {
                // It is a code snippet.
                fsSource += fsFiles;
            }
        }

        this._precompile(vsSource, fsSource, options);
    };
    
    ShaderSource.prototype.destroy = function() {
        if (this.ready) {
            this.vsSource = null;
            this.fsSource = null;

            this.ready = false;
        }
    };

    // Generate the source codes using precompiling.
    ShaderSource.prototype._precompile = function(vsSource, fsSource, options) {
        if (this.ready) {
            return ;
        }

        try {
            this.vsSource = this._dissolve(vsSource, true, options);
            this.fsSource = this._dissolve(fsSource, false, options);
        } catch (e) {
            console.warn(e);
            return;
        }

        this.ready = true;
    };

    ShaderSource.prototype._dissolve = function(source, isVS, options) {

        var header = "";
        
        // add version code
        header += "#if WEBGL2 \n" +
                  "#version 300 es \n" +
                  "#endif \n";

        if (options.highPrecision) {
            header += "precision highp float;\n" +
                      "precision highp sampler2D;\n";
        } else {
            header += "precision mediump float;\n" +
                      "precision mediump sampler2D;\n";
        }

        // Vertex attributes
        if (isVS) {
            if (options.viewMatrix || options.vpMatrix || options.projectionMatrix || options.mvpMatrix) {
                header += "#if WEBGL2 \n" +
                          "uniform m_bPerFrame { \n" +
                          "    mat4 viewMatrix;\n" +
                          "    mat4 vpMatrix;\n" +
                          "    vec4 cameraPosition;\n"+ 
                          "} m_uPerFrame; \n" +
                          "#else \n" +
                          "struct PerFrameStruct {\n";
                if (options.viewMatrix) {
                    header += "    mat4 viewMatrix;\n";
                }
                if (options.vpMatrix) {
                    header += "    mat4 vpMatrix;\n";
                }
                header += "    vec4 cameraPosition;\n" +
                          "};\n" + 
                          "uniform PerFrameStruct m_uPerFrame; \n" +
                          "#endif \n";
            }
            if (options.modelMatrix) {
                header += "#if WEBGL2 && MODEL_TRANSFORM\n" +
                          "uniform m_bPerNode { \n" +
                          "    mat4 modelMatrix;\n" +
                          "} m_uPerNode; \n" +
                          "#endif\n" +
                          "#if !WEBGL2 && MODEL_TRANSFORM\n" +
                          "struct PerNodeStruct {\n" +
                          "    mat4 modelMatrix;\n" +
                          "};\n" +
                          "uniform PerNodeStruct m_uPerNode;\n" +
                          "#endif\n";
            }
            if (options.vertexid) {
                header += "uniform int m_uBaseVertexOffset; \n";
            }
        } else {
            if (options.viewMatrix || options.vpMatrix || options.projectionMatrix || options.mvpMatrix) {
                header += "#if WEBGL2 \n" +
                          "uniform m_bPerFrame { \n" +
                          "    mat4 viewMatrix;\n" +
                          "    mat4 vpMatrix;\n" +
                          "    vec4 cameraPosition;\n"+ 
                          "} m_uPerFrame; \n" +
                          "#else \n" +
                          "struct PerFrameStruct {\n";
                if (options.viewMatrix) {
                    header += "    mat4 viewMatrix;\n";
                }
                if (options.vpMatrix) {
                    header += "    mat4 vpMatrix;\n";
                }
                header += "    vec4 cameraPosition;\n" + 
                          "};\n" + 
                          "uniform PerFrameStruct m_uPerFrame; \n" +
                          "#endif \n";
            }
        }
        
        var body = "";
        
        // Include headers
        var lines = source.split("\n");
        var pattern = /<([\w\d\.]+)>/g;
        for (var i = 0, len = lines.length; i < len; i++) {
            var line = lines[i]; 
            if (line.match(/#include/g)) {
                var matched = line.match(pattern);
                if (matched) {
                    var included = matched[0].substring(1, matched[0].length - 1);
                    if (included === "varying.inc") {
                        if (isVS && options.normal) {
                            body += "    m_vNormal = normal.xyz; \n";
                        }
                        if (isVS && options.position) {
                            body += "    m_vVertex = worldPosition.xyz; \n";
                        }
                        if (isVS && options.uv) {
                            body += "    m_vTexCoord = uv; \n";
                        }
                        if (isVS && options.vertexid) {
                            body += "    int objectID = gl_VertexID + m_uBaseVertexOffset; \n";
                            body += "    m_vId = vec4( \n";
                            body += "    float(objectID & 0xFF) / 255.0,  \n";
                            body += "    float((objectID >> 8) & 0xFF) / 255.0,  \n";
                            body += "    float((objectID >> 16) & 0xFF) / 255.0,  \n";
                            body += "    float((objectID >> 24) & 0xFF) / 255.0); \n";
                        }
                        if (isVS && options.color) {
                            body += "    m_vColor = m_aColor; \n";
                        }
                        if (isVS && options.material) { // depth in camera space.
                            body += "    m_vMaterial = m_aMaterial;\n";
                        }
                        if (isVS && options.depth) { // depth in camera space.
                            body += "m_vDepth = (m_uPerFrame.viewMatrix * worldPosition).z;\n";
                        }
                    } else {
                        body += ShaderChunks[included];
                    }
                } else {
                    throw new Error('Can not resolve #include <' + included + '>');
                }
            } else {
                body += line + "\n";
            }
        }

        // Unroll loops
        pattern = /for \( int i \= (\d+)\; i < (\d+)\; i \+\+ \) \{([\s\S]+?)(?=\})\}/g;
        function replace(match, start, end, snippet) {
            var unroll = '';
            for (i = parseInt(start); i < parseInt(end); i++) {
                unroll += snippet.replace(/\[i\]/g, '[' + i + ']' );
            }
            return unroll;
        }

        body = body.replace(pattern, replace);

        return header + body;
    };
    
    return ShaderSource;
})();


