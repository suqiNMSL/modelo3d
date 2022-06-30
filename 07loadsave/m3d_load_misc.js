//
// m3d_load_misc.js
// Misc helper functions for loading models
//
//  

import Globals from "../m3d_globals.js";

export default (function() {
    "use strict";

    var LoadMisc = {};

    LoadMisc.OpenFile = function(sceneId, url, filename, type, $q) {
        return { 
            downloadFile: function() {
                var deferred = $q.defer();

                var progressCallback = function(eventData) {
                    //deferred.notify(eventData.lengthComputable? eventData.loaded / eventData.total : eventData.loaded);
                    deferred.notify(eventData);
                };

                try {
                    Globals.frontendCallbacks.downloadFileXHR(url, type, progressCallback).then(function(data) {
                    //httpRequest.get(url, type, progressCallback).then(function(data) {
                        var res = { "filename": filename, "data": data };
                        deferred.resolve(res);
                        res = null;
                    });
                } catch (e) {
                    console.log({"url": url, "type": type});
                    console.error(e);
                }

                return deferred.promise;
            }
        };
    };

    LoadMisc.OpenImage = function(sceneId, uri) {
        return {
            downloadFile: function() {
                var url = "/local/" + sceneId + "/" + uri;
                return Globals.frontendCallbacks.createImgElmFromUrl(url);
            }
        };
    };

    LoadMisc.ProgressTracker = function(onProgress) {
        this._onProgress = onProgress;

        this._currentDownload = 0;
        this.totalDownload = 0;
    };

    LoadMisc.ProgressTracker.prototype.onProgress = function(deltaProgress) {
        this._currentDownload += deltaProgress;
        this._onProgress(Math.max(Math.min(this._currentDownload / this.totalDownload, 1.0), 0.0));
    };
    
    LoadMisc.ProgressTracker.prototype.getSingleFileProgress = function() {
        var downloaded = 0;

        var that = this;
        return function(loaded) {
            var deltaDownloaded = loaded - downloaded;
            downloaded = loaded;
            that.onProgress(deltaDownloaded);
        };
    };

    LoadMisc.MakeIndividualOnProgress = function(onProgress) {
        var downloaded = 0;

        return function(loaded) {
            var deltaDownloaded = loaded - downloaded;
            downloaded = loaded;
            onProgress.onprogress(deltaDownloaded);
        };
    };

    return LoadMisc;
})();
