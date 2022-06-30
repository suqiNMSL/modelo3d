//
// m3d_load_pano.js
// Load the 360 image
//
//  

import Globals from "../m3d_globals.js";
import SkyBox  from "../03scene/drawables/m3d_skybox.js"

export default (function() {
    "use strict";

    // When useLocalServer is true, we will download the model file from the local
    // server which is for debugging purpose.
    function LoadPano(sceneId, leftSkybox, rightSkybox, resourceManager) {
        this._$q              = Globals.frontendCallbacks.getPromiseLibrary();

        this._useLocalServer  = (sceneId === "551d4326e437414c17000005");
        this._sceneId         = sceneId;
        this._leftSkybox      = leftSkybox;
        this._rightSkybox     = rightSkybox;
        this._resourceManager = resourceManager;

        this.cancelled        = false;
    }; 

    LoadPano.prototype.load = function(type, modelFilePromises, onComplete) {

        var that = this;
            
        var openFile = function(sceneId, url, filename, type) {
            return { 
                downloadFile: function() {
                    var deferred = that._$q.defer();

                    var progressCallback = function(eventData) {
                        //deferred.notify(eventData.lengthComputable? eventData.loaded / eventData.total : eventData.loaded);
                        deferred.notify(eventData);
                    };

                    try {
                        Globals.frontendCallbacks.downloadFileXHR(url, type, progressCallback).then(function(data) {
                            deferred.resolve(data);
                        });
                    } catch (e) {
                        console.log({"url": url, "type": type});
                        console.error(e);
                    }

                    return deferred.promise;
                }
            };
        };
        
        // Initialize the loading promises if it is in debug mode
        if (this._useLocalServer) {
            modelFilePromises = {};

            // 1 * 12 or 1 * 6 image
            // Check out comments in MOD-5555
            // TODO: how to get the file name or path from frontend
            //modelFilePromises["panorama.jpg"] = that._openImage(this._sceneId, "test3.jpg");
            modelFilePromises["panorama.json"] = openFile(this._sceneId, "/downloadpanorama/" + this._sceneId, 
                    "panorama.json", "json");
            type = "360image";
        }

        // Detect the panorama types
        if (type === "360image") {
            if (this._leftSkybox) {
                this._leftSkybox.setMode(SkyBox.SKYBOX_CUBEMAP);
                if (this._rightSkybox) {
                    this._rightSkybox.setMode(SkyBox.SKYBOX_CUBEMAP);
                }
            }
            return this._loadImage360(modelFilePromises, onComplete);
        } else if (type === "360imagecomp") {
            if (this._leftSkybox) {
                this._leftSkybox.setMode(SkyBox.SKYBOX_CUBEMAP);
                if (this._rightSkybox) {
                    this._rightSkybox.setMode(SkyBox.SKYBOX_CUBEMAP);
                }
            }
            return this._loadImage360Comp(modelFilePromises, onComplete);
        } else if (type === "360rect") {
            if (this._leftSkybox) {
                this._leftSkybox.setMode(SkyBox.SKYBOX_EQUIRECTANGLE);
                if (this._rightSkybox) {
                    this._rightSkybox.setMode(SkyBox.SKYBOX_EQUIRECTANGLE);
                }
            }
            return this._loadImageOther(modelFilePromises, onComplete);
        } else {
            return this._$q.reject("unsupport panorama format");
        }
    };

    LoadPano.prototype._loadImage360 = function(modelFilePromises, onComplete) {
        var that = this;
        var sceneData = null;

        return modelFilePromises["panorama.json"].downloadFile()
            .then(function(data) {
                if (that.cancelled) {
                    return;
                }

                if (typeof(data) === "string") {
                    sceneData = JSON.parse(data);
                } else {
                    sceneData = data;
                }
                
                var leftPromises = [];
                var rightPromises = [];
                function FetchImage(uri) {
                    if (that._useLocalServer) {
                        var promise = that._openImage(that._sceneId, uri);
                        return that._loadImage(promise, sceneData);
                    } else {
                        return modelFilePromises[uri].downloadFile();
                    }
                };
                
                var imageData;
                
                if (!Globals.isMobile) {
                    imageData = sceneData["cubemaps"][sceneData["cubemaps"].length - 1];
                } else {
                    var resolution = Math.max(Globals.width, Globals.height);
                    var min = Number.MAX_VALUE;
                    for (var i = 0; i < sceneData["cubemaps"].length; i++) {
                        var diff = Math.abs(resolution - sceneData["cubemaps"][i]["resolution"]);
                        if (min > diff) {
                            min = diff;
                            imageData = sceneData["cubemaps"][i];
                        }
                    }
                }
                
                leftPromises.push(FetchImage(imageData["left-negx"]));
                leftPromises.push(FetchImage(imageData["left-negy"]));
                leftPromises.push(FetchImage(imageData["left-negz"]));
                leftPromises.push(FetchImage(imageData["left-posx"]));
                leftPromises.push(FetchImage(imageData["left-posy"]));
                leftPromises.push(FetchImage(imageData["left-posz"]));

                if (imageData.hasOwnProperty("right-posx") && that._rightSkybox) {
                    rightPromises.push(FetchImage(imageData["right-negx"]));
                    rightPromises.push(FetchImage(imageData["right-negy"]));
                    rightPromises.push(FetchImage(imageData["right-negz"]));
                    rightPromises.push(FetchImage(imageData["right-posx"]));
                    rightPromises.push(FetchImage(imageData["right-posy"]));
                    rightPromises.push(FetchImage(imageData["right-posz"]));
                }

                return that._$q.all(leftPromises).then(function(leftImages) {
                        if (that.cancelled) {
                            return;
                        }

                        if (that._leftSkybox) {
                            that._leftSkybox.setImage(leftImages);
                        }
                        
                        if (rightPromises.length === 0) {
                            if (that._rightSkybox) {
                                that._rightSkybox.setImage(leftImages);
                            }
                            onComplete(sceneData);
                            return {supportVR: !!that._rightSkybox};
                        }
                        
                        return that._$q.all(rightPromises).then(function(rightImages) {
                            if (that.cancelled) {
                                return;
                            }

                            if (that._rightSkybox) {
                                that._rightSkybox.setImage(rightImages);
                            }
                            onComplete(sceneData);
                            return {supportVR: !!that._rightSkybox};
                        });
                });
            });
    };
    
    // This function loads a long composited panorama image. It's a combination of all 6 or 12 images.
    // So we need to split it into patches then use the patches for rendering skybox
    LoadPano.prototype._loadImage360Comp = function(modelFilePromises, onComplete) {
        var that = this;

        var promise = null;
        for (var p in modelFilePromises) {
            if (p.match(/.jpg$/i) || 
                p.match(/.jpeg$/i) || 
                p.match(/.png$/i)) {
                promise = modelFilePromises[p];
                break;
            }
        }
        // The image is composed of 6x1 of cube face image. The face order is
        // pos-x, neg-x, pos-y, neg-y, pos-z, neg-z.
        //
        // The coordinate is right hand with y up and x to the right.
        var faceOrder = [1, 3,  5, 0, 2, 4, 
                         7, 9, 11, 6, 8, 10];

        return promise.downloadFile()
            .then(function(image) {
                var numPatches = image.width / image.height;
                
                if (numPatches !== 12 && numPatches !== 6) {
                    console.error("image size is not right!");
                    return;
                }
                
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                
                // Each patch should has same width and height
                canvas.width = image.height;
                canvas.height = image.height;
                   
                function FetchImage(i) {
                    var deferred = that._$q.defer();
                    
                    ctx.drawImage(image, faceOrder[i] * image.height, 0, image.height, image.height, 
                        0, 0, image.height, image.height);
        
                    //create a new image
                    var imgPatch = new Image();
                    imgPatch.name = "patch_" + i;
                    imgPatch.crossOrigin = "";
                    imgPatch.onload = function(){
                        deferred.resolve(this);
                    };
                    imgPatch.onerror = function() {
                        deferred.reject();
                    };
                    imgPatch.src = canvas.toDataURL("image/png");

                    return deferred.promise;
                };

                var i = 0;
                var leftPromises = [];
                for (i = 0; i < 6; i++) {
                    leftPromises.push(FetchImage(i));
                }
                var rightPromises = [];
                for (; i < numPatches; i++) {
                    rightPromises.push(FetchImage(i));
                }
        
                return that._$q.all(leftPromises).then(function(leftImages) {
                    if (that._rightSkybox) {
                        that._leftSkybox.setImage(leftImages);
                    }
                    if (rightPromises.length > 0) {
                        return that._$q.all(rightPromises).then(function(rightImages) {
                            if (that._rightSkybox) {
                                that._rightSkybox.setImage(rightImages);
                            }
                            onComplete(null);
                            return {supportVR: !!that._rightSkybox};
                        });
                    } else {
                        if (that._rightSkybox) {
                            that._rightSkybox.setImage(leftImages);
                        }
                        onComplete(null);
                        return {supportVR: !!that._rightSkybox};
                    }
                });
            });
    };
    
    LoadPano.prototype._loadImageOther = function(modelFilePromises, onComplete) {
        var promise = null;
        for (var p in modelFilePromises) {
            if (p.match(/.jpg$/i) || 
                p.match(/.jpeg$/i) || 
                p.match(/.png$/i)) {
                promise = modelFilePromises[p];
                break;
            }
        }

        var that = this;
        return promise.downloadFile()
            .then(function(image) {
                
                var deferred = that._$q.defer();
                var width = image.width;
                var height = image.height;

                if (width > 4096 || height > 4096) {
                    var l = Math.max(width, height);
                    var scaling = 4096 / l;
                    width *= scaling;
                    height *= scaling;
                    width = Math.min(width, 4096);
                    height = Math.min(height, 4096);

                    var canvas = document.createElement('canvas');
                    var ctx = canvas.getContext('2d');
                    
                    // Each patch should has same width and height
                    canvas.width = width;
                    canvas.height = height;
                       
                    var deferred = that._$q.defer();
                    
                    ctx.drawImage(image, 0, 0, image.width, image.height,
                        0, 0, width, height);
        
                    var imageResized = new Image();
                    imageResized.name = image.name;
                    imageResized.crossOrigin = "";
                    imageResized.onload = function(){
                        deferred.resolve(this);
                    };
                    imageResized.onerror = function() {
                        deferred.reject();
                    };
                    imageResized.src = canvas.toDataURL("image/png");
                } else {
                    deferred.resolve(image);
                }

                return deferred.promise;
            })
            .then(function(image) {
                if (that._leftSkybox) {
                    that._leftSkybox.setImage(image);
                }
                
                if (that._rightSkybox) {
                    that._rightSkybox.setImage(image);
                }
                
                onComplete(null);
                return {supportVR: !!that._rightSkybox};
            });
    };
    
    LoadPano.prototype._openImage = function(sceneId, uri) {
        return {
                downloadFile: function() {
                    var url = "/textures/" + sceneId + "+" + uri;
                    return Globals.frontendCallbacks.createImgElmFromUrl(url);
                }
        };
    };
    
    LoadPano.prototype._loadImage = function(promise, imageName) {
        var that = this;

        var deferred = that._$q.defer();
        
        promise.downloadFile().then(function(image) {
            image.name = imageName;
            deferred.resolve(image);
        });
            
        return deferred.promise;
    };

    return LoadPano;
})();
    
            

