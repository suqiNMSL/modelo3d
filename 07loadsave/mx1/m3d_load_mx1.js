//
// m3d_load_mx1.js
// Load mx format version 1.0
//
//  

import Globals        from "../../m3d_globals.js";
import Error          from "../../m3d_errors.js"
import MyMath         from "../../00utility/m3d_math.js";
import Layer          from "../../03scene/m3d_layer.js";
import Model          from "../../03scene/m3d_model.js";
import View           from "../../03scene/m3d_view.js";
import MeshLoader     from "./m3d_load_mesh.js";
import TextureLoader  from "./m3d_load_texture.js";
import LoadMisc       from "../m3d_load_misc.js";


export default (function() {
    "use strict";

    function LoadMX1(useLocalServer, sceneObject, cameraObject, resourceManager, renderer) {
        this._$q              = Globals.frontendCallbacks.getPromiseLibrary();
        
        this._useLocalServer  = useLocalServer;
        this._sceneObject     = sceneObject;
        this._cameraObject    = cameraObject;
        this._resourceManager = resourceManager;

        this._meshLoader       = new MeshLoader(this._sceneObject, renderer, this._resourceManager, this._$q, true);
        this._textureLoader    = new TextureLoader(this._sceneObject, renderer, this._resourceManager, this._$q);

        this._renderer         = renderer;
    };

    LoadMX1.prototype.destroy = function() {
        this._meshLoader.destroy();
        this._textureLoader.destroy();

        delete this._meshLoader;
        delete this._textureLoader;
    };
    
    LoadMX1.prototype.load = function(modelFilePromises, sceneData, onComplete1, onProgress) {
        // Add views into scene and make the first view the visible view.
        var view, i, len, layer;
        for (view in sceneData.camera.views) {
            this._sceneObject.views[view] = new View(view, sceneData.camera.views[view]);
        }
        // FIXME: as the nodes are not loaded, it is not really useful to set
        // active view here.
        this._sceneObject.defaultView = this._getDefaultView(this._sceneObject.views, 
                sceneData.scene.defaultView);
        this._sceneObject.model = new Model;
        // Create layers 
        var bbox = MyMath.aabb.createFromArray([
             Number.MAX_VALUE,  Number.MAX_VALUE,  Number.MAX_VALUE,
            -Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE]);

        for (layer in sceneData.layers) {
            var layerData = sceneData.layers[layer];

            var layerObject = new Layer(layer, this._sceneObject.layers.length, layerData.color, layerData.visible);
            this._sceneObject.layers.push(layerObject);
            
            if (layerData.visible) {
                for (i = 0, len = layerData.nodes.length; i < len; ++i) {
                    var nodeName = layerData.nodes[i];
                    var nodeData = sceneData.scene.nodes[nodeName] ||
                                   sceneData.scene.billboards[nodeName];
                    // Only when this node is in default view or this node doesn't bind to any view, 
                    if (this._isNodeInView(nodeData, this._sceneObject.defaultView)) {
                        MyMath.aabb.union(bbox, nodeData.bbox, bbox);
                    }
                }
            }
        }

        // Add layers to view
        for (view in sceneData.camera.views) {
            var viewData = sceneData.camera.views[view];
            if (viewData.layers) {
                for (i = 0, len = viewData.layers.length; i < len; ++i) {
                    layer = this._sceneObject.getLayerByName(viewData.layers[i]);
                    if (layer) {
                        this._sceneObject.views[view].layers.push(layer.index);
                    }
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
            var defaultViewData = sceneData.camera.views[sceneData.scene.defaultView];
            this._cameraObject.restore(defaultViewData);
        } 
        
        // Whether this scene needs to be rendered in double-sided way based
        // the source file type of this model.
        // Since 0.5.5 mx, we add the source filename into the scene.json.
        if (sceneData.source) {
            var fields = sceneData.source.split(".");
            switch (fields[fields.length - 1]) {
                case "skp":
                    this._sceneObject.faces = 2;
                    break;
                case "rvt":
                case "rfa":
                    this._sceneObject.faces = 0;
                    break;
                case "vgx":
                case "stl":
                case "max":
                    this._sceneObject.faces = 1;
                    break;
                case "obj":
                case "3dm":
                    this._sceneObject.faces = 0;
                    break;
                default:
                    this._sceneObject.faces = 1;
                    break;
            }

            this._sceneObject.source = fields[fields.length - 1];
        } else {
            this._sceneObject.faces = sceneData.scene.doubleSided? 0 : 2; // compatible with scene.json < 0.5.5
            this._sceneObject.source = "unknown";
        }


        this._sceneObject.scaleRatio = sceneData.scene.unitScaling || 1.0;
        this._sceneObject.unit       = sceneData.scene.unit || "feet";
        
        // See if we have enough GPU memory to render this mesh. If we have,
        // then compute the left memory for static mesh merge.
        var totalMeshBytes = 0;
        for (i = 0, len = sceneData.buffers.length; i < len; i++) {
            var meshes = sceneData.meshes[sceneData.buffers[i].uri];
            for (var mesh in meshes) {
                var meshData = meshes[mesh];
                totalMeshBytes += meshData.indices.byteLength + meshData.vertices.byteLength;
            }
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

        sceneData.scene.meshKbytes = totalMeshKbytes;
        sceneData.scene.version    = 1;

        onComplete1(sceneData.scene);

        this._meshLoader._memoryBudget = memoryBudget;
        
        var progressTracker = new LoadMisc.ProgressTracker(onProgress);

        // Start the phase 2
        if (this._useLocalServer) {
            for (var texture in sceneData.textures) {
                var uri = sceneData.textures[texture].uri;
                modelFilePromises[uri] = LoadMisc.OpenImage(this._sceneObject.id, uri);
            }
            for (var i = 0, len = sceneData.buffers.length; i < len; i++) {
                var uri = sceneData.buffers[i].uri;
                var url = "/local/" + this._sceneObject.id + "/" + uri;
                modelFilePromises[uri] = LoadMisc.OpenFile(this._sceneObject.id, url, uri, "arraybuffer", this._$q);
            }
        }

        // The progress bar of phase 2 is driven by the downloaded bytes.
        for (var buffer in sceneData.buffers) {
            progressTracker.totalDownload += sceneData.buffers[buffer].byteLength;
        }
        progressTracker.totalDownload += Object.keys(sceneData.textures).length * 512 * 1024;
        for (var textureName in this._sceneObject.textures) {
            var textureObject = this._resourceManager.getTexture(textureName);
            textureObject.create(1, 1);
        }

        var that = this;
        var promises = [];
        promises.push(this._meshLoader.load(modelFilePromises, sceneData, progressTracker));
        promises.push(this._textureLoader.load(modelFilePromises, sceneData, progressTracker));
        var _$q = Globals.frontendCallbacks.getPromiseLibrary();
        return _$q.all(promises);
    };

    LoadMX1.prototype._getDefaultView = function(viewObjects, defaultViewName) {
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

    LoadMX1.prototype._isNodeInView = function(nodeData, defaultViewObject) {
        if (!defaultViewObject) {
            return true;
        }

        return nodeData.views === undefined || _.indexOf(nodeData.views, defaultViewObject.name) >= 0;
    };

    return LoadMX1;
})();
