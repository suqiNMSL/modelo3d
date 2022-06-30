//
// m3d_panorama.js
// Local panorama control class, different with image360
//
//  


import Globals      from "../../m3d_globals.js";
import MyMath       from "../../00utility/m3d_math.js";
import SceneCamera  from "../../03scene/camera/m3d_scene_camera.js";
import SkyBox       from "../../03scene/drawables/m3d_skybox.js";
import Blit         from "../../04renderer/m3d_blit.js";
import RenderTarget from "../../04renderer/m3d_rendertarget.js";
import LoadPano     from "../../07loadsave/m3d_load_pano.js";

export default (function() {
    "use strict";
    
    function Panorama(resourceManager, orientation, commentManager, eventEmitter) {
        this.enabled          = false;

        this._commentManager  = commentManager;
        this._ready           = false;
        this._resourceManager = resourceManager;
        this._renderTarget    = null;
        this._commentsRays    = [];
        
        this._eventEmitter    = eventEmitter;
        this._viewDirection   = vec3.create();
        this._position        = vec3.create(); // the world position of panorama in the scene
        
        this._renderTarget = new RenderTarget("default", this._resourceManager, 
                                    Globals.width, Globals.height, { depthFunc: gl.LEQUAL });
        
        this._leftSkybox = new SkyBox(this._resourceManager, "left");
        this._leftSkybox.setMode(SkyBox.SKYBOX_PANORAMA);
 
        this._rightSkybox = new SkyBox(this._resourceManager, "right");
        this._rightSkybox.setMode(SkyBox.SKYBOX_PANORAMA);
 
        this._camera = new SceneCamera(null);
        this._camera.setCullingEnabled(false);
        this._camera.setFirstPerson(true);
        vec3.set(this._camera.eye, 0, 0, 0);
    };
    
    Panorama.prototype.destroy = function() {
        this._camera  = null;
        this._renderTarget    = null;
        this._commentsRays    = [];
        this._ready = false;
    };
    
    Panorama.prototype._load = function(modelInformation, promises, type, cameraData) {
        this._ready = false;
        var loader = new LoadPano(modelInformation.modelId, this._leftSkybox, 
                this._rightSkybox, this._resourceManager);

        var that = this;
        return loader.load(type, promises,
                function(sceneData) {
                    if (cameraData) {
                        that._camera.setTargetFov(cameraData.fov);
                        that._camera._targetPhi = cameraData.phi;
                        that._camera._targetTheta = cameraData.theta;
                    } else {
                        that._camera.setTargetFov(75.0);
                        that._camera._targetPhi = 0;
                        that._camera._targetTheta = 0;
                    }
                    that._ready = true;
                }
            );
    }; 
    
    Panorama.prototype.resize = function(width, height) {
        if (this._renderTarget) {
            this._renderTarget.resize(width, height);
            this._camera.resize(width, height);
            this._camera.update();
        }
    };
    
    Panorama.prototype.onMouseMove = function(mouse) {
        if (mouse.event.buttonDown === 1 && this.enabled) {
            this._camera.rotate(-mouse.dx * 0.45, -mouse.dy * 0.45);
        } 
    };
    
    Panorama.prototype.onMouseWheel = function(mouse) {
        if (!this.enabled) {
            return;
        }
        var fov = this._camera.getTargetFov() + (mouse.delta > 0? 1.0 : -1.0);
        this._camera.setTargetFov(fov);
    };
        
    Panorama.prototype.render = function(renderer) {
        if (this.enabled && this._ready) {
            renderer.clear(this._renderTarget, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            this._camera.update();

            renderer.drawSkybox(this._renderTarget, this._leftSkybox, this._camera);

            vec3.set(this._viewDirection, 
                        -this._camera.viewMatrix[2], 
                        -this._camera.viewMatrix[6], 
                        -this._camera.viewMatrix[10]);
           
            var res = [];
            for (var i = 0, len = this._commentsRays.length; i < len; i++) {
                var angle = vec3.dot(this._commentsRays[i].direction, this._viewDirection);
                var screenPosition = this._camera.project(this._commentsRays[i].position);
                res.push({ 
                        id: this._commentsRays[i].id,
                        screenPosition: [screenPosition[0], screenPosition[1]],
                        visible: (angle > 0.923 && screenPosition[2]) ? true : false
                    });
            }

            if (res.length > 0) {
                this._eventEmitter.emit("updatePanoramaIndicator", res);
            }
        }
    };
    
    
    Panorama.prototype.setEnabled = function(enabled) {
        if (Globals.isMobile) {
            console.warn("Panorama is not currently supported on Model Page Mobile");
            return;
        }
        
        if (this.enabled !== enabled) {
            this.enabled = enabled;
        }
    };

    /*
     * @description update the panorama data
     * @param {object} modelInformation - the model information
     * @param {array} promises - the array of image download methods
     * @param {object} type - the type of the panorama
     * @param {array} comments - the array of comments data
     * @param {vec3} position - the world position of this panorama
     * @param {object} cameraData - the data for setting up the camera
     */
    Panorama.prototype.update = function(modelInformation, promises, type, comments, position, cameraData) {
        if (!this.enabled) {
            return Globals.frontendCallbacks.getPromiseLibrary().resolve("not ready");
        }
        this._commentsRays = [];
        vec3.copy(this._position, position);
        for (var i = 0, len = comments.length; i < len; i++) {
            this._commentsRays.push({
                id: comments[i].reviewId,
                position: vec3.create(),
                direction: vec3.create() 
            });
            
            vec3.subtract(this._commentsRays[i].position, comments[i].renderData.position, this._position);
            vec3.normalize(this._commentsRays[i].direction, this._commentsRays[i].position); 
        }

        return this._load(modelInformation, promises, type, cameraData);
    };
    

    return Panorama;    
})();
