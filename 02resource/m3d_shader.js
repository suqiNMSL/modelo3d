//
// m3d_shader.js
// The shader (gl.program) wrapper
//
//  

import Utils from "../00utility/m3d_utils.js";

export default (function() {
    "use strict";

    function _UniformObject(loc) {
        this.loc    = loc;
        this.upload = null;
    }

    var blockData = null;
                    
    // Initialize uniform block
    _UniformObject.prototype.initialize = function(name, program) {
        this.uniforms      = {};
            
        var uniformLocation = gl.getUniformBlockIndex(program, name);
        gl.uniformBlockBinding(program, uniformLocation, this.loc);
        
        var blockSize = gl.getActiveUniformBlockParameter(program, uniformLocation, gl.UNIFORM_BLOCK_DATA_SIZE);

        this.blockSize = 0;
        var uniformIndices = gl.getActiveUniformBlockParameter(program, uniformLocation, gl.UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES);
        for (var i = 0, len = uniformIndices.length; i < len; i++) {
            var uniform = gl.getActiveUniform(program, uniformIndices[i]);

            var uniformName = uniform.name.replace(/[_\w]+./, '');
            this.uniforms[uniformName] = { type: uniform.type, size: uniform.size };

            switch (uniform.type) {
                case gl.INT: 
                case gl.FLOAT: 
                    this.blockSize += 4 * uniform.size;
                    break;    
                case gl.INT_VEC2: 
                case gl.FLOAT_VEC2: 
                    this.blockSize += 8 * uniform.size;
                    break;    
                case gl.INT_VEC3: 
                case gl.FLOAT_VEC3: 
                    this.blockSize += 12 * uniform.size;
                    break;    
                case gl.INT_VEC4: 
                case gl.FLOAT_VEC4: 
                    this.blockSize += 16 * uniform.size;
                    break;    
                case gl.FLOAT_MAT4: 
                    this.blockSize += 64 * uniform.size;
                    break;    
                case gl.FLOAT_MAT3: 
                    this.blockSize += 48 * uniform.size;
                    break;    
            }
        }

        if (this.blockSize !== blockSize) {
            console.warn("uniform block " + name + " has packing problem!");
        }

        if (gl.isWebGL2) {
            this.blockBuffer   = null;
            this.blockBuffer = gl.createBuffer();
            gl.bindBuffer(gl.UNIFORM_BUFFER, this.blockBuffer);
            blockData = new Float32Array(this.blockSize);
            gl.bufferData(gl.UNIFORM_BUFFER, blockData, gl.DYNAMIC_DRAW);
            gl.bindBuffer(gl.UNIFORM_BUFFER, null);
        }
    };
    
    _UniformObject.prototype.destroy = function() {
        this.uniforms = null;
        delete this.uniforms;
    };
                        
    function UniformUpload1fv(val) { 
        gl.uniform1fv(this.loc, val); 
    };
    function UniformUpload1f(val) { 
        gl.uniform1f(this.loc, val); 
    };
    function UniformUpload2f(val) { 
        gl.uniform2fv(this.loc, val); 
    };
    function UniformUpload3f(val) { 
        gl.uniform3fv(this.loc, val); 
    };
    function UniformUpload4f(val) { 
        gl.uniform4fv(this.loc, val); 
    };
    function UniformUpload1b(val) { 
        gl.uniform1i(this.loc, val? 1 : 0); 
    };
    function UniformUpload1i(val) { 
        gl.uniform1i(this.loc, val); 
    };
    function UniformUpload2i(val) { 
        gl.uniform2i(this.loc, val[0], val[1]); 
    };
    function UniformUpload3i(val) { 
        gl.uniform3i(this.loc, val[0], val[1], val[2]); 
    };
    function UniformUpload4i(val) { 
        gl.uniform4i(this.loc, val[0], val[1], val[2], val[3]); 
    };
    function UniformUploadMat4(val) { 
        gl.uniformMatrix4fv(this.loc, false, val); 
    };
    function UniformUploadMat3(val) { 
        gl.uniformMatrix3fv(this.loc, false, val); 
    };
    function UniformBlockUpload(buffer) {
        gl.bindBufferBase(gl.UNIFORM_BUFFER, this.loc, this.blockBuffer);
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.blockBuffer);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, buffer, 0, buffer.byteLength / 4);
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    };

    function Shader(name, resourceManager) {
        // private:
        this._program   = null;
        this._manager   = resourceManager;

        // public:
        this.name             = name;
        this.ready            = false;
        this.reservedUniforms = {};
        this.userUniforms     = {};
        this.shaderSource     = null; // Available when this shader is created from ShaderSource
        this.flags            = []; // Compiling flags
        this.attributes       = {}; // The vertex attributes
    };
        
    Shader.prototype.destroy = function() {
        if (this.ready) {
            for (var i = 0, len = this.reservedUniforms.length; i < len; i++) {
                this.reservedUniforms[i].destroy();
            }
            this.reservedUniforms = null;
            delete this.reservedUniforms;

            for (var i = 0, len = this.userUniforms.length; i < len; i++) {
                this.userUniforms[i].destroy();
            }
            this.userUniforms = null;
            delete this.userUniforms;

            this.shaderSource = null;
            delete this.shaderSource;

            this.attributes = null;
            delete this.attributes;

            gl.deleteProgram(this._program);
            delete this._program;

            this.ready = false;
        
            var err;
            if ((err = gl.getError()) !== gl.NO_ERROR) {
                console.log("GL error in shader.destroy(): " + err);
            }
        }
        if (this._manager) {
            delete this._manager._shaders[this.name];
            this._manager = null;
        }

        //modelo3d.debug("shader %s is destroyed.", this.name);
    }; 
    
    Shader.prototype.createFromSource = function(vsSource, fsSource, flags) {
        if (this.ready) {
            return;
        }
        
        if (flags) {
            this.flags = flags.slice(0);
        } else {
            this.flags = [];
        }

        var vsSource1 = this._preprocess(vsSource, flags);
        var fsSource1 = this._preprocess(fsSource, flags);

        this._compile(vsSource1, fsSource1);    
    };
    
    Shader.prototype._preprocess = function(str, flags) {
        var includeLines = [true];
        var includeLine = true;

        var lines = str.split("\n");
        var outputLines = [];
        var i, j, len, len1, defines, reversed;
        for (i = 0, len = lines.length; i < len; i++) {
            var line = lines[i];
            if (line === "") {
                continue;
            }

            if (line[0] === "#" && line[1] !== "v" ) {
                if (line[1] === "i" && line[2] === "f") {
                    includeLine = true;

                    var defineStr = line.substr(4).replace(/^\s+|\s+$/g, '');
                    defines = null;
                    if (defineStr.indexOf('||') !== -1) {
                        defines = defineStr.split("||");
                        includeLine = false;
                        for (j = 0, len1 = defines.length; j < len1; j++) {
                            var define = defines[j].replace(/^\s+|\s+$/g, '');
                        
                            reversed = false;
                            if (define[0] === '!') {
                                reversed = true;
                                define = define.substring(1);
                            }

                            if (Utils.indexOf(flags, define) !== -1) {
                                includeLine = !reversed;
                            }
                        }
                    } else if (defineStr.indexOf('&&') !== -1) {
                        defines = defineStr.split("&&");
                        includeLine = true;
                        for (j = 0, len1 = defines.length; j < len1; j++) {
                            define = defines[j].replace(/^\s+|\s+$/g, '');
                            
                            if (define[0] === '!') {
                                define = define.substring(1);
                            
                                if (Utils.indexOf(flags, define) !== -1) {
                                    includeLine = false;
                                    break;
                                } 
                            } else {
                                if (Utils.indexOf(flags, define) === -1) {
                                    includeLine = false;
                                    break;
                                }
                            }
                        }
                    } else {
                        reversed = false;
                        if (defineStr[0] === '!') {
                            reversed = true;
                            defineStr = defineStr.substring(1);
                        }
                        if (Utils.indexOf(flags, defineStr) !== -1) {
                            // When the macro is defined and it is not a NOT.
                            includeLine = !reversed;
                        } else {
                            includeLine = reversed;
                        }                            
                    }                                                

                    includeLines.push(includeLine);

                } else if (line[1] === "e" && line[2] === "l" &&
                           line[3] === "s" && line[4] === "e") {
                    includeLines[includeLines.length - 1] = !includeLines[includeLines.length - 1];
                } else if (line[1] === "e" && line[2] === "n" &&
                           line[3] === "d" && line[4] === "i" &&
                           line[5] === "f") {

                    includeLines.pop();
                }

                // AND operator of includeLines
                includeLine = true;
                for (j = 0, len1 = includeLines.length; j < len1; ++j) {
                    includeLine = includeLines[j] && includeLine;
                    if (!includeLine) {
                        break;
                    }
                }
            } else {
                if (includeLine) {
                    outputLines.push(line);
                }
            }
        }
        return outputLines.join("\n");
    };

    Shader.prototype.createFromShaderSource = function(shaderSource, flags) {
        if (this.ready) {
            return;
        }

        flags = flags || [];
        if (gl.isWebGL2) {
            if (_.indexOf(flags, "WEBGL2") === -1) { 
                flags.push("WEBGL2");
            }
        }
        //console.log(shaderSource.name + (flags? "_" + flags.join('_') : ""));
        //
        this.shaderSource = shaderSource;
        if (this.shaderSource.ready) {
            this.createFromSource(shaderSource.vsSource, shaderSource.fsSource, flags);
        } else {
            console.warn(name + "'s source is not ready");
        }
    };

    Shader.prototype._compile = function(vsSource, fsSource) {
        if (this.ready) {
            return;
        }
        this.ready = false;

        if (this._program) {
            gl.deleteProgram(this._program);
        }
        this._program = gl.createProgram();

        var vsShader = gl.createShader(gl.VERTEX_SHADER);
        var fsShader = gl.createShader(gl.FRAGMENT_SHADER);

        gl.shaderSource(vsShader, vsSource);
        gl.compileShader(vsShader);

        gl.shaderSource(fsShader, fsSource);
        gl.compileShader(fsShader);

        if (!gl.getShaderParameter(vsShader, gl.COMPILE_STATUS)) {
            var msg = "failed to compile vertex shader " + this.name + "\n\n" + 
                    gl.getShaderInfoLog(vsShader);
            console.log(vsSource);
            console.error(msg);

            gl.deleteProgram(this._program);
            gl.deleteShader(vsShader);

            return;
        }

        if (!gl.getShaderParameter(fsShader, gl.COMPILE_STATUS)) {
            var msg = "failed to compile fragment shader " + this.name + "\n\n" + 
                    gl.getShaderInfoLog(fsShader);
            console.log(fsSource);
            console.error(msg);

            gl.deleteProgram(this._program);
            gl.deleteShader(fsShader);

            return ;
        }

        gl.attachShader(this._program, vsShader);
        gl.attachShader(this._program, fsShader);

        // Specify the built-in attribute locations.
        gl.bindAttribLocation(this._program, 0, "m_aPosition");
        gl.bindAttribLocation(this._program, 1, "m_aNormal0");
        gl.bindAttribLocation(this._program, 2, "m_aNormal1");
        gl.bindAttribLocation(this._program, 3, "m_aNormal2");
        gl.bindAttribLocation(this._program, 4, "m_aTexCoord");
        gl.bindAttribLocation(this._program, 5, "m_aColor");
        gl.bindAttribLocation(this._program, 6, "m_aMaterial");
        gl.bindAttribLocation(this._program, 7, "m_aModelMatrix");

        // Linking
        gl.linkProgram(this._program);

        gl.deleteShader(vsShader);
        gl.deleteShader(fsShader);

        if (gl.getError() === gl.NO_ERROR) {
            var linkStatus = gl.getProgramParameter(this._program, gl.LINK_STATUS);
            if (!linkStatus) {
                var msg = gl.getProgramInfoLog(this._program);
                console.log("%s linking error:\n" + msg, this.name);
                gl.deleteProgram(this._program);

                return ;
            }

            this.ready = true;
        } else {
            gl.deleteProgram(this._program);
            return;
        }
        

        // Fetch the vertex attribute indices.
        var numAttribs = gl.getProgramParameter(this._program, gl.ACTIVE_ATTRIBUTES);
        var i;
        for (i = 0; i < numAttribs; ++i) {
            var attrib = gl.getActiveAttrib(this._program, i);
            this.attributes[attrib.name] = i;
        }
        
        // Fetch uniforms from the shader program.
        var numUniforms = gl.getProgramParameter(this._program, gl.ACTIVE_UNIFORMS);
        for (i = 0; i < numUniforms; ++i) {
            var uniform = gl.getActiveUniform(this._program, i);
            var loc = gl.getUniformLocation(this._program, uniform.name);
            var uniformObject = new _UniformObject(loc);
            if (uniform.name[0] === 'm' && uniform.name[1] === '_') {
                if (loc === null && gl.isWebGL2) {
                    // Very likely it is uniform block.
                    continue;
                } else {
                    this.reservedUniforms[uniform.name] = uniformObject;
                }
            } else {
                this.userUniforms[uniform.name] = uniformObject;
            }

            switch (uniform.type) {
                case gl.FLOAT: 
                    if (uniform.size > 1) {
                        uniformObject.upload = UniformUpload1fv;
                    } else {
                        uniformObject.upload = UniformUpload1f;
                    }
                    break;    
                case gl.FLOAT_VEC2: 
                    uniformObject.upload = UniformUpload2f;
                    break;    
                case gl.FLOAT_VEC3: 
                    uniformObject.upload = UniformUpload3f;
                    break;    
                case gl.FLOAT_VEC4: 
                    uniformObject.upload = UniformUpload4f;
                    break;    
                case gl.BOOL: 
                     uniformObject.upload = UniformUpload1b;
                    break;
                case gl.INT: 
                case gl.SAMPLER_2D:
                case gl.SAMPLER_CUBE: 
                    uniformObject.upload = UniformUpload1i;
                    break;
                case gl.INT_VEC2: 
                case gl.BOOL_VEC2: 
                    uniformObject.upload = UniformUpload2i;
                    break;    
                case gl.INT_VEC3: 
                case gl.BOOL_VEC3: 
                    uniformObject.upload = UniformUpload3i;
                    break;    
                case gl.INT_VEC4: 
                case gl.BOOL_VEC4: 
                    uniformObject.upload = UniformUpload4i;
                    break;    
                case gl.FLOAT_MAT4: 
                    uniformObject.upload = UniformUploadMat4;
                    break;    
                case gl.FLOAT_MAT3: 
                    uniformObject.upload = UniformUploadMat3;
                    break;    
                default:
                    console.error("unsupported shader uniform type for " + uniform.name);
                    break;
            }
        }
        
        // Fetch uniforms from the shader program.
        if (gl.isWebGL2) {
            var numUniformBlocks = gl.getProgramParameter(this._program, gl.ACTIVE_UNIFORM_BLOCKS);
            for (var i = 0; i < numUniformBlocks; i++) {
                var blockName = gl.getActiveUniformBlockName(this._program, i);

                var uniformBlock;
                if (blockName[0] === 'm' && blockName[1] === '_') {
                    // Sincwe CPU refers to block name while GPU refers to instance name, and these two
                    // names can't be the same in shader, we rename one of them to make it consistent.
                    uniformBlock = new _UniformObject(i);
                    uniformBlock.initialize(blockName, this._program);
                    uniformBlock.upload = UniformBlockUpload;

                    blockName = blockName.replace(/m_b/, "m_u");
                    this.reservedUniforms[blockName] = uniformBlock;
                } else {
                    uniformBlock = new _UniformObject(i);
                    uniformBlock.initialize(blockName, this._program);
                    uniformBlock.upload = UniformBlockUpload;

                    this.userUniforms[blockName] = uniformBlock;
                }
            }
        }

        //modelo3d.debug("shader %s is created.", this.name);
    }; 

    Shader.prototype.use = function() {
        if (!this.ready) {
            console.error("shader " + this.name + " is not ready.");
            return;
        }
        gl.useProgram(this._program);
    }; 

    return Shader;
})();
    
