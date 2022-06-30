//
// m3d_load_mesh.js
// Load the meshes of scene
//
//  
//


import Globals               from "../../m3d_globals.js";
import profiling             from "../../m3d_profiling.js";
import Error                 from "../../m3d_errors.js";
import MeshAttributes        from "../../02resource/m3d_mesh_attribute.js";
import ShaderLibrary         from "../../02resource/m3d_shader_library.js"
import Drawable              from "../../03scene/drawables/m3d_drawable.js";
import DrawableInstanced     from "../../03scene/drawables/m3d_drawable_instanced.js";
import Element               from "../../03scene/graph/m3d_element.js";
import Node                  from "../../03scene/graph/m3d_node.js";
import Billboard             from "../../03scene/drawables/m3d_billboard.js";
import LoadMisc              from "../m3d_load_misc.js";
import LoadMeshSync          from "./m3d_load_mesh_sync.js";
import LoadMeshSyncFast      from "./m3d_load_mesh_sync_fast.js";
import LoadMeshSyncInstanced from "./m3d_load_mesh_sync_instanced.js";


export default (function() {
    "use strict";

    function MeshLoader(sceneObject, renderer, resourceManager) {
        this._sceneObject           = sceneObject;
        this._resourceManager       = resourceManager;
        this._renderer              = renderer;

        this._worker                = null;
        this._memoryBudget          = 0; // in bytes

        this._attributes            = null;
        this._sceneJson             = null;
        this._sceneBin              = null;

        // Create a temporary buffer for mesh compression.
        if (sceneObject.compressed) {
            this._compressedAttributes = {};
            this._compressedVertices = new ArrayBuffer(80000 * 32);
        }
    };

    MeshLoader.prototype.destroy = function() {

        this._sceneJson = null;
        delete this._sceneJson;

        this._sceneBin = null;
        delete this._sceneBin;

        this._sceneObject = null;
        delete this._sceneObject;

        this._renderer = null;
        delete this._renderer;

        this._attributes = null;
        delete this._attributes;

        this._worker.destroy();
        this._worker = null;
        delete this._worker;

        this._compressedVertices = null;
        delete this._compressedVertices;
    };

    MeshLoader.prototype.load = function(modelPromises, sceneJson, sceneBin, progressTracker) {
        this._sceneJson = sceneJson;
        this._sceneBin  = sceneBin;
        
        // Fill the attributes
        var attributes = new Array(sceneJson.attributes.length);
        var primitives = [
            gl.POINTS,
            gl.LINES,
            gl.LINES,
            gl.LINES,
            gl.TRIANGLES,
        ];
        var types = [
            gl.BYTE,
            gl.UNSIGNED_BYTE,
            gl.SHORT,
            gl.UNSIGNED_SHORT,
            gl.INT,
            gl.UNSIGNED_INT,
            0, // gl.FLOAT16,
            gl.FLOAT,
            0 //gl.DOUBLE,
        ];
        for (var i = 0, len = sceneJson.attributes.length; i < len; i++) {
            attributes[i] = new MeshAttributes();

            var attributeName = sceneJson.attributes[i];
            var attributeData = sceneBin.readAttribute(i);

            // FIXME: in order to reuse old code, we still insert primitive
            // into the attributes class.
            attributes[i].primitive = primitives[attributeData[0]];

            var normalType   = attributeData[1] >= 0? types[attributeData[1]] : null;
            var uvType       = attributeData[2] >= 0? types[attributeData[2]] : null;
            var colorType    = attributeData[3] >= 0? types[attributeData[3]] : null;

            attributes[i].builtin(gl.FLOAT, normalType, uvType, colorType);
        }

        this._attributes = attributes;

        // Download meshXXX.bin one by one.
        // Execute $q promises sequentially, http://www.codeducky.org/q-serial/
        if (sceneJson.fastload) {
            modelo3d.debug("Fast loading...");
            this._worker = new LoadMeshSyncFast(sceneJson, sceneBin, this._attributes); 
        } else if (/*sceneJson.scene.meshKbytes > 200000 && */gl.instancingExtension) { // > 200MB
            modelo3d.debug("Instancing loading...");
            this._worker = new LoadMeshSyncInstanced(sceneJson, sceneBin, this._attributes,
                    this._memoryBudget);
        } else {
            modelo3d.debug("Normal loading...");
            this._worker = new LoadMeshSync(this._resourceManager, sceneJson, sceneBin, this._attributes,
                    this._sceneObject.compressed);
        }

        var that = this;
        var prev = that._loadMesh(0, modelPromises["mesh0.bin"], progressTracker);
        for (i = 1, len = sceneJson.buffers.length; i < len; i++) {
            prev = function(index) {
                return prev.then(function() { 
                    var meshBufferName = "mesh" + index.toString() + ".bin";
                    return that._loadMesh(index, modelPromises[meshBufferName], progressTracker);
                });
            }(i);
        }

        return prev;
    };
    
    MeshLoader.prototype._loadMesh = function(meshBufferIndex, promise, progressTracker) {
        var that = this;

        var onprogress = progressTracker.getSingleFileProgress();

        // We run initialization of worker and downloading file at the same time.
        this._worker.initialize();
        // Load mesh buffer binary
        return promise.downloadFile().then(function(res) {
                if (res.data.byteLength !== that._sceneJson.buffers[meshBufferIndex].byteLength) {
                    Error.error = Error.ERROR_ARRAY_BUFFER_WRONG_LENGTH;
                    throw Error.error;
                    return ;
                }

                if (Globals.state !== modelo3d.UNINITIALIZED) {
                    that._worker.load(meshBufferIndex, res.data, MeshLoader.prototype.onNodeDataReady.bind(that));
                }
            }, null, function(eventData) {
                onprogress(eventData.loaded);
            });
    };
    
    MeshLoader.prototype.onNodeDataReady = function(nodeInfo, vertexBuffer, indexBuffer, vertices, indices, nodesInfo) {
        var shaderObject = this._createShaderObject(nodeInfo);
        if (shaderObject) {
            var materialObject = this._createMaterialObject(nodeInfo, shaderObject);
            if (materialObject) {
                var meshObject = this._createMeshObject(nodeInfo, vertices, indices, vertexBuffer, indexBuffer);
                if (meshObject) {
                    //debugger;
                    this._createDrawableObject(nodeInfo, meshObject, shaderObject, materialObject, nodesInfo);
                } else {
                    // It is most likely GPU mem is used up, we should return the control
                    // to browser to trigger context-lost event callback.
                    Error.error = Error.ERROR_INSUFFICIENT_RESOURCE;
                    throw Error.error;
                }
            }
        }
    };
    
    
    MeshLoader.prototype._createMeshObject = function(nodeInfo, vertices, indices, vertexBuffer, indexBuffer) {
        var meshObject = this._resourceManager.getMesh(nodeInfo.mesh >= 0? nodeInfo.mesh.toString() : -nodeInfo.index.toString());
        if (!meshObject.ready) {
            var indexTypes = [
                gl.UNSIGNED_BYTE,
                gl.UNSIGNED_BYTE,
                gl.UNSIGNED_SHORT,
                gl.UNSIGNED_SHORT,
                gl.UNSIGNED_INT,
            ];

            var attributesIndex = nodeInfo.attribute;
            var attributes = this._attributes[attributesIndex];

            var attributes = attributes.clone();
            if (this._sceneObject.compressed) {
                attributes.compress();
            }
            for (var i = 0, len = attributes.values.length; i < len; i++) {
                attributes.values[i].offset += vertices.byteOffset;
            }
            
            meshObject.createShared(attributes.primitive, attributes, 
                vertices, indices, indexTypes[nodeInfo.indexType], vertexBuffer, indexBuffer);
        } 
        
        return meshObject;
    };
    
    var retTransform = new Float32Array(16);
    function ExtendTransform(transform) {
        retTransform[0] = transform[0];
        retTransform[1] = transform[1];
        retTransform[2] = transform[2];
        retTransform[3] = 0;

        retTransform[4] = transform[3];
        retTransform[5] = transform[4];
        retTransform[6] = transform[5];
        retTransform[7] = 0;

        retTransform[8] = transform[6];
        retTransform[9] = transform[7];
        retTransform[10] = transform[8];
        retTransform[11] = 0;

        retTransform[12] = transform[9];
        retTransform[13] = transform[10];
        retTransform[14] = transform[11];
        retTransform[15] = 1;

        return retTransform;
    };

    
    MeshLoader.prototype._createDrawableObject = function(nodeInfo, meshObject, shaderObject, materialObject) {
        // Create the drawable object.
        var layerObject = this._sceneObject.layers[nodeInfo.layer];

        var attributes = this._attributes[nodeInfo.attribute]; 

        if (nodeInfo.instanced && gl.instancingExtension) {
            var transformData = new Float32Array(nodeInfo.nodes.length * 16);
            
            for (var i = 0, len = nodeInfo.nodes.length; i < len; ++i) {
                var nodeData = nodeInfo.nodes[i];

                var offset = i * 16;
                var t = this._sceneBin.readNodeTransform(nodeData.index);
                transformData[offset + 0] = t[0];
                transformData[offset + 1] = t[1];
                transformData[offset + 2] = t[2];
                transformData[offset + 3] = 0;

                transformData[offset + 4] = t[3];
                transformData[offset + 5] = t[4];
                transformData[offset + 6] = t[5];
                transformData[offset + 7] = 0;

                transformData[offset + 8] = t[6];
                transformData[offset + 9] = t[7];
                transformData[offset + 10] = t[8];
                transformData[offset + 11] = 0;

                transformData[offset + 12] = t[9];
                transformData[offset + 13] = t[10];
                transformData[offset + 14] = t[11];
                transformData[offset + 15] = 1;
            }

            var meshBBoxData = this._sceneBin.readNodeBBox(nodeInfo.nodes[0].index);
            var bboxData = this._sceneBin.readNodeBBox(nodeInfo.index);
            var drawableObject = new DrawableInstanced(nodeInfo.index.toString(), 
                                               meshObject,
                                               layerObject,
                                               shaderObject,
                                               materialObject,
                                               transformData, 
                                               bboxData,
                                               meshBBoxData);
        } else {
            var transformData = null;
            if (!nodeInfo.identity) {
                transformData = ExtendTransform(this._sceneBin.readNodeTransform(nodeInfo.index));
            }
            var bboxData = this._sceneBin.readNodeBBox(nodeInfo.index);
            
            var drawableObject; 
            if (nodeInfo.billboard) {
                drawableObject = new Billboard(nodeInfo.index.toString(), 
                        meshObject,
                        layerObject,
                        shaderObject,
                        materialObject,
                        transformData, 
                        bboxData);
            } else {
                drawableObject = new Drawable(nodeInfo.index.toString(), 
                        meshObject,
                        layerObject,
                        shaderObject,
                        materialObject,
                        transformData, 
                        bboxData);
            }
        }
        
        layerObject.drawables.push(drawableObject);                

        // Add drawable object to view.
        var visible = (nodeInfo.views === "") && layerObject.visible;
        if (nodeInfo.views !== "") {
            var viewIndices = nodeInfo.views.split(".");
            for (var i = 0, len = viewIndices.length; i < len; ++i) {
                var viewName = this._sceneJson.views[viewIndices[i]].name;
                this._sceneObject.views[viewName].drawables.push(drawableObject);

                if (viewName === this._sceneJson.scene.defaultView) {
                    visible = true;
                }
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
        
        // Complete the node information and bind the drawable
        // drawable to its scene graph node.
        if (this._sceneJson.fastload) {
            var node = this._sceneObject.model.graph.nodes[nodeInfo.index];
            drawableObject.nodes.push(node);
            node.region = nodeInfo.region;
            node.drawable = drawableObject;
            node.originalMatarial = drawableObject.material.name;
            node.indicesOffset = 0;
            node.indicesCount = drawableObject.mesh.length;
            node.verticesBytes = nodeInfo.verticesBytes;
        } else {
            var region = Node.STRUCTURE;

            var maxVerticesBytes = 0;
            var nodeIndex = -1; // the node that nodeInfo points to.
            var sumVerticesBytes = 0;
            nodeInfo.nodes.push(nodeInfo);
            for (var i = 0, len = nodeInfo.nodes.length; i < len; i++) {
                var nodeData = nodeInfo.nodes[i];
                var drawableIndex = nodeData.index;
            
                var node = this._sceneObject.model.graph.nodes[drawableIndex];
                drawableObject.nodes.push(node);
                node.region = nodeData.region;
                node.drawable = drawableObject;
                if (nodeInfo.instanced) {
                    node.indicesOffset = i;
                    node.indicesCount = 1;
                } else {
                    node.indicesOffset = nodeData.drawOffset;
                    node.indicesCount = nodeData.drawCount;
                }
                
                if (node.indicesOffset == 0 && node.indicesCount == 0) {
                    node.indicesCount = nodeInfo.indicesBytes / meshObject.indexSize;
                }
                
                node.verticesBytes = nodeData.verticesBytes;

                if (maxVerticesBytes < nodeData.verticesBytes) {
                    maxVerticesBytes = nodeData.verticesBytes;
                    nodeIndex = i;
                }
                sumVerticesBytes += nodeData.verticesBytes;

                if (nodeData.region !== region) {
                    region = nodeData.region;
                    // We are looking for which elements can be hidable during rendering.
                    // FIXME: change the hidablility strength to other region.
                    if (region >= Node.STRUCTURE_INTERIOR  && drawableObject.hidables < 0) {
                        drawableObject.hidables = i;
                    }
                }
            }

            // When merging mesh, we already add all vertices bytes up and put it into 
            // nodeInfo object, here we need recover the original vertices bytes that element.
            drawableObject.nodes[nodeIndex].verticesBytes = maxVerticesBytes * 2 - sumVerticesBytes;

            // Since instanced drawable is a group of same kind of drawables, they should be either
            // culled or not in BIM culling.
            if (nodeInfo.instanced && gl.instancingExtension) {
                drawableObject.hidables = (nodeInfo.nodes[0].region >= Node.STRUCTURE_INTERIOR)? 0 : -1;
            }
        }

        return drawableObject;
    };
    
    var diffuse = [1.0, 1.0, 1.0];
    
    MeshLoader.prototype._createMaterialObject = function(nodeInfo, shaderObject) {

        var layerName = this._sceneJson.layers[nodeInfo.layer].name;
        var materialName = this._sceneJson.materials[nodeInfo.material];
        materialName = layerName + "." + materialName;
        var materialObject = this._sceneObject.materialManager.getMaterial(materialName);
        
        if (!materialObject) {
            var materialData = this._sceneBin.readMaterial(nodeInfo.material);

            materialObject = this._sceneObject.materialManager.createMaterialAdhoc(materialName);
            materialObject.attachShader(shaderObject);

            // Set material properties.
            diffuse[0] = materialData[0] / 255.0;
            diffuse[1] = materialData[1] / 255.0;
            diffuse[2] = materialData[2] / 255.0;
            materialObject.setDiffuse(diffuse);
            materialObject.setTransparent(materialData[3] / 255.0);
            if (materialData[4] !== 0xff) { // has texture
                var textureIndex = ((materialData[5] << 8) | materialData[4]);
                var textureName = this._sceneJson.textures[textureIndex].name;
                var textureData = this._sceneBin.readTexture(textureIndex); 
                if (textureData[0] === 4) {
                    if (textureData[2] === 1) {
                        materialObject.hasMask = true;
                        materialObject.transparent = false;
                    } else {
                        materialObject.transparent = true;
                    }
                } else if (materialObject.transparent){
                    materialObject.transparent = true;
                } else {
                    materialObject.transparent = false;
                }
                var textureObject = this._resourceManager.getTexture(textureName);
                materialObject.setDiffuseTexture(textureObject);
            }
        }

        return materialObject;
    };
    
    MeshLoader.prototype._createShaderObject = function(nodeInfo) {
        var materialData = this._sceneBin.readMaterial(nodeInfo.material);
        var attributes = this._attributes[nodeInfo.attribute]; 

        var hasTexture = (materialData[4] !== 0xff);
        var shaderType = "solid";
        if (attributes.primitive === gl.LINES) {
            shaderType = "plain";
        } else if (attributes.hasColor) {
            shaderType = "color";
        } else if (hasTexture) {
            shaderType = "texture";
        }

        var layer = this._sceneJson.layers[nodeInfo.layer];
        if (layer.name.match(/glass/i) && !hasTexture) {
            shaderType = "glass";
        }

        // Textured objects are always opaque and their transparent pixels
        // will be culled using alpha testing.
        var transparency = (materialData[3] < 250 && !hasTexture);
        
        var flags = [];

        if (nodeInfo.instanced) {
            flags.push("INSTANCING");
        }
        if (nodeInfo.identity !== 1 || nodeInfo.billboard === 1) {
            flags.push("MODEL_TRANSFORM");
        }
        if (this._sceneObject.needRenderDoubleSided() && !transparency && nodeInfo.billboard !== 1) {   
            flags.push("DOUBLESIDED");
        }
        if (this._renderer.isShadowEnabled() && !transparency && nodeInfo.billboard !== 1) {
            flags.push("SHADOW");
        }
        if (this._renderer.isSectionEnabled()) {
            flags.push("CLIPPING");
        }
        if (hasTexture) {
            // If the texture is a decal.
            var textureIndex = ((materialData[5] << 8) | materialData[4]);
            var textureData = this._sceneBin.readTexture(textureIndex); 
            if (textureData[2]) {
                flags.push("ALPHATEST");
            }
        }
        if (this._sceneObject.compressed) {
            flags.push("COMPRESSION");
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
   
