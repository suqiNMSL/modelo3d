//
// m3d_load_mt1.js
// Load the terrain model (.mt format)
//
// Copyright Modelo XX - 2018, All rights reserved.

import Globals            from "../../m3d_globals.js";
import MyMath             from "../../00utility/m3d_math.js";
import Error              from "../../m3d_errors.js"
import Layer              from "../../03scene/m3d_layer.js";
import Terrain            from "../../03scene/terrain/m3d_terrain.js";
import LoadMisc           from "../m3d_load_misc.js";
import TilesLoader        from "./m3d_load_tiles.js"; 
import TerrainBinLoader   from "./m3d_load_terrainbin.js";

export default (function() {
    "use strict";

    function LoadMT1(useLocalServer, transform, sceneObject, cameraObject, resourceManager, renderer) {
        this._useLocalServer  = useLocalServer;
        this._sceneObject     = sceneObject;
        this._cameraObject    = cameraObject;
        this._resourceManager = resourceManager;
        this._renderer        = renderer;
        this._transform       = transform || [1.0, 0.0, 0.0, 0.0, 0.0];

        this._tilesLoader       = new TilesLoader(useLocalServer, sceneObject, renderer, resourceManager);
        this._terrainBinLoader  = null;

        this.levelIndex = -1; // The index of level in the scene.json
    };

    LoadMT1.prototype.destroy = function() {
        this._tilesLoader.destroy();
        this._terrainBinLoader.destroy();

        this._tilesLoader = null;
        this._terrainBinLoader = null;

        delete this._tilesLoader;
        delete this._terrainBinLoader;
    };
        
    LoadMT1.prototype.load = function(terrainFilePromises, sceneJson, onComplete1, onProgress) {
        // FIXME: in first version of our terrain loader and renderer, we only load+render two
        // levels of the terrain. We first load the corase level and then after finish the loading
        // the model, we load the fine level.
        if (!this._sceneObject.terrain) {
            this.levelIndex = 0;
        } else {
            this.levelIndex = 1;
        }

        if (this.levelIndex >= sceneJson.levels.length) {
            throw new Error("The specified level doesn't exist in the scene.json");
        }

        if (this._useLocalServer) {
            var $q = Globals.frontendCallbacks.getPromiseLibrary();
            
            var url = "/local/" + this._sceneObject.id + "/terrain/terrain.bin";
            terrainFilePromises["terrain.bin"] = LoadMisc.OpenFile(this._sceneObject.id, 
                    url, "terrain.bin", "arraybuffer", $q);
        }
        
        var progressTracker = new LoadMisc.ProgressTracker(onProgress);
        progressTracker.totalDownload = sceneJson["terrain.bin"].byteLength;
        progressTracker.totalDownload += sceneJson.levels[this.levelIndex].byteLength;

        onComplete1(sceneJson);
        
        var onprogress = progressTracker.getSingleFileProgress();

        var that = this;
        return terrainFilePromises["terrain.bin"].downloadFile()
            .then(function(res) {
                // Create the terrain object.
                return that._load(terrainFilePromises, sceneJson, res.data, progressTracker);
            }, function() {}, function(eventData) {
                onprogress(eventData.loaded);
            });
    };
    
    LoadMT1.prototype._load = function(terrainFilePromises, sceneJson, terrainBin, progressTracker) {
        this._terrainBinLoader = new TerrainBinLoader(sceneJson, terrainBin);

        // Create terrain object if not exists
        if (!this._sceneObject.terrain) {
            this._sceneObject.terrain = new Terrain(sceneJson.totalLevels, sceneJson.bbox);
        
            // Create a terrain layer for 
            if (this._sceneObject.layers.length === 0) {
                var layerObject = new Layer("default", 0, [1, 1, 1], true);
                this._sceneObject.layers.push(layerObject);
            }

            
            var fields = sceneJson.source.split(".");
            this._sceneObject.terrain.source = fields[fields.length - 1];
        } 

        this._sceneObject.terrain.setScaling(this._transform[0]);
        this._sceneObject.terrain.setRotation(this._transform[1]);
        this._sceneObject.terrain.setTranslation(
                this._transform[2],
                this._transform[3],
                this._transform[4]);

        // Update the scene's bbox
        MyMath.aabb.union(this._sceneObject.bbox, this._sceneObject.terrain.bbox, this._sceneObject.bbox);
        this._sceneObject.setBBox(this._sceneObject.bbox); // Update scene radius and etc
        this._sceneObject.clipping.initialize(this._sceneObject.bbox);

        // Initialize camera.
        this._cameraObject.reset(true);
        
        var that = this;
        return this._tilesLoader.loadLevel(terrainFilePromises, sceneJson, this._terrainBinLoader, this.levelIndex, progressTracker).then(function() {
                        var level = sceneJson.levels[that.levelIndex].name;
                        that._sceneObject.terrain.useLevel(level);
                        that._renderer.onSceneChanged();
                });
    };

    return LoadMT1;
})();
