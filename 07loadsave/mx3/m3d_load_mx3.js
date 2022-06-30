//
// m3d_load_mx3.js
// Load mx format version 3.0
//
//  

import Globals            from "../../m3d_globals.js";
import Error              from "../../m3d_errors.js"
import MyMath             from "../../00utility/m3d_math.js";
import Layer              from "../../03scene/m3d_layer.js";
import Node               from "../../03scene/graph/m3d_node.js";
import Model              from "../../03scene/m3d_model.js";
import LoadMisc           from "../m3d_load_misc.js";
import MeshLoader         from "./m3d_load_mesh.js"; 
import TextureLoader      from "../mx2/m3d_load_texture.js";
import SceneModelBinLoader from "./m3d_load_scenemodelbin.js"
import ModelGraphLoader   from "./m3d_load_modelgraph.js";


export default (function() {
    "use strict";

    function LoadMX3(useLocalServer, sceneObject, cameraObject, resourceManager, renderer) {
        
        this._useLocalServer  = useLocalServer;
        this._sceneObject     = sceneObject;
        this._cameraObject    = cameraObject;
        this._resourceManager = resourceManager;

        this._meshLoader          = new MeshLoader(this._sceneObject, renderer, this._resourceManager);
        this._textureLoader       = new TextureLoader(this._sceneObject, this._resourceManager);
        this._modelGraphLoader    = new ModelGraphLoader(this._sceneObject, this._resourceManager);
        this._sceneModelBinLoader = null;

        this._renderer            = renderer;

        // FIXME: In .mx3, frontend takes over bim information. Modelo3d assumes it is always in bim mode.
        Globals.bim = true;
    };

    LoadMX3.prototype.destroy = function() {
        this._meshLoader.destroy();
        this._textureLoader.destroy();
        this._sceneModelBinLoader.destroy();
        this._modelGraphLoader.destroy();

        this._meshLoader = null;
        this._textureLoader = null;
        this._sceneModelBinLoader = null;
        this._modelGraphLoader = null;

        delete this._meshLoader;
        delete this._textureLoader;
        delete this._sceneModelBinLoader;
        delete this._modelGraphLoader;
    };
        
    LoadMX3.prototype.load = function(modelFilePromises, sceneJson, onComplete1, onProgress) {
        if (this._useLocalServer) {
            var $q = Globals.frontendCallbacks.getPromiseLibrary();
            
            var url = "/local/" + this._sceneObject.id + "/scene.bin";
            modelFilePromises["scene.bin"] = LoadMisc.OpenFile(this._sceneObject.id, 
                    url, "scene.bin", "arraybuffer", $q);
            
            var url = "/local/" + this._sceneObject.id + "/model.json";
            modelFilePromises["model.json"] = LoadMisc.OpenFile(this._sceneObject.id, 
                    url, "model.json", "json", $q);
            
            var url = "/local/" + this._sceneObject.id + "/model.bin";
            modelFilePromises["model.bin"] = LoadMisc.OpenFile(this._sceneObject.id, 
                    url, "model.bin", "arraybuffer", $q);
            
            var url = "/local/" + this._sceneObject.id + "/modelgraph.bin";
            modelFilePromises["modelgraph.bin"] = LoadMisc.OpenFile(this._sceneObject.id, 
                    url, "modelgraph.bin", "arraybuffer", $q);
            
            for (var i = 0, len = sceneJson.textures.length; i < len; i++) {
                var uri = sceneJson.textures[i].name;
                modelFilePromises[uri] = LoadMisc.OpenImage(this._sceneObject.id, uri);
            }
        }

        var that = this;
        return modelFilePromises["model.json"].downloadFile()
            .then(function(res) {

                var modelJson = res.data;

                // To be compatible with .mx 2.0 so that code at upper layer doesn't need
                // to differ 2.0 and 3.0.
                sceneJson.scene.nodes = modelJson["model.bin"].nodes;

                var progressTracker = new LoadMisc.ProgressTracker(onProgress);

                for (var i = 0, len = sceneJson.textures.length; i < len; i++) {
                    progressTracker.totalDownload += sceneJson.textures[i].byteLength;
                }
                for (var i = 0, len = modelJson.buffers.length; i < len; i++) {
                    progressTracker.totalDownload += modelJson.buffers[i].byteLength;
                    if (that._useLocalServer) {
                        var meshName = "mesh" + i + ".bin";
                        var url = "/local/" + that._sceneObject.id + "/" + meshName;
                        modelFilePromises[meshName] = LoadMisc.OpenFile(that._sceneObject.id, 
                            url, meshName, "arraybuffer", $q);
                    }
                }
                progressTracker.totalDownload += modelJson["model.bin"].byteLength;
                progressTracker.totalDownload += modelJson["modelgraph.bin"].byteLength;
                
                var onprogress1 = progressTracker.getSingleFileProgress();

                // FIXME: in the BIM product, the promise library doesn't have notify() so
                // has to hook up onProgress to promise directly.
                if (modelFilePromises["model.bin"].onProgress) {
                    modelFilePromises["model.bin"].onProgress(function(eventData) {
                        onprogress1(eventData.loaded);
                    });
                }

                return modelFilePromises["scene.bin"].downloadFile()
                    .then(function(res) {
                        var sceneBin = res.data;
                        var onprogress2 = progressTracker.getSingleFileProgress();
                        return modelFilePromises["model.bin"].downloadFile() 
                            .then(function(res) {
                                return that._load(modelFilePromises, sceneJson, sceneBin, modelJson,
                                    res.data, onComplete1, progressTracker);
                            }, null, function(eventData) {
                                onprogress2(eventData.loaded);
                            });
                    }, null, function(eventData) {
                        
                    });
            });
    };
    
    LoadMX3.prototype._load = function(modelFilePromises, sceneJson, sceneBin,  
            modelJson, modelBin, onComplete1, progressTracker) {

        if (Globals.state !== modelo3d.LOADING) {
            throw new Error("Loading is interrupted");
        }

        this._sceneModelBinLoader = new SceneModelBinLoader(sceneJson, sceneBin, modelJson, modelBin);

        // Create scene graph leaves for each drawable node which is only 
        // needed for BIM.
        this._sceneObject.model = new Model;
        this._sceneObject.model.bbox = MyMath.aabb.createFromArray(modelJson["model.bin"].bbox);

        var graph = this._sceneObject.model.graph;
        var numNodes = modelJson["model.bin"].nodes;
        graph.createNodes(numNodes);
        for (var i = 0; i < numNodes; i++) {
            graph.nodes[i] = new Node(i);  

            var src = this._sceneModelBinLoader.readNodeBBox(i);
            var dst  = new Float32Array(graph.nodeBBoxes.buffer, i * 24, 6);

            MyMath.aabb.scale(dst, src, 1.01);
        }
        
        // Create a default layer if there is not.
        if (this._sceneObject.layers.length === 0) {
            this._sceneObject.layers = new Array(1);
            var layerObject = new Layer("default", 0, [1, 1, 1], true);
            this._sceneObject.layers[0] = layerObject;
        }

        // Initialize the size of the scene.
        MyMath.aabb.union(this._sceneObject.bbox, this._sceneObject.model.bbox, this._sceneObject.bbox);
        this._sceneObject.setBBox(this._sceneObject.bbox); // Update scene radius and etc
        this._sceneObject.isBimCullingNeeded = true;
        
        // Initialize camera.
        this._cameraObject.reset(true);
        
        // Whether this scene needs to be rendered in double-sided way based
        // the source file type of this model.
        if (sceneJson.source) {
            var fields = sceneJson.source.split(".");
            switch (fields[fields.length - 1]) {
                case "skp":
                    this._sceneObject.faces = 2;
                    this._sceneObject.isBimCullingNeeded = true;
                    break;
                case "rfa":
                case "rvt":
                    this._sceneObject.faces = 0;
                    var versionDigits = sceneJson.version.split(".");
                    var version = parseInt(versionDigits[0]) * 10000 +
                                  parseInt(versionDigits[1]) * 100 +
                                  parseInt(versionDigits[2]);
                    this._sceneObject.hasProfileLines= version > 20001;
                    this._sceneObject.isBimCullingNeeded = true;
                    break;
                case "vgx":
                case "stl":
                case "max":
                    this._sceneObject.faces = 1;
                    break;
                case "obj":
                case "3dm":
                    this._sceneObject.faces = 0;
                    this._sceneObject.hasCurveOrLine = true;
                    break;
                case "nwd":
                    this._sceneObject.faces = 0;
                    break;
                default:
                    this._sceneObject.faces = 1;
                    break;
            }

            this._sceneObject.source = fields[fields.length - 1];
        } 

        this._sceneObject.scaleRatio = 1.0;
        this._sceneObject.unit       = sceneJson.scene.unit;
        

        // The callback of first stage of loading.
        onComplete1(modelJson["model.bin"]);

        var that = this;
        return this._textureLoader.load(modelFilePromises, sceneJson, that._sceneModelBinLoader, progressTracker)
            .then(function() {
                if (Globals.state !== modelo3d.LOADING) {
                    throw new Error("Loading is interrupted");
                }
                return that._meshLoader.load(modelFilePromises, sceneJson, that._sceneModelBinLoader, modelJson, progressTracker)
                    .then(function() {
                        if (Globals.state !== modelo3d.LOADING) {
                            throw new Error("Loading is interrupted");
                        }
                        return that._modelGraphLoader.load(modelFilePromises, progressTracker);
                    });
            });
    };

    return LoadMX3;
})();
