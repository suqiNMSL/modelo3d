//
// m3d_load_mx2.js
// Load mx format version 2.0
//
//  

import Globals        from "../../m3d_globals.js";
import Error          from "../../m3d_errors.js"
import MyMath         from "../../00utility/m3d_math.js";
import Layer          from "../../03scene/m3d_layer.js";
import Node           from "../../03scene/graph/m3d_node.js";
import Model          from "../../03scene/m3d_model.js";
import View           from "../../03scene/m3d_view.js";
import LoadMisc       from "../m3d_load_misc.js";
import MeshLoader     from "./m3d_load_mesh.js"; 
import TextureLoader  from "./m3d_load_texture.js";
import SceneBinLoader from "./m3d_load_scenebin.js"
import SceneLoader    from "./m3d_load_scene.js";


export default (function() {
    "use strict";

    function LoadMX2(useLocalServer, sceneObject, cameraObject, resourceManager, renderer) {
        
        this._useLocalServer  = useLocalServer;
        this._sceneObject     = sceneObject;
        this._cameraObject    = cameraObject;
        this._resourceManager = resourceManager;

        this._meshLoader       = new MeshLoader(this._sceneObject, renderer, this._resourceManager);
        this._textureLoader    = new TextureLoader(this._sceneObject, this._resourceManager);
        this._sceneBinLoader   = null;

        this._renderer         = renderer;
    };

    LoadMX2.prototype.destroy = function() {
        this._meshLoader.destroy();
        this._textureLoader.destroy();
        this._sceneBinLoader.destroy();

        delete this._meshLoader;
        delete this._textureLoader;
        delete this._sceneBinLoader;
    };
        
    LoadMX2.prototype.load = function(modelFilePromises, sceneJson, onComplete1, onProgress) {
        if (this._useLocalServer) {
            var $q = Globals.frontendCallbacks.getPromiseLibrary();

            // scene.bin
            var url = "/local/" + this._sceneObject.id + "/scene.bin";
            modelFilePromises["scene.bin"] = LoadMisc.OpenFile(this._sceneObject.id, 
                    url, "scene.bin", "arraybuffer", $q);
            
            // textures
            for (var i = 0, len = sceneJson.textures.length; i < len; i++) {
                var uri = sceneJson.textures[i].name;
                modelFilePromises[uri] = LoadMisc.OpenImage(this._sceneObject.id, uri);
            }

            // meshes
            for (var i = 0, len = sceneJson.buffers.length; i < len; i++) {
                var meshName = "mesh" + i + ".bin";
                var url = "/local/" + this._sceneObject.id + "/" + meshName;
                modelFilePromises[meshName] = LoadMisc.OpenFile(this._sceneObject.id, url, 
                        meshName, "arraybuffer", $q);
            }
        }
        
        if (sceneJson.hasOwnProperty("bim.json")) {
            Globals.bim = true;
        }

        var progressTracker = new LoadMisc.ProgressTracker(onProgress);

        // The progress bar of phase 2 is driven by the downloaded bytes.
        for (var i = 0, len = sceneJson.textures.length; i < len; i++) {
            progressTracker.totalDownload += sceneJson.textures[i].byteLength;
        }
        for (var i = 0, len = sceneJson.buffers.length; i < len; i++) {
            progressTracker.totalDownload += sceneJson.buffers[i].byteLength;
        }
        progressTracker.totalDownload += sceneJson["scene.bin"];

        if (Globals.bim) {
            progressTracker.totalDownload += sceneJson["scene.xml"];
            progressTracker.totalDownload += sceneJson["bim.json"];
        }
                    
        var that = this;
        var onprogress1 = progressTracker.getSingleFileProgress();
        return modelFilePromises["scene.bin"].downloadFile()
            .then(function(res) {
                return that._load(modelFilePromises, sceneJson, res.data, onComplete1, progressTracker);
            }, null, function(eventData) {
                onprogress1(eventData.loaded);
            });
    };
    
    LoadMX2.prototype._load = function(modelFilePromises, sceneJson, sceneBin, 
            onComplete1, progressTracker) {
        this._sceneBinLoader = new SceneBinLoader(sceneJson, sceneBin);

        // Create scene graph nodes for each drawable node which is only 
        // needed for BIM.
        this._sceneObject.model = new Model;
        var graph = this._sceneObject.model.graph;
        graph.createNodes(sceneJson.scene.nodes);
        for (var i = 0, len = sceneJson.scene.nodes; i < len; i++) {
            graph.nodes[i] = new Node(i);
            var src = this._sceneBinLoader.readNodeBBox(i);
            var dst  = new Float32Array(graph.nodeBBoxes.buffer, i * 24, 6);

            MyMath.aabb.scale(dst, src, 1.01);
        }

        // Read views.
        var readViewNodes = null;
        // The bbox of visible nodes at initialization.
        var bbox = MyMath.aabb.createFromArray([
             Number.MAX_VALUE,  Number.MAX_VALUE,  Number.MAX_VALUE,
            -Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE]);

        for (var i = 0, len = sceneJson.views.length; i < len; ++i) {
            var viewInfo = sceneJson.views[i];
            var viewData = this._sceneBinLoader.readViewData(i);
            var viewName = viewInfo.name;
            this._sceneObject.views[viewName] = new View(viewName, viewData);
            if (viewInfo.layers !== 0) {
                var viewLayers = this._sceneBinLoader.readViewLayers(i);
                this._sceneObject.views[viewName].layers = new Uint32Array(viewLayers);
            }
            if (viewName === sceneJson.scene.defaultView && viewInfo.nodes !== 0) {
                readViewNodes = this._sceneBinLoader.readViewNodes(i);
                for (var j = 0, len1 = readViewNodes.length; j < len1; j++) {
                    var nodeBBox = this._sceneBinLoader.readNodeBBox(readViewNodes[j]); 
                    MyMath.aabb.union(bbox, nodeBBox, bbox);
                }
            }
        }

        this._sceneObject.defaultView = this._getDefaultView(this._sceneObject.views, 
                sceneJson.scene.defaultView);
        
        // Read layers
        this._sceneObject.layers = new Array(sceneJson.layers.length);
        for (var i = 0, len = sceneJson.layers.length; i < len; ++i) {
            var layerData = sceneJson.layers[i];
            var layerObject = new Layer(layerData.name, i, layerData.color, layerData.visible);
            this._sceneObject.layers[i] = layerObject;
            
            if (layerData.visible && readViewNodes === null) {
                var layerNodes = this._sceneBinLoader.readLayerNodes(i);

                for (var j = 0, len1 = layerNodes.length; j < len1; ++j) {
                    var nodeIndex = layerNodes[j];
                    var nodeBBox = this._sceneBinLoader.readNodeBBox(nodeIndex); 
                    MyMath.aabb.union(bbox, nodeBBox, bbox);
                }
            }
        }

        // Initialize the size of the scene.
        this._sceneObject.setBBox(bbox);
        this._sceneObject.clipping.initialize(this._sceneObject.bbox);
        // Initialize camera.
        this._cameraObject.reset(true);
        if (this._sceneObject.defaultView) {
            // Set the camera to default view
            this._cameraObject.restore(this._sceneObject.defaultView);
        } 
        
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
        this._sceneObject.unit       = sceneJson.scene.unit || "feet";
        
        // See if we have enough GPU memory to load this scene. If we have,
        // then compute the left memory for static mesh merge.
        var totalMeshBytes = 0;
        for (i = 0, len = sceneJson.buffers.length; i < len; i++) {
            totalMeshBytes += sceneJson.buffers[i].byteLength;
        }
        // Compute the memory budget for merging.
        var memoryBudget = Globals.gpuMemory * 1024 * 1024 - totalMeshBytes;
        if (memoryBudget <= 0) {
            console.warn("This scene may be too large to load on current hardware platform. No sufficient resources found!");
            // Only throw in mobile safari since mobile app can't recover from memory warnings.
            if (!window.cordova && Globals.isMobile) {
                throw new Error("Insufficient GPU memory!");
            } else {
                memoryBudget = 1;
            }
        }

        var totalMeshKbytes = Math.round(totalMeshBytes / 1024 * 100) / 100;

        modelo3d.debug("Total mesh size (KBs): " + totalMeshKbytes + ", budget (KBs): " +
                Math.round(memoryBudget / 1024 * 100) / 100);

        sceneJson.scene.meshKbytes = totalMeshKbytes;
        sceneJson.scene.version    = 2;

        // The callback of first stage of loading.
        onComplete1(sceneJson.scene);

        this._meshLoader._memoryBudget = memoryBudget;

        for (var i = 0, len = sceneJson.textures.length; i < len; i++) {
            var textureName = sceneJson.textures[i].name;
            var textureObject = this._resourceManager.getTexture(textureName);
            textureObject.create(1, 1);
        }

        var that = this;
        
        var promises = [];
        promises.push(this._meshLoader.load(modelFilePromises, sceneJson, that._sceneBinLoader, progressTracker));
        promises.push(this._textureLoader.load(modelFilePromises, sceneJson, that._sceneBinLoader, progressTracker));
        var _$q = Globals.frontendCallbacks.getPromiseLibrary();
        
        
        return _$q.all(promises).then(function() {
            if (Globals.bim) {
                modelo3d.debug("Loading scene graph.");
                var sceneLoader = new SceneLoader(that._useLocalServer, that._sceneObject, that._resourceManager);
                return sceneLoader.load(modelFilePromises, sceneJson);
            } else {
                var $q = Globals.frontendCallbacks.getPromiseLibrary();
                return $q.resolve("done");
            }
        });
    };

    LoadMX2.prototype._getDefaultView = function(viewObjects, defaultViewName) {
        if (!viewObjects || !defaultViewName) {
            return null;
        }

        var viewObject = viewObjects[defaultViewName];
        // We don't allow a default view to be an ortho view
        if (viewObject.isOrthoView()) {
            return null;
        }
        return viewObject;
    };

    return LoadMX2;
})();
