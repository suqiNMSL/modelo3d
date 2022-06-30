//
// m3d_load_scene.js
// Load the scene graph and BIM information
//
//  

import Globals             from "../../m3d_globals.js";
import SceneXmlLoaderRevit from "./m3d_load_scenexml_revit.js"
import SceneXmlLoaderOther from "./m3d_load_scenexml_other.js"
import BimLoaderRevit      from "./m3d_load_bim_revit.js"
import LoadMisc            from "../m3d_load_misc.js";

export default (function() {
    "use strict";
   
    function SceneLoader(useLocalServer, sceneObject, resourceManager) {
        this._useLocalServer  = useLocalServer;
        this._sceneObject     = sceneObject;
        this._resourceManager = resourceManager;
    };

    SceneLoader.prototype.destroy = function() {
        delete this._sceneObject;
        delete this._resourceManager;
    };
    
    SceneLoader.prototype.load = function(modelFilePromises, sceneJson) {
        var progressTracker = new LoadMisc.ProgressTracker(function(progress) {});

        var $q = Globals.frontendCallbacks.getPromiseLibrary();


        if (this._useLocalServer) {
            // scene.xml
            var url = "/local/" + this._sceneObject.id + "/scene.xml";
            modelFilePromises["scene.xml"] = LoadMisc.OpenFile(this._sceneObject.id, 
                    url, "scene.xml", "text", $q);
            
            // bim.json
            var url = "/local/" + this._sceneObject.id + "/bim.json";
            modelFilePromises["bim.json"] = LoadMisc.OpenFile(this._sceneObject.id, 
                    url, "bim.json", "text", $q);
        }
        
        if (!sceneJson.hasOwnProperty("scene.xml")) {
            return $q.reject("no scene information for this model.");
        }

        var suffix = sceneJson["source"].split('.').pop();
        var hasBimInfo = (suffix === "rvt" || suffix === "ifc");
        
        var that = this;
        var onprogress1 = progressTracker.getSingleFileProgress();
        return modelFilePromises["scene.xml"].downloadFile()
            .then(function(res) {
                var sceneXmlLoader = null;
                if (hasBimInfo) {
                    sceneXmlLoader = new SceneXmlLoaderRevit(that._sceneObject);
                } else {
                    sceneXmlLoader = new SceneXmlLoaderOther(that._sceneObject);
                }
                sceneXmlLoader.load(res.data, sceneJson);

                if (sceneJson.hasOwnProperty("bim.json") && hasBimInfo) {
                    var onprogress2 = progressTracker.getSingleFileProgress();
                    return modelFilePromises["bim.json"].downloadFile()
                        .then(function(res) {
                            var bimLoader = new BimLoaderRevit(that._sceneObject, that._resourceManager);
                            bimLoader.load(res.data);
                        }, null, function(eventData) {
                            onprogress2(eventData.loaded);
                        });
                }
            }, null, function(eventData) {
                onprogress1(eventData.loaded);
            });

    };

    return SceneLoader;

})();
