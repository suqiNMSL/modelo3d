//
// m3d_load_mesh.js
// Load the meshes of scene
//
//  
//


import Globals            from "../../m3d_globals.js";
import profiling          from "../../m3d_profiling.js";
import Error              from "../../m3d_errors.js";
import MeshAttributes     from "../../02resource/m3d_mesh_attribute.js";
import ShaderLibrary      from "../../02resource/m3d_shader_library.js"
import Drawable           from "../../03scene/drawables/m3d_drawable.js";
import DrawableInstanced  from "../../03scene/drawables/m3d_drawable_instanced.js";
import Element            from "../../03scene/graph/m3d_element.js";
import Node               from "../../03scene/graph/m3d_node.js";
import LoadMisc           from "../m3d_load_misc.js";
import LoadMeshSync       from "./m3d_load_mesh_sync.js";
import LoadMeshSyncHybrid from "./m3d_load_mesh_sync_hybrid.js";

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
    };

    MeshLoader.prototype.destroy = function() {
        this._worker.destroy();
        this._workder = null;
        delete this._worker;

        this._sceneJson = null;
        this._sceneBin = null;
        this._sceneObject = null;
        this._attributes = null;
        this._renderer = null;
        
        delete this._sceneJson;
        delete this._sceneBin;
        delete this._sceneObject;
        delete this._renderer;
        delete this._attributes;
    };

    MeshLoader.prototype.load = function(modelPromises, sceneJson, sceneBin, modelJson, progressTracker) {
        this._sceneJson = sceneJson;
        this._modelJson = modelJson;
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
        this._worker = new LoadMeshSyncHybrid(this._resourceManager, sceneJson, sceneBin, modelJson, this._attributes, 
                this._sceneObject.compressed);

        // Execute $q promises sequentially, http://www.codeducky.org/q-serial/
        var that = this;
        var prev = that._loadMesh(0, modelPromises["mesh0.bin"], progressTracker);
        for (i = 1, len = modelJson.buffers.length; i < len; i++) {
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

        if (promise.onProgress) {
            promise.onProgress(function(eventData) {
                onprogress(eventData.loaded);
            });
        }

        // Load mesh buffer binary
        return promise.downloadFile().then(function(res) {
                if (Globals.state !== modelo3d.UNINITIALIZED) {
                    that._worker.load(meshBufferIndex, res.data, MeshLoader.prototype.onNodeDataReady.bind(that));
                }
            }, null, function(eventData) {
                onprogress(eventData.loaded);
            });
    };
    
    // Callbacks for sync.
    MeshLoader.prototype.onNodeDataReady = function(nodeInfo, vertexBuffer, indexBuffer, vertices, indices, nodesInfo) {
        var shaderObject = this._createShaderObject(nodeInfo);
        if (shaderObject) {
            var materialObject = this._createMaterialObject(nodeInfo, shaderObject);
            if (materialObject) {
                var meshObject = this._createMeshObject(nodeInfo, vertices, indices, vertexBuffer, indexBuffer);
                if (meshObject) {
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

    var NODEINFO_INT32 = 9;
    MeshLoader.prototype._createMeshObject = function(nodeInfo, vertices, indices, vertexBuffer, indexBuffer) {
        var meshObject = this._resourceManager.getMesh(
            nodeInfo[1] >= 0? nodeInfo[1].toString() : -nodeInfo[0].toString());
        
        if (!meshObject.ready) {
            var indexTypes = [
                gl.UNSIGNED_BYTE,
                gl.UNSIGNED_BYTE,
                gl.UNSIGNED_SHORT,
                gl.UNSIGNED_SHORT,
                gl.UNSIGNED_INT,
            ];

            var attributesIndex = ((nodeInfo[8] >> 8) & 0xff);
            var attributes = this._attributes[attributesIndex];

            var attributes = attributes.clone();
            if (this._sceneObject.compressed) {
                attributes.compress();
            }
            for (var i = 0, len = attributes.values.length; i < len; i++) {
                attributes.values[i].offset += vertices.byteOffset;
            }
            
            // When this node is a merged one, its mesh has an additonal piece of data after
            // other vertex attribute at the back part of mesh. We should update the vertex
            // attribute accordingly.
            if (nodeInfo[3] >= 0) {
                attributes.add("m_aMaterial", gl.UNSIGNED_BYTE, true, 1);

                var attribute = attributes.values[attributes.values.length - 1];
                attribute.index = 6;
                attribute.offset = attributes.values[0].offset + nodeInfo[4] * (attributes.values[0].stride);
                attribute.stride = 1;
            } 
            
            meshObject.createShared(attributes.primitive, attributes, 
                vertices, indices, indexTypes[(nodeInfo[8] & 0xff)], vertexBuffer, indexBuffer);
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

    MeshLoader.prototype._createDrawableObject = function(nodeInfo, meshObject, shaderObject, materialObject, nodesInfo) {
        // We have only one layer in the scene
        var layerObject = this._sceneObject.layers[0];

        // Create the drawable object.
        var attributes = this._attributes[(nodeInfo[8] >> 8) & 0xff]; 

        if ((nodeInfo[2] & 0x30000000)) {
            var transformData = new Float32Array(nodeInfo[6] * 16);
            var i = 0;
            var childNodeIndex = nodeInfo[0]; // start from this node.
            while (childNodeIndex != -1) {
                var offset = i * 16;
                var t = this._sceneBin.readNodeTransform(nodesInfo[childNodeIndex * NODEINFO_INT32]);
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
                
                childNodeIndex = nodesInfo[childNodeIndex * NODEINFO_INT32 + 3];
                i++;
            }

            var meshBBoxData = this._sceneBin.readNodeBBox(nodeInfo[0]);
            var bboxData = this._sceneBin.readNodeBBox(nodeInfo[0]);
            var drawableObject = new DrawableInstanced(nodeInfo[0], 
                                               meshObject,
                                               layerObject,
                                               shaderObject,
                                               materialObject,
                                               transformData, 
                                               bboxData,
                                               meshBBoxData);
        } else {
            var transformData = null;
            if ((nodeInfo[2] & 0x40000000) === 0) {
                transformData = ExtendTransform(this._sceneBin.readNodeTransform(nodeInfo[0]));
            }
            var bboxData = this._sceneBin.readNodeBBox(nodeInfo[0]);
            
            var drawableObject = new Drawable(nodeInfo[0].toString(), 
                        meshObject,
                        layerObject,
                        shaderObject,
                        materialObject,
                        transformData, 
                        bboxData);
        }

        // Add drawable object to view.
        drawableObject.visible = true;
        this._renderer.addModelDrawable(drawableObject);
        this._sceneObject.model.drawables.push(drawableObject);
        // The drawables that use the same material. It is a helper data
        // structure for change material.
        drawableObject.material.drawables.push(drawableObject);
        
        // Complete the node information and bind the drawable
        // drawable to its scene graph node.
        var currRegion = Node.STRUCTURE;
        var childNodeIndex = nodeInfo[0];
        var hidableIdx = 0;
        while (childNodeIndex >= 0) {
            var node   = this._sceneObject.model.graph.nodes[childNodeIndex];
            var region = ((nodesInfo[childNodeIndex * NODEINFO_INT32 + 2] >> 24) & 0x0f);

            drawableObject.nodes.push(node);
            node.region = region;
            node.drawable = drawableObject;
            //node.originalMatarial = drawableObject.material.name;
            
            if (nodesInfo[childNodeIndex * NODEINFO_INT32 + 2] & 0x30000000) { // if it is an instance
                node.indicesOffset = 1; // subrender doesn't work on instanced node.
                node.indicesCount = 1;
            } else {
                node.indicesOffset = nodesInfo[childNodeIndex * NODEINFO_INT32 + 6];
                node.indicesCount = nodesInfo[childNodeIndex * NODEINFO_INT32 + 7];
            }
            //MOD-8851 Drawables with no children needs to set to mesh data
            //nodeInfo[5] indicates the node indices bytes
            if (node.indicesOffset == 0 && node.indicesCount == 0) {
                node.indicesCount = nodeInfo[5] / meshObject.indexSize;
            }
            
            node.verticesCount = nodesInfo[childNodeIndex * NODEINFO_INT32 + 4];
            
            if (currRegion !== region) {
                currRegion = region;
                // We are looking for which elements can be hidable during rendering.
                // FIXME: change the hidablility strength to other region.
                if (region >= Node.STRUCTURE_INTERIOR && drawableObject.hidables < 0) {
                    drawableObject.hidables = hidableIdx;
                }
            }
            
            childNodeIndex = nodesInfo[childNodeIndex * NODEINFO_INT32 + 3];
            hidableIdx++;
        }
        // Since instanced drawable is a group of same kind of drawables, they should be either
        // culled or not in BIM culling.
        if (nodeInfo[2] & 0x30000000) {
            drawableObject.hidables = (((nodeInfo[2] >> 24)& 0x0f) >= Node.STRUCTURE_INTERIOR)? 0 : -1;
        }
        
        layerObject.drawables.push(drawableObject);                

        return drawableObject;
    };

    var diffuse = [1.0, 1.0, 1.0];
    MeshLoader.prototype._createMaterialObject = function(nodeInfo, shaderObject) {
        var materialName = this._sceneJson.materials[nodeInfo[2] & 0xffff];
        var materialObject = this._sceneObject.materialManager.getMaterial(materialName);

        if (!materialObject) {
            var materialData = this._sceneBin.readMaterial(nodeInfo[2] & 0xffff);

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
        var materialData = this._sceneBin.readMaterial(nodeInfo[2] & 0xffff);
        var attributes = this._attributes[(nodeInfo[8] >> 8) & 0xff]; 

        var hasTexture = (materialData[4] !== 0xff);
        var shaderType = "solid";
        if (attributes.primitive === gl.LINES) {
            shaderType = "plain";
        } else if (attributes.hasColor) {
            shaderType = "color";
        } else if (hasTexture) {
            shaderType = "texture";
        }

        // Textured objects are always opaque and their transparent pixels
        // will be culled using alpha testing.
        var transparency = (materialData[3] < 250 && !hasTexture);
        
        var flags = [];

        if (nodeInfo[2] & 0x30000000) {
            flags.push("INSTANCING");
        }
        if (nodeInfo.identity !== 1) {
            flags.push("MODEL_TRANSFORM");
        }
        if (this._sceneObject.needRenderDoubleSided() && !transparency) {   
            flags.push("DOUBLESIDED");
        }
        if (this._renderer.isShadowEnabled() && !transparency) {
            flags.push("SHADOW");
        }
        if (this._renderer.isSectionEnabled()) {
            flags.push("CLIPPING");
        }
        if (hasTexture) {
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
   
