//
// m3d_load_mesh.js
// Load the meshes of scene
//
//  
//


import Globals            from "../../m3d_globals.js";
import Error              from "../../m3d_errors.js";
import MeshAttributes     from "../../02resource/m3d_mesh_attribute.js";
import ShaderLibrary      from "../../02resource/m3d_shader_library.js"
import Drawable           from "../../03scene/drawables/m3d_drawable.js";
import Element            from "../../03scene/graph/m3d_element.js";
import Node               from "../../03scene/graph/m3d_node.js";
import Billboard          from "../../03scene/drawables/m3d_billboard.js";
import LoadMeshSync       from "./m3d_load_mesh_sync.js";
import LoadMeshSyncFast   from "./m3d_load_mesh_syncfast.js";


export default (function() {
    "use strict";

    function MeshLoader(sceneObject, renderer, resourceManager) {
        this._sceneObject           = sceneObject;
        this._resourceManager       = resourceManager;
        this._renderer              = renderer;
        this._$q                    = Globals.frontendCallbacks.getPromiseLibrary();
        this._worker                = null;
        this._maxVertexNumber       = 65536; //Globals.isMobile? 65536 : 2500000; // make each mesh object has at most 64MB large
        this._memoryBudget          = 0; // in bytes
        this._memoryWarning         = false;
        this._done                  = 0;
        this._deferred              = null;
        this._attributesData        = null;
        this._sceneData             = null;
        this._version               = 0;
    };

    MeshLoader.prototype.destroy = function() {
        delete this._sceneData;
        delete this._worker;
    };

    MeshLoader.prototype.load = function(modelPromises, sceneData, progressTracker) {
        var promises = [];
        
        this._sceneData = sceneData;

        var versionDigits = sceneData.version.split(".");
        this._version = parseInt(versionDigits[0]) * 10000 +
                        parseInt(versionDigits[1]) * 100 +
                        parseInt(versionDigits[2]);
        
        // Fill the attributes
        var attributesData = {};
        var i, len;
        for (var attr in sceneData.attributes) {
            
            attributesData[attr] = new MeshAttributes();;

            var primitive = null;
            if (sceneData.attributes[attr].primitive === "point") {
                primitive = gl.POINTS;
            } else if (sceneData.attributes[attr].primitive === "line") {
                primitive = gl.LINES;
            } else if (sceneData.attributes[attr].primitive === "triangle") {
                primitive = gl.TRIANGLES;
            }

            // FIXME: in order to reuse old code, we still insert primitive
            // into the attributes class.
            attributesData[attr].primitive = primitive;

            var positionType = null;
            var normalType   = null;
            var uvType       = null;
            var colorType    = null;

            for (i = 0, len = sceneData.attributes[attr].values.length; i < len; i++) {
                if (sceneData.attributes[attr].values[i] === "POSITION") {
                    positionType = gl.FLOAT;
                } else if (sceneData.attributes[attr].values[i] === "NORMAL") {
                    normalType = gl.BYTE;
                } else if (sceneData.attributes[attr].values[i] === "TEXCOORD_0") {
                    uvType = gl.FLOAT;
                } else if (sceneData.attributes[attr].values[i] === "COLOR") {
                    colorType = gl.UNSIGNED_BYTE;
                }
            }

            attributesData[attr].builtin(positionType, normalType, uvType, colorType);
        }

        this._attributesData = attributesData;

        // Download meshXXX.bin one by one.
        // Execute $q promises sequentially, http://www.codeducky.org/q-serial/
        var that = this;
        this._loadWorker().then(function() {
                
            if (that._syncLoading) {
                that._worker.initialize();
            } else {
                var compressed = (that._version >= 408);
                var parameters = {
                    "memoryBudget":     that._memoryBudget,
                    "littleEndian":     Globals.littleEndian,
                    "compressed":       compressed,
                    "maxVertexNumber":  that._maxVertexNumber,
                    "attributesData":   that._attributesData,
                    "sceneData":        that._sceneData,
                    "version":          that._version
                };
                that._worker.postMessage(parameters);
            }

            var bufferData = sceneData.buffers[0];
            var prev = that._loadMesh(bufferData.uri, bufferData.byteLength, sceneData, 
                attributesData, modelPromises[bufferData.uri], progressTracker);
            for (i = 1, len = sceneData.buffers.length; i < len; i++) {
                prev = function(index) {
                    return prev.then(function() { 
                        var bufferData = sceneData.buffers[index];
                        return that._loadMesh(bufferData.uri, bufferData.byteLength, sceneData, 
                            attributesData, modelPromises[bufferData.uri], progressTracker);
                    });
                }(i);
            }
        });

        this._deferred = this._$q.defer();
        return this._deferred.promise;
    };
    
    MeshLoader.prototype._loadWorker = function() {
        var that = this;

        // Can't use synchronous loading for .mx < 0.5.6 because synchronous loading
        // does not handle the .mx version changes between 0.4.3 and 0.5.5.
        if (this._version < 506) {
            this._syncLoading = false;

            modelo3d.debug(".mx version: " + this._version + ". Call m3d_load_mesh.worker.");
            var workerFilepath = "/assets/js/m3d_load_mesh.worker.js";

            if (window.cordova) {
                return Globals.frontendCallbacks.downloadWebWorkerCordova(workerFilepath)
                    .then(function(worker) {
                        that._worker = worker;
                        that._worker.onmessage = that.onmessage.bind(that);
                    });
            } else {
                this._worker = new Worker(workerFilepath + "?t=" + Globals.cacheBuster);
                this._worker.onmessage = this.onmessage.bind(that);
            }
        } else {
            this._syncLoading = true;
            var fastLoading = this._sceneData.merge > 0 ? true : false;
            if (fastLoading) {
                modelo3d.debug(".mx version: " + this._version + ". Call LoadMeshSyncFast().");
                this._worker = new LoadMeshSyncFast(that._sceneData, that._attributesData, this); 
            } else {
                modelo3d.debug(".mx version: " + this._version + ". Call LoadMeshSync().");
                this._worker = new LoadMeshSync(that._sceneData, that._attributesData, 
                        that._maxVertexNumber, that._memoryBudget, this);
            }
        }
                
        return this._$q.resolve("");
    };
    
    MeshLoader.prototype._destroyWorker = function() {
        this._worker.terminate();
        this._worker = null;
    };

    MeshLoader.prototype._loadMesh = function(meshName, meshLength, sceneData, attributesData, promise, progressTracker) {
        var that = this;
        var dataLoaded = 0;
                
        if (!this._syncLoading) {
            var parameters = {
                "meshBinaryName": meshName
            };
            this._worker.postMessage(parameters);
        }
        
        var onprogress = progressTracker.getSingleFileProgress();
                        
        // Load meshes
        return promise.downloadFile().then(function(res) {
                if (res.data.byteLength !== meshLength) {
                    Error.error = Error.ERROR_ARRAY_BUFFER_WRONG_LENGTH;
                    throw Error.error;
                    return ;
                }
                if (that._syncLoading) {
                    that._worker.load(meshName, res.data);
                } else {
                    var parameters = {
                        "meshBinary": res.data 
                    };
                    that._worker.postMessage(parameters, [parameters.meshBinary]);
                }
            }, null, function(eventData) {
                onprogress(eventData.loaded);
            }
        );
    };
    
    // Callbacks for sync.
    MeshLoader.prototype.onNodeDataReady = function(nodeInfo) {
        var meshObject = this._createMeshObject(nodeInfo);

        if (meshObject) {
            var shaderObject = this._createShaderObject(nodeInfo);

            var materialObject = this._createMaterialObject(nodeInfo, shaderObject);
            if (materialObject) {
                this._createDrawableObject(nodeInfo, meshObject, shaderObject, materialObject);
            }
        } else {
            // It is most likely GPU mem is used, we should return the control
            // to browser to trigger context-lost event callback.
            Error.error = Error.ERROR_INSUFFICIENT_RESOURCE;
            this._deferred.reject(Error.error);
        }
    };

    MeshLoader.prototype.onMeshBinaryProcessed = function() {
        this._done++;
        if (this._done === this._sceneData.buffers.length) {
            this._worker.uninitialize();
            this._deferred.resolve();
        }
    };
    
    // Callbacks for worker
    MeshLoader.prototype.onmessage = function(parameters) {
        var that = this;

        var data = parameters.data;
        if (data.finished) {
            var index = parseInt(data.meshBinaryName.split(".")[0].substr(4));
            this._done++;

            // All meshXXX.bin are processed, we can terminate the mesh loader here.
            if (this._done === this._sceneData.buffers.length) {
                this._destroyWorker();
                this._deferred.resolve();
            }
        } else {
            for (var i = 0, len = data.nodes.length; i < len; i++) {
                var nodeInfo = data.nodes[i];
                
                var attributes = this._attributesData[nodeInfo.attribute];

                var meshObject = this._createMeshObject(nodeInfo, data.meshBinary);

                if (meshObject) {
                    var shaderObject = this._createShaderObject(nodeInfo);
                    var materialObject = this._createMaterialObject(nodeInfo, shaderObject);
                    if (materialObject) {
                        this._createDrawableObject(nodeInfo, meshObject, shaderObject, materialObject);
                    }
                } else {
                    // It is most likely GPU mem is used, we should return the control
                    // to browser to trigger context-lost event callback.
                    deferred.reject();

                    this._destroyWorker();

                    Error.error = Error.ERROR_INSUFFICIENT_RESOURCE;
                    this._deferred.reject(Error.error);

                    break;
                }
            }

            // GC
            data = null;
            delete parameters.data;
        }
    };

    MeshLoader.prototype._createMeshObject = function(nodeInfo, meshBinary) {
        var meshObject = this._resourceManager.getMesh(nodeInfo.mesh);
        if (!meshObject.ready) {
            var indexTypes = [
                gl.UNSIGNED_BYTE,
                gl.UNSIGNED_BYTE,
                gl.UNSIGNED_SHORT,
                gl.UNSIGNED_SHORT,
                gl.UNSIGNED_INT,
            ];

            var meshBinary = nodeInfo.meshBinary || meshBinary;
            var vertices = new Uint8Array(meshBinary, nodeInfo.verticesOffset, nodeInfo.verticesBytes);
            var indices  = new Uint8Array(meshBinary, nodeInfo.indicesOffset, nodeInfo.indicesBytes);

            var attributes = this._attributesData[nodeInfo.attribute]; 
            meshObject.create(attributes.primitive, attributes,
                    vertices, indices, indexTypes[nodeInfo.indexType]);
            if (!meshObject.ready) {
                meshObject.destroy();
                console.warn("failed to create mesh object '" + nodeInfo.mesh + "'.");
                return null;
            } 
        } 

        return meshObject;
    };

    MeshLoader.prototype._createDrawableObject = function(nodeInfo, meshObject, shaderObject, materialObject) {
        // Create the drawable object.
        var layerObject = this._sceneObject.getLayerByName(nodeInfo.layer);

        var attributes = this._attributesData[nodeInfo.attribute]; 
        
        var drawableObject; 
        if (nodeInfo.billboard) {
            drawableObject = new Billboard(nodeInfo.name, 
                    meshObject,
                    layerObject,
                    shaderObject,
                    materialObject,
                    nodeInfo.transform, 
                    nodeInfo.bbox);
        } else {
            drawableObject = new Drawable(nodeInfo.name, 
                    meshObject,
                    layerObject,
                    shaderObject,
                    materialObject,
                    nodeInfo.transform, 
                    nodeInfo.bbox);
        }

        // Add drawable object to view.
        var visible = (nodeInfo.views.length === 0) && layerObject.visible;
        for (var i = 0, len = nodeInfo.views.length; i < len; ++i) {
            var viewName = nodeInfo.views[i];
            this._sceneObject.views[viewName].drawables.push(drawableObject);

            // Check if the drawable is seen by the default view.
            if (viewName === this._sceneData.scene.defaultView) {
                visible = true;
            }
        }
        
        drawableObject.visible = visible;

        if (visible) {
            this._renderer.addModelDrawable(drawableObject);
        }

        this._sceneObject.model.drawables.push(drawableObject);
        // The drawables that use the same material. It is a helper data
        // structure for change material.
        drawableObject.material.drawables.push(drawableObject);
        drawableObject.layer.drawables.push(drawableObject);                

        var id = this._sceneObject.model.drawables.length;
        var element = new Node(id);
        drawableObject.nodes.push(element);
        element.drawable = drawableObject;
        element.indicesOffset = 0;
        element.indicesCount = drawableObject.mesh.length;

        return drawableObject;
    };
    
    MeshLoader.prototype._createMaterialObject = function(nodeInfo, shaderObject) {
        var materialData = this._sceneData.materials[nodeInfo.material];
        var attributes = this._attributesData[nodeInfo.attribute]; 

        var materialName = nodeInfo.layer + "_" + nodeInfo.material;
        var materialObject = this._sceneObject.materialManager.getMaterial(nodeInfo.material);

        if (!materialObject) {
            materialObject = this._sceneObject.materialManager.createMaterialAdhoc(materialName);
            materialObject.attachShader(shaderObject);

            // Set material properties.
            materialObject.setDiffuse(materialData.values["diffuse"]);
            materialObject.setTransparent(materialData.values["transparent"]);
            if (materialData.values["diffuseTexture"]) {
                var textureName = materialData.values["diffuseTexture"];
                var textureData = this._sceneData.textures[textureName];

                // compatible old version converter files
                // TODO: the version number needs to be calibrated with converter-mx
                if (textureData.format === "rgba") {
                    // We use alpha test to cull masked pixels
                    materialObject.transparent = true;
                } else {
                    if (textureData.uri.split(".")[1] !== "png" && materialData.values["transparent"] > 0.8) {
                        // A quick fix for the situation at which material has jpg texture and transparent less than 1.
                        // In most cases, model authors just accidentally set a transparent value that he is not aware.
                        materialObject.transparent = false;
                    }
                }
                var textureObject = this._resourceManager.getTexture(textureName);
                materialObject.setDiffuseTexture(textureObject);
            }
        }

        return materialObject;
    };
    
    MeshLoader.prototype._createShaderObject = function(nodeInfo) {
        var materialData = this._sceneData.materials[nodeInfo.material];
        var attributes = this._attributesData[nodeInfo.attribute]; 

        var shaderType = "solid";
        if (attributes.primitive === gl.LINES) {
            shaderType = "plain";
        } else if (attributes.hasColor) {
            shaderType = "color";
        } else if (materialData.values.diffuseTexture) {
            shaderType = "texture";
        }

        if (nodeInfo.layer.match(/glass/i) && !materialData.values.diffuseTexture) {
            shaderType = "glass";
        }

        // Textured objects are always opaque and their transparent pixels
        // will be culled using alpha testing.
        var transparency = (materialData.values["transparent"] < 0.99 && 
                            !materialData.values["diffuseTexture"]);
        
        var flags = [];

        if (nodeInfo.transform || nodeInfo.billboard) {
            flags.push("MODEL_TRANSFORM");
        }
        if (this._sceneObject.needRenderDoubleSided() && !transparency && !nodeInfo.billboard) {   
            flags.push("DOUBLESIDED");
        }
        if (this._renderer.isShadowEnabled() && !transparency && !nodeInfo.billboard) {
            flags.push("SHADOW");
        }
        if (this._renderer.isSectionEnabled()) {
            flags.push("CLIPPING");
        }
        var shaderObject = this._resourceManager.getShader(shaderType, flags);
        if (!shaderObject.ready) {
            var shaderSource = ShaderLibrary[shaderType];
            shaderObject.createFromShaderSource(shaderSource, flags);
            if (!shaderObject.ready) {
                throw("modelo3d error at creating shader '" + shaderType + "'!");
            }
        }

        return shaderObject;
    };

    return MeshLoader;
})();
    
