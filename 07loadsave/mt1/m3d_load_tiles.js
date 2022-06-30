//
// m3d_load_tiles.js
// Load the tiles' data (mesh, texture and other ) per level of a terrain scene
//
// Copyright Modelo XX - 2018, All rights reserved.
//
//

import Globals            from "../../m3d_globals.js";
import MyMath             from "../../00utility/m3d_math.js";
import MeshAttributes     from "../../02resource/m3d_mesh_attribute.js";
import ShaderLibrary      from "../../02resource/m3d_shader_library.js"
import TerrainLevel       from "../../03scene/terrain/m3d_terrain_level.js";
import TerrainTile        from "../../03scene/terrain/m3d_terrain_tile.js";
import Drawable           from "../../03scene/drawables/m3d_drawable.js";
import LoadMisc           from "../m3d_load_misc.js";


export default (function() {
    "use strict";

    function TilesLoader(useLocalServer, sceneObject, renderer, resourceManager) {
        this._sceneObject     = sceneObject;
        this._renderer        = renderer;
        this._resourceManager = resourceManager;
        this._useLocalSever   = useLocalServer;

        this._attributes = new MeshAttributes();
        this._attributes.builtin(gl.FLOAT, null, gl.FLOAT, null);
    };
    
    TilesLoader.prototype.destroy = function() {
        this._sceneObject = null;
        delete this._sceneObject;

        this._renderer = null;
        delete this._renderer;

        this._resourceManager = null;
        delete this._resourceManager;

        this._attributes = null;
        delete this._attributes;
    }; 
    
    TilesLoader.prototype.loadLevel = function(terrainFilePromises, sceneJson, terrainBin, 
            levelIndex, progressTracker) {
        var level   = sceneJson.levels[levelIndex].name;
        var size    = (1 << level);
        var offset  = ((1 << (sceneJson.totalLevels - 1)) >> level);
        
        // We generate texture download promises
        var texturePromises = [];
        var textureNames    = [];
        var textureBytes    = [];
        var tiles   = size * size;
        for (var i = 0; i < tiles; i++) {
            var tileData = terrainBin.readTile(levelIndex, i);
            if (tileData[1] > 0) { // A valid tile.
                var x = (tileData[0] & 0xffff) * offset;
                var y = (tileData[0] >> 16) * offset;

                //var textureFileName = `tile_${level}_${x}_${y}_tex_tex0.jpg`;
                var textureFileName = "tile_" + level + "_" + x + "_" + y + "_tex_tex0.jpg";
                textureNames.push(textureFileName);

                if (this._useLocalSever) {
                    texturePromises.push(LoadMisc.OpenImage(this._sceneObject.id, "terrain/" + textureFileName));
                } else {
                    texturePromises.push(terrainFilePromises[textureFileName]);
                }
                
                var textureFileBytes = (tileData[1] >> 1);
                textureBytes.push(textureFileBytes);
            }
        }

        var meshPromise = null;
        var meshName = "mesh" + levelIndex + ".bin";

        if (this._useLocalSever) {
            var $q = Globals.frontendCallbacks.getPromiseLibrary();
            var url = "/local/" + this._sceneObject.id + "/terrain/" + meshName;
            meshPromise = LoadMisc.OpenFile(this._sceneObject.id, url, meshName, "arraybuffer", $q);
        } else {
            meshPromise = terrainFilePromises[meshName];
        }

        var layerObject = this._sceneObject.layers[0];

        var levelObject = new TerrainLevel(level);
        this._sceneObject.terrain.setLevel(levelObject);

        var shaderObject = this._createShaderObject();

        var that = this;
        // Load the texturex
        return this._loadTextures(texturePromises, textureNames, textureBytes, progressTracker)
            .then(function() {

                // Load the mesh binary.
                var onprogress = progressTracker.getSingleFileProgress();
                return meshPromise.downloadFile()
                    .then(function(res) {
                        var meshBinary = res.data;

                        var indicesOffset = 0;
                        for (var i  = 0; i < tiles; i++) {
                            var tileData = terrainBin.readTile(levelIndex, i);
                            if (tileData[1] > 0) {
                                indicesOffset += tileData[4];
                            }
                        }

                        var vbuffer = that._resourceManager.getBuffer("tile_" + level + "_vertices.bin");
                        var ibuffer = that._resourceManager.getBuffer("tile_" + level + "_indices.bin");
                        var vertices = new Uint8Array(meshBinary, 0, indicesOffset)
                        var indices  = new Uint8Array(meshBinary, indicesOffset, meshBinary.byteLength - indicesOffset);
                        vbuffer.create(gl.ARRAY_BUFFER, vertices);
                        ibuffer.create(gl.ELEMENT_ARRAY_BUFFER, indices);
                        
                        for (var i = 0; i < tiles; i++) {
                            var tileData = terrainBin.readTile(levelIndex, i);

                            if (tileData[1] > 0) { // A valid tile.
                                var x = (tileData[0] & 0xffff) * offset;
                                var y = (tileData[0] >> 16) * offset;
                                
                                tileData[5] -= indicesOffset;
                                var meshObject = that._createMeshObject(level, tileData, vbuffer, ibuffer);
                                if (meshObject.ready) {
                                    //var textureFileName = `tile_${level}_${x}_${y}_tex_tex0.jpg`;
                                    var textureFileName = "tile_" + level + "_" + x + "_" + y + "_tex_tex0.jpg";
                                    var materialObject = that._createMaterialObject(textureFileName, shaderObject);

                                    var tileObject = that._createTileObject(level, tileData, 
                                            meshObject, shaderObject, materialObject, layerObject);
                                    levelObject.addTile(tileObject);
                                }
                            }
                        }
                    }, function() {
                    }, function(eventData) {
                        onprogress(eventData.loaded);
                    });
            });
    };

    TilesLoader.prototype._createMeshObject = function(level, tileData, verticesBuffer, indicesBuffer) {
        var x = (tileData[0] & 0xffff);
        var y = (tileData[0] >> 16);
        //var meshName = `tile_${level}_${x}_${y}`;
        var meshName = "tile_" + level + "_" + x + "_" + y;
        var meshObject = this._resourceManager.getMesh(meshName);
        
        if (!meshObject.ready) {
            var indexTypes = [
                gl.UNSIGNED_BYTE,
                gl.UNSIGNED_BYTE,
                gl.UNSIGNED_SHORT,
                gl.UNSIGNED_SHORT,
                gl.UNSIGNED_INT,
            ];

            var vertices = {
                "byteLength": tileData[4],
                "byteOffset": tileData[3]
            }
            var indices = {
                "byteLength": tileData[6],
                "byteOffset": tileData[5]
            }

            var attributes = this._attributes.clone();
            for (var i = 0, len = attributes.values.length; i < len; i++) {
                attributes.values[i].offset += vertices.byteOffset;
            }

            meshObject.createShared(gl.TRIANGLES, attributes, 
                    vertices, indices, indexTypes[(tileData[2] & 0xff)], verticesBuffer, indicesBuffer);
        } 

        return meshObject;
    };

    var WHITE = [1, 1, 1];
    TilesLoader.prototype._createMaterialObject = function(textureName, shaderObject) {
        var materialName = textureName;
        var materialObject = this._sceneObject.materialManager.getMaterial(materialName);

        if (!materialObject) {
            materialObject = this._sceneObject.materialManager.createMaterialAdhoc(materialName);
            materialObject.attachShader(shaderObject);

            // Set material properties.
            materialObject.setDiffuse(WHITE);
            materialObject.setTransparent(1.0);
            materialObject.transparent = false;

            var textureObject = this._resourceManager.getTexture(textureName);
            materialObject.setDiffuseTexture(textureObject);
        }

        return materialObject;
    };

    var tile_bbox = [0, 0, 0, 0, 0, 0];
    TilesLoader.prototype._createTileObject = function(level, tileData, meshObject, 
            shaderObject, materialObject, layerObject) {

        // Compute the tile bbox from the tile coordinate.
        // The (0, 0) tile is at the left bottom corner of the xy plane. 
        MyMath.aabb.copy(tile_bbox, this._sceneObject.terrain._originalBBox);
        
        var x = (tileData[0] & 0xffff);
        var y = (tileData[0] >> 16);

        var size = (1 << level);
        var tileWidth  = (tile_bbox[3] - tile_bbox[0]) / size; // x
        var tileHeight = (tile_bbox[4] - tile_bbox[1]) / size; // y

        tile_bbox[0] += x * tileWidth;
        tile_bbox[1] += y * tileHeight;
        tile_bbox[3] = tile_bbox[0] + tileWidth;
        tile_bbox[4] = tile_bbox[1] + tileHeight;

        MyMath.aabb.scale(tile_bbox, tile_bbox, 1.05); // scale up a little bit
                                    
        //var drawableName = `tile_${level}_${x}_${y}`;
        var drawableName = "tile_" + level + "_" + x + "_" + y;

        var drawableObject = new Drawable(drawableName,
                meshObject,
                layerObject,
                shaderObject,
                materialObject,
                null, 
                tile_bbox);
        
        drawableObject.visible = true;
        layerObject.drawables.push(drawableObject);                
                                
        var tileObject = new TerrainTile(x, y, drawableObject, tile_bbox);

        return tileObject;
    };

    TilesLoader.prototype._loadTextures = function(texturePromises, textureNames, textureBytes, progressTracker) {
        var $q = Globals.frontendCallbacks.getPromiseLibrary();

        var that = this;
        
        // Load textures
        var loadTextureImage = function(textureIndex) {

            return texturePromises[textureIndex].downloadFile().then(function(image){

                var textureName = textureNames[textureIndex];
                var textureObject = that._resourceManager.getTexture(textureName);
                textureObject.createFromImage(image, gl.RGB, gl.UNSIGNED_BYTE, gl.LINEAR_MIPMAP_NEAREST, gl.CLAMP_TO_EDGE);
                if (!textureObject.ready) {
                    return $q.reject("modelo3d loader errors at creating texture object '" + textureName + "'."); 
                }
                
                var onprogress = progressTracker.getSingleFileProgress();
                onprogress(textureBytes[textureIndex]); 
            });
        }
        
        var prev = loadTextureImage(0);
        for (var i = 1, len = texturePromises.length; i < len; i++) {
            prev = (function(textureIndex) {
                return prev.then(function() {
                    return loadTextureImage(textureIndex);
                });
            })(i);
        }

        return prev;
    };

    TilesLoader.prototype._createShaderObject = function() {
        var shaderType = "plain_texture";

        var flags = [];
        flags.push("MODEL_TRANSFORM");
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

    return TilesLoader;
})();

