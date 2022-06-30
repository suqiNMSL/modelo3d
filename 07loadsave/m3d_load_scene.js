//
// m3d_load_model.js
// load the model file (.mx format)
//
//  

import Globals        from "../m3d_globals.js";
import Error          from "../m3d_errors.js"
import LoadMX1        from "./mx1/m3d_load_mx1.js"
import LoadMX2        from "./mx2/m3d_load_mx2.js"
import LoadMX3        from "./mx3/m3d_load_mx3.js"
import LoadMT1        from "./mt1/m3d_load_mt1.js"
import LoadMisc       from "./m3d_load_misc.js"

export default (function() {
    "use strict";

    function LoadScene(useLocalServer, sceneObject, cameraObject, resourceManager, renderer) {
        // When useLocalServer is true, we will download the model file from the local
        // server which is for debugging purpose.
        this._useLocalServer  = useLocalServer;
        this._sceneObject     = sceneObject;
        this._cameraObject    = cameraObject;
        this._resourceManager = resourceManager;
        this._renderer        = renderer;

        this._loadmx1         = null;
        this._loadmx2         = null;
        this._loadmx3         = null;
        this._loadmt1         = null;
    }; 

    LoadScene.prototype.load = function(modelInformation, modelFilePromises, onComplete1, onComplete2, onProgress) {
        var that = this;

        console.group("Loading scene " + this._sceneObject.id);

        var version = 0; 
        var sceneJson = null;
        return modelFilePromises["scene.json"].downloadFile()
            .then(function(res) {
                if (typeof(res.data) === "string") {
                    sceneJson = JSON.parse(res.data);
                } else {
                    sceneJson = res.data;
                }

                var versionDigits = sceneJson.version.split(".");
                version = parseInt(versionDigits[0]) * 10000 +
                              parseInt(versionDigits[1]) * 100 +
                              parseInt(versionDigits[2]);
                if (version < 403) {
                    return that._$q(function(resolve, reject) {
                        error = Error.ERROR_INCOMPATIBLE_MODEL_FILE_VERSION;
                        reject(error);
                    });
                }

                console.time("Loading scene takes ");
            }, null, function(eventData) {
                onProgress(eventData.loaded / eventData.total * 0.05);
            })
            .then(function() {
                var onProgress1 = function(progress) {
                    onProgress(0.05 + progress * 0.95);
                };

                if (sceneJson.type && sceneJson.type === "terrain") {
                    console.log("A mt 1.0 model");
                    that._loadmt1 = new LoadMT1(that._useLocalServer, 
                        modelInformation.terrainTransform, that._sceneObject, that._cameraObject,
                        that._resourceManager, that._renderer);
                    return that._loadmt1.load(modelFilePromises, sceneJson, onComplete1, onProgress1);           
                } else {
                    if (version < 20000) { // MX 1.0
                        console.log("A mx 1.0 model.");
                        that._loadmx1 = new LoadMX1(that._useLocalServer, that._sceneObject, that._cameraObject,
                            that._resourceManager, that._renderer);
                        return that._loadmx1.load(modelFilePromises, sceneJson, onComplete1, onProgress1);           
                    } else if (version < 30000) { // MX 2.0
                        console.log("A mx 2.0 model.");
                        that._sceneObject.compressed = Globals.compressScene; 
                        that._loadmx2 = new LoadMX2(that._useLocalServer, that._sceneObject, that._cameraObject,
                            that._resourceManager, that._renderer);
                        return that._loadmx2.load(modelFilePromises, sceneJson, onComplete1, onProgress1);           
                    } else { // MX 3.0
                        console.log("A mx 3.0 model.");
                        that._sceneObject.compressed = Globals.compressScene; 
                        that._loadmx3 = new LoadMX3(that._useLocalServer, that._sceneObject, that._cameraObject,
                            that._resourceManager, that._renderer);
                        return that._loadmx3.load(modelFilePromises, sceneJson, onComplete1, onProgress1);           
                    }
                }
            })
            .then(function() {
                console.timeEnd("Loading scene takes ");

                if (sceneJson.type && sceneJson.type === "terrain") {
                    modelo3d.debug("Terrain:\n");
                    modelo3d.debug("  current drawables:  " + that._sceneObject.terrain.drawables.length);
                } else {
                    modelo3d.debug("Optimization:\n");
                    modelo3d.debug("  original drawables: " + sceneJson.scene.nodes);
                    modelo3d.debug("  current drawables:  " + that._sceneObject.model.drawables.length);
                }

                if (that._loadmx1) {
                    that._loadmx1.destroy();
                    that._loadmx1 = null;
                    delete that._loadmx1;
                }
                if (that._loadmx2) {
                    that._loadmx2.destroy();
                    that._loadmx2 = null;
                    delete that._loadmx2;
                }
                
                if (that._loadmx3) {
                    that._loadmx3.destroy();
                    that._loadmx3 = null;
                    delete that._loadmx3;
                }

                if (that._loadmt1) {
                    that._loadmt1.destroy();
                    that._loadmt1 = null;
                    delete that._loadmt1;
                }

                onProgress(1.0);
                onComplete2(sceneJson);
        
                console.groupEnd("Loading scene " + that._sceneObject.id);
            });
    }; 
    
    return LoadScene;
})();
    
            
