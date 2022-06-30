//
// m3d_in_app_navigation.js
// The navigation control with user defined path
//
//  


import Globals                  from "../../m3d_globals.js";
import MyMath                   from "../../00utility/m3d_math.js";
import SceneCamera              from "../../03scene/camera/m3d_scene_camera.js";
import CameraAnimatorNavigate   from "../../03scene/camera/m3d_camera_animator_navigate.js"
import CameraAnimatorTransition from "../../03scene/camera/m3d_camera_animator_transition.js"
import RenderTarget             from "../../04renderer/m3d_rendertarget.js";
import DepthQuery               from "./m3d_depth_query.js";

export default (function() {
    "use strict";

    /**
     * @description The constructor of modelo3d InAppNavigation object which provides the functions of user defined navigation paths.
     * @constructor
     * @param {object} camera - the camera object.
     * @param {object} scene - the scene object.
     * @param {object} renderer - the renderer object.
     * @param {object} resourceManager - the resourceManager object.
     */
    function InAppNavigation(camera, scene, renderer, resourceManager) {
        // private:
        this._enabled                  = false;
        this._floorPlan                = false;
        this._camera                   = camera;
        this._scene                    = scene;
        this._resourceManager          = resourceManager;
        this._renderer                 = renderer;

        this.Keypoint                  = function() {                       // Keypoint is the keypoint on the navigation path
                                            this.eye3d = vec3.create();     // specified by user input.
                                            this.at3d  = vec3.create();
                                            this.eye2d = vec2.create();
                                            this.at2d  = vec2.create();
                                            this.adjust = 1.0;
                                            this.angleDiff = 0.0;
                                        };
        this._keypoints                = [];                                // List saving the key points, includes several Keypoints
        this._trajectories             = [];                                // List saving height trajectory between two key points in 3d world
        this._distances                = [];                                // The distance table of current keypoint to the first one.
        this._mileage                  = 0                                  // The travelled distance after navigation starts
        this._speed                    = 0.08;                              // camera move speed
        this.mapWidth                  = 1000;
        this.mapHeight                 = 1000;
        this._cameraHeight             = Number.MIN_VALUE;                  // The height of camera r.w.t the world space origin
        this.ORDINARY_PEOPLE_HEIGHT    = 5.5 / this._scene.scaleRatio;      // height from the floor. 5.41333 feets is 1.6764 meters

        this._state                    = 0;                                 // 0: on the way to the 1st keypoint,
                                                                            // 1: arriving at the 1st keypoint
                                                                            // 2: during navigation

        this._lod                      = {
                                            level: 0,                       // record the biggest mini map level to decide how many patches to use
                                                                            // 1: 1 * 1 = 1 patch
                                                                            // 2: 2 * 2 = 4 patches
                                                                            // 3: 3 * 3 = 9 patches and so on
                                                                            
                                            depthbuffers: [],               // array of depth buffers
                                            inversedVPMatrices: [],         // array of depth inversed VP matrices
                                          };
        
        //God view camera info
        this._godView                  = new SceneCamera(this._scene);
        this._godView._perspective     = false;
        this._godView.resize           = function() {};
        this._godView.update           = function() {};
        this._godView.invertVPMatrix    = mat4.create();
        //LOD view camera info
        this._lodCamera                = new SceneCamera(this._scene);
        this._lodCamera._perspective   = false;
        this._lodCamera.resize         = function() {};
        this._lodCamera.update         = function() {};
        
        this._renderTarget             = null;
        this._depthQuery               = null;
        this._miniMap                  = null;
        this._sceneScale               = 1;
        this._animator                 = new CameraAnimatorNavigate();
        this._at3d                     = vec3.create();                     // current look-at position in world space
        this._at2d                     = vec2.create();                     // current look-at position in mini-amp
        this._tmpAt                    = vec3.create();                     // tmp at value for saving memory
        this._tmpKeypoint              = new this.Keypoint();               // tmp keypoint value for saving memory
    };

    /**
     * @description Need a clean exit when the scene is about to reload. Otherwise
     * it will cause significant memory leak.
     */
    InAppNavigation.prototype.destroy = function() {
        this._keypoints    = null;
        this._distances    = null;
        this._depthQuery   = null;
        this._renderTarget = null;
        this._lod          = null;
    };

    /**
     * @description enable or disable the in app navigation mode.
     * @param {boolean} enabled - true for enable or false for disable.
     */
    InAppNavigation.prototype.setEnabled = function(enabled) {
        this._enabled = enabled;
        if (enabled) {
            if (!this._renderTarget) {
                this._renderTarget = new RenderTarget("inapp", this._resourceManager,
                                this.mapWidth, this.mapHeight, { clearColor: [0, 0, 0, 0] });
                
                var bboxSize = MyMath.aabb.size(this._scene.clipping.get());
                
                var length = Math.max(bboxSize.width, bboxSize.height) * this._scene.scaleRatio;
                
                // convert length to meter
                switch(this._scene.unit) {
                    case "feet" :
                        length *= 0.3048;                   
                    break;
                    
                    case "cm" :
                        length *= 0.01 * 30.48;
                    break;
                    
                    case "m" :
                        length *= 0.3048;
                    break;
                    
                    case "in":
                        length *= 0.0254 * 12;
                    break;
                }
                // every 80m, we increase one level
                var level = Math.ceil(length / 80);
                // clamp the level from 1 to 3, too big will cause speed issue
                // if level is 1, which means the depth map is only one 1000 * 1000 images
                // if level is 2, which means the depth map is 2 * 2 = 4 patches, each is 1000 * 1000
                // and so on. The max level is 3, which means there will be 9 patches, each time update
                // depth map, the scene will draw 9 times. I think 9 patches is big enough already.
                level = Math.min(Math.max(level, 1), 3);
                
                this._setLOD(level);
            }
            if (!this._depthQuery) {
                this._depthQuery = new DepthQuery(this._scene, this._resourceManager);
            }
        }
    };

    InAppNavigation.prototype.setFloorPlanEnabled = function(enabled) {
        this._floorPlan = true;
    };
    
    InAppNavigation.prototype._setLOD = function(level) {
        this._lod.level = level;
        this._lod.depthbuffers = [];
        this._lod.inversedVPMatrices = [];
        for (var i = 0; i < this._lod.level * this._lod.level; i++) {
            this._lod.depthbuffers.push(new Uint8Array(this.mapWidth * this.mapHeight * 4));
            this._lod.inversedVPMatrices.push(mat4.create());
        }
    };
    
    /**
     * @description check if the in app navigation mode is enabled.
     * @return {boolean}
     */
    InAppNavigation.prototype.isEnabled = function() {
        return this._enabled;
    };

    /**
     * @description Add a new key point into the keypoint list
     * @param {integer} x - the x coord.
     * @param {integer} y - the y coord.
     * @return {object} keypoint which includes the screen eye coord, at coord, 3d scene's eye position
     * and at position
     */
    InAppNavigation.prototype.addKeyPoint = function (x, y) {
        // generate key point
        var keypoint = new this.Keypoint();
        vec3.copy(keypoint.eye3d, this._camera.eye);
        vec2.copy(keypoint.eye2d, [x, y]);
        vec3.copy(keypoint.at3d, [this._at3d[0], this._at3d[1] , this._camera.eye[2]]);
        vec2.copy(keypoint.at2d, this._at2d);

        // normalize look at point
        var distance = vec3.distance(keypoint.at3d, keypoint.eye3d);
        vec3.lerp(keypoint.at3d, keypoint.eye3d, keypoint.at3d, 1 / distance);

        // push into list
        this._keypoints.push(keypoint);
        this._calculateAdjust();
        var length = this._keypoints.length;
        if (length > 1) {
            //calculate distance from two key points
            var distance = vec3.distance(this._keypoints[length - 2].eye3d, this._keypoints[length - 1].eye3d);
            this._distances.push(distance + this._distances[this._distances.length - 1]);
            //calculate height path from point A to B, and save them
            this._trajectories.push([]);
            this._calculateTrajectory(length - 2);
        } else {
            this._distances.push(0);
        }
        this.restart();
        this.stop();
        return {keypoint: this._keypoints[length - 1]};
    };

    /**
     * @description Adjust an exsiting key point's eye position and update trajectory
     * @param {integer} idx - the index in the key point list.
     * @param {integer} x - the x coord.
     * @param {integer} y - the y coord.
     * @return {boolean} true if the x, y position is valid in the 3D scene, false if not.
     */
    InAppNavigation.prototype.adjustPathPoint = function(idx, x, y) {
        var worldPosition = this._getWorldPosition(x, y);
        if (worldPosition === null) {
            return false;
        }
        vec3.copy(this._keypoints[idx].eye3d, worldPosition);
        vec2.copy(this._keypoints[idx].eye2d, [x, y]);
        this._calculateAdjust();
        //TODO: start from idx instead of re-calculating to save time
        this._distances = [];
        this._distances.push(0);
        for(var i = 1; i < this._keypoints.length; i++) {
            var distance = vec3.distance(this._keypoints[i - 1].eye3d, this._keypoints[i].eye3d);
            this._distances.push(distance + this._distances[this._distances.length - 1]);
        }

        var length = this._trajectories.length;
        // no trajectories exists
        if (length === 0) {
            return true;
        }

        this._calculateTrajectory(idx);
        this._calculateTrajectory(idx - 1);
        return true;
    };

    /**
     * @description Adjust an existing key point's at position both in 2d and 3d
     * @param {integer} idx - the index in the key point list.
     * @param {integer} x - the x coord.
     * @param {integer} y - the y coord.
     * @return {boolean} true if the x, y position is valid in the 3D scene, false if not.
     */
    InAppNavigation.prototype.adjustFocusPoint = function(idx, x, y) {
        var worldPosition = this._getWorldPosition(x, y);
        this._keypoints[idx].at3d[0] = worldPosition[0];
        this._keypoints[idx].at3d[1] = worldPosition[1];
        this._keypoints[idx].at2d[0] = x;
        this._keypoints[idx].at2d[1] = y;
        this._calculateAdjust();
        
        // normalize look at point
        var distance = vec3.distance(this._keypoints[idx].at3d, this._keypoints[idx].eye3d);
        vec3.lerp(this._keypoints[idx].at3d, this._keypoints[idx].eye3d, this._keypoints[idx].at3d, 1 / distance);
        this.restart();

        return {keypoint: this._keypoints[idx]};
    };

    /**
     * @description Delete a key point by it's index
     * @param {integer} idx - the index in the key point list.
     */
    InAppNavigation.prototype.deleteKeyPoint = function(idx) {
        for (var i = idx; i < this._keypoints.length - 1; i++) {
            this._keypoints[i] = this._keypoints[i + 1];
        }
        this._keypoints.pop();
        this._calculateAdjust();
        //TODO: start from idx instead of re-calculating to save time
        this._distances = [];
        if (this._keypoints.length > 1) {
            this._distances.push(0);
            for(var i = 1; i < this._keypoints.length; i++) {
                var distance = vec3.distance(this._keypoints[i - 1].eye3d, this._keypoints[i].eye3d);
                this._distances.push(distance + this._distances[this._distances.length - 1]);
            }
        }
        

        for (var i = idx; i < this._trajectories.length - 1; i++) {
            this._trajectories[i] = this._trajectories[i + 1];
        }
        this._trajectories.pop();
        this._calculateTrajectory(idx - 1);
        this.restart();
    };

    /**
     * @description Update the camera using the navigation path and elapsed time since navigation starts.
     * @return {object} The return value is the if the navigation moves and the 2D point on navigation path
     *                  and progress
     */
    InAppNavigation.prototype.navigate = function(stepFraction) {
        if (!this._enabled) {
            return { update: false, info: null, progress: 0.0 };
        }
        
        // Before starting the navigation, first jump to the first point
        if (this._state === 0) {
            vec3.copy(this._camera.eye, this._keypoints[0].eye3d);
            vec3.copy(this._camera._at, this._keypoints[0].at3d);
            this._moveTo(this._keypoints[0].eye3d, this._keypoints[0].at3d);
            this._state++;
            return { update: true, info: null, progress: 0.0 };
        // When arriving to the 1st key point, we start walking the navigation path.
        }

        // 1st Check if we reach the end.
        if (this._mileage >= this._distances[this._distances.length - 1]) {
            var eye2d = this._keypoints[this._keypoints.length - 1].eye2d;
            var at2d = this._keypoints[this._keypoints.length - 1].at2d;
            return { update: false, info: vec4.fromValues(eye2d[0], eye2d[1], at2d[0], at2d[1]), progress: 1.0 };
        }

        // Find the position of the navigation.
        var keypoint = 0;

        // A veteran programmer should always use binary search here. However,
        // since there is no many keypoints (< 50), linear search won't be much less efficient.
        for (keypoint = 0; keypoint < this._keypoints.length; keypoint++) {
            if (this._distances[keypoint] > this._mileage) {
                keypoint -= 1;
                break;
            }
        }
        
        // Keep walking at constant speed in every navigate(). Since navigate is called
        // at a constant frequency, we ensure the movement is smooth.
        var fraction = stepFraction ? (stepFraction * this._keypoints[keypoint].adjust) : 1;
        this._mileage += (this._speed * fraction);
        
        if (this._mileage > this._distances[keypoint + 1]) {
            keypoint++;
        }
        var prog = 0;
        
        if (keypoint < this._keypoints.length-1) {
            var ratio = (this._mileage - this._distances[keypoint]) / (this._distances[keypoint + 1] - this._distances[keypoint]);

            vec3.lerp(this._tmpKeypoint.eye3d, this._keypoints[keypoint].eye3d, this._keypoints[keypoint + 1].eye3d, ratio);
            vec3.lerp(this._tmpKeypoint.eye2d, this._keypoints[keypoint].eye2d, this._keypoints[keypoint + 1].eye2d, ratio);
            if (this._keypoints[keypoint].adjust !== 1) {
                vec3.rotateZ(this._tmpKeypoint.at3d, this._keypoints[keypoint].at3d, this._keypoints[keypoint].eye3d, -this._keypoints[keypoint].angleDiff * ratio);
                vec3.subtract(this._tmpKeypoint.at3d, this._tmpKeypoint.at3d, this._keypoints[keypoint].eye3d);
                vec3.add(this._tmpKeypoint.at3d, this._tmpKeypoint.at3d, this._tmpKeypoint.eye3d);
                
                vec2.rotate(this._tmpKeypoint.at2d, this._keypoints[keypoint].at2d, this._keypoints[keypoint].eye2d, this._keypoints[keypoint].angleDiff * ratio)
                vec3.subtract(this._tmpKeypoint.at2d, this._tmpKeypoint.at2d, this._keypoints[keypoint].eye2d);
                vec3.add(this._tmpKeypoint.at2d, this._tmpKeypoint.at2d, this._tmpKeypoint.eye2d);
            } else {
                vec3.lerp(this._tmpKeypoint.at3d,  this._keypoints[keypoint].at3d,  this._keypoints[keypoint + 1].at3d,  ratio);
                vec3.lerp(this._tmpKeypoint.at2d,  this._keypoints[keypoint].at2d,  this._keypoints[keypoint + 1].at2d,  ratio);
            }

            // Get the height from the saved list
            var num = this._trajectories[keypoint].length;
            var height = this._trajectories[keypoint][Math.floor(num * ratio)];
            this._tmpKeypoint.eye3d[2] = height;
            this._tmpKeypoint.at3d[2] = height;
            prog = this._mileage / this._distances[this._distances.length - 1];
        } else {
            vec3.copy(this._tmpKeypoint.eye3d, this._keypoints[this._keypoints.length - 1].eye3d);
            vec3.copy(this._tmpKeypoint.at3d,  this._keypoints[this._keypoints.length - 1].at3d);
            vec2.copy(this._tmpKeypoint.eye2d, this._keypoints[this._keypoints.length - 1].eye2d);
            vec2.copy(this._tmpKeypoint.at2d,  this._keypoints[this._keypoints.length - 1].at2d);
            prog = 1.0;
        }
        
        this._moveTo(this._tmpKeypoint.eye3d, this._tmpKeypoint.at3d);
        return { update: true, info: vec4.fromValues(this._tmpKeypoint.eye2d[0], this._tmpKeypoint.eye2d[1], this._tmpKeypoint.at2d[0], this._tmpKeypoint.at2d[1]), progress: prog};

    };

    /**
     * @description Jump to a point during the navigation by the ratio
     * @return {object} The return value is the if the navigation moves and the 2D point on navigation path
     *                  and progress
     */
    InAppNavigation.prototype.jumpTo = function(ratio) {
        this._state = 1;
        this._mileage = this._distances[this._distances.length - 1] * ratio;
        return this.navigate();
    };

    /**
     * @description Get the total steps
     * @return {int} step count
     */
    InAppNavigation.prototype.getSteps = function() {
        return Math.floor(this._distances[this._distances.length - 1] / this._speed);
    };

    /**
     * @description Add a new key point into the keypoint list
     * @param {integer} x - the x coord.
     * @param {integer} y - the y coord.
     * @return {object} keypoint which includes the screen eye coord, at coord, 3d scene's eye position
     * and at position
     */
    // Restart the navigation from the beginning.
    InAppNavigation.prototype.restart = function() {
        this._state    = 0;
        this._mileage  = 0;
    };

    /**
     * @description Load path data from the server
     * @param {object} data - navigation path info from the server.
     * @return {boolean} return true if the current height is different from the loaded height
     */
    InAppNavigation.prototype.loadData = function(data) {
        var isUpdateMap = false;

        this._clearData();
        
        var i, j;
        for (i = 0; i < data.points.length; i++) {
            var keypoint = new this.Keypoint();
            keypoint.eye2d = [data.points[i].x, data.points[i].y];
            keypoint.eye3d = data.points[i].eye3d.slice(0);
            keypoint.at2d = [data.points[i].targetX, data.points[i].targetY];
            keypoint.at3d = data.points[i].at3d.slice(0);

            this._keypoints.push(keypoint);
        }
        this._calculateAdjust();
        
        if (typeof data.trajectories === "string") {
            var trajectories = LZString.decompressFromEncodedURIComponent(data.trajectories);
        
            var tmp = trajectories.split("-");
            for (i = 0; i < tmp.length-1; i++) {
                this._trajectories.push([]);
                var tmp2 = tmp[i].split(",");
                for (j = 0; j < tmp2.length-1; j++) {
                    this._trajectories[this._trajectories.length-1].push(Number(tmp2[j]));
                }
            }
        } else {
            this._trajectories = data.trajectories;
        }

        // When current floor height is different from required one, we
        // need to regenerate the minimap.
        if (Math.abs(this._cameraHeight - this._keypoints[0].eye3d[2]) > 1e-3){
            this._cameraHeight = this._keypoints[0].eye3d[2];
            isUpdateMap = true;
        }
        this._distances.push(0);
        for (i = 1; i < this._keypoints.length; i++) {
            var distance = vec3.distance(this._keypoints[i - 1].eye3d, this._keypoints[i].eye3d);
            this._distances.push(distance + this._distances[this._distances.length - 1]);
        }
        this.restart();
        return isUpdateMap;
    };

    /**
     * @description Add the starting point of the navigation, and the camera will move to the point
     * @param {integer} x - the x coord.
     * @param {integer} y - the y coord.
     * @return {object} return a 3D position if pin point to a valid position otherwise null.
     */
    // Add the starting point of the navigation.
    InAppNavigation.prototype.pinPoint = function(x, y) {
        var worldPosition = this._depthQuery.unproject(x, y, this._renderer, this._camera);
        if (worldPosition !== null) {
            this._clearData();

            worldPosition[2] += this.ORDINARY_PEOPLE_HEIGHT;
            this._cameraHeight = worldPosition[2];

            // When we're done with the navigating from current camera
            // to the first pin point, we want the camera look parallelly to
            // the ground. That is how we create the at.
            var lookat = vec3.create();
            vec3.lerp(lookat, this._camera.eye, worldPosition, 1.01);
            lookat[2] = worldPosition[2];
            this._moveTo(worldPosition, lookat);

            return worldPosition;
        }
        return null;
    };

    /**
     * @description Dump the depth map into a buffer for getting the correct height during the navigation
     * @return {null} return nothing
     */
    InAppNavigation.prototype.generateDepthMap = function() {
        
        if (this._lod.level === 1) {
            this._renderDepthMap(this._godView, 0);
        } else {
            var bbox = this._scene.clipping.get();
            var modelSize = MyMath.aabb.size(bbox);
            var mapSize = Math.max(modelSize.width, modelSize.height) * 1.1;
            var range = mapSize / this._lod.level * 0.5;
            
            for (var y = 0; y < this._lod.level; y++) { //y coord
                for (var x = 0; x < this._lod.level; x++) { //x coord
                    //generate a tight split view
                    this._renderTarget.resize(this.mapWidth, this.mapHeight);
                    
                    this._lodCamera.eye[0] = (bbox[0] + bbox[3]) * 0.5 + (x / this._lod.level + 0.5 / this._lod.level - 0.5) * mapSize;
                    this._lodCamera.eye[1] = (bbox[1] + bbox[4]) * 0.5 + ((this._lod.level - 1 - y) / this._lod.level + 0.5 / this._lod.level - 0.5) * mapSize;
                    
                    this._lodCamera.eye[2] = this._cameraHeight + 0.01;

                    vec3.set(this._lodCamera._at, this._lodCamera.eye[0], this._lodCamera.eye[1], this._lodCamera.eye[2] - 1.01);
                    mat4.lookAt(this._lodCamera.viewMatrix, this._lodCamera.eye, this._lodCamera._at, [0, 1, 0]);

                    mat4.ortho(this._lodCamera.projectMatrix, -range, range, -range, range, 0.01, this._cameraHeight - bbox[2] + 0.02);

                    this._lodCamera.viewport = [0, 0, this.mapWidth, this.mapHeight];
                    mat4.multiply(this._lodCamera.vpMatrix, this._lodCamera.projectMatrix, this._lodCamera.viewMatrix);
                    this._lodCamera._cull.update();
                    
                    this._renderDepthMap(this._lodCamera, x + y * this._lod.level);
                }
            }
        }
    };

    InAppNavigation.prototype._renderDepthMap = function(camera, index) {
        this._renderer.invalidate();
        this._renderer.clear(this._renderTarget, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        if (this._scene.model) {
            this._renderer.drawDrawables(
                this._renderTarget,                  // target
                this._scene.model.drawables,               // drawables
                camera,                              // camera
                this._depthQuery._shaders,           // overridedShader
                this._depthQuery._material,          // target
                this._scene.clipping,
                null,
                null,
                this._scene.needRenderDoubleSided()? false : gl.CCW);
        }
        if (this._scene.terrain) {
            this._renderer.drawDrawables(
                this._renderTarget,                  // target
                this._scene.terrain.drawables,               // drawables
                camera,                              // camera
                this._depthQuery._shaders,           // overridedShader
                this._depthQuery._material,          // target
                this._scene.clipping,
                null,
                null,
                this._scene.needRenderDoubleSided()? false : gl.CCW);
        }

        
        gl.readPixels(0, 0, this.mapWidth, this.mapHeight, gl.RGBA, gl.UNSIGNED_BYTE, this._lod.depthbuffers[index]);
        mat4.invert(this._lod.inversedVPMatrices[index], camera.vpMatrix);
    };
    
    /**
     * @description Get the correct eye position and at position and move to there from the mini map's coord
     * @param {integer} x - the x coord of the eye.
     * @param {integer} y - the y coord of the eye.
     * @param {integer} tx - the x coord of the at.
     * @param {integer} ty - the y coord of the at.
     * @return {boolean} always true
     */
    InAppNavigation.prototype.lookAt = function(x, y, tx, ty) {
        if (this._floorPlan) {
            x *= this.mapWidth;
            y *= this.mapHeight;
            if (tx !== undefined && ty !== undefined) {
                tx *= this.mapWidth;
                ty *= this.mapHeight;
            }
        }
        
        var eye = this._getWorldPosition(x, y);
        if (tx !== undefined && ty !== undefined) {
            var at = this._getWorldPosition(tx, ty);
            vec3.set(this._at3d, at[0], at[1], eye[2]);
            vec3.set(this._at2d, tx, ty);

            if (vec3.distance(this._at3d, eye) < 1e-3){
                vec3.set(this._at3d, this._camera._at[0], this._camera._at[1], eye[2]);
            }

            this._moveTo(eye, this._at3d);
        } else {
            vec3.lerp(this._tmpAt, this._camera.eye, eye, 1.01);
            this._moveTo(eye, this._tmpAt);
        }

        return true;
    };

    /**
     * @description Set the mini map in the left corner of the page
     * @param {object} miniMap - the mini map image.
     * @return {null} - return nothing
     */
    InAppNavigation.prototype.setMiniMap = function(miniMap) {
        this._miniMap = miniMap;
    };

    /**
     * @description Set the mini map image
     * @return {object} the mini map image
     */
    InAppNavigation.prototype.getMiniMap = function() {
        return this._miniMap;
    };

    /**
     * @description  The minimap is 2000*2000 by default, but this size may not be enough for big model such as city.
     * |-----------|    So we want to have a close-up view.
     * |  minimap  |    example: eyeX = 0.5, eyeY = 0.5, widthRange = 0.5, heightRange = 0.5, imgWidth =2000, imgHeight = 2000
     * |           |    will get exactly same as the original minimap
     * |           |    example: eyeX = 0.0, eyeY = 0.0, widthRange = 0.5, heightRange = 0.5, imgWidth =2000, imgHeight = 2000
     * |-----------|    will get the following minimap
     *
     *      |<0.5>|
     * |----------|
     * |  new map |
     * |    |-----|----|
     * |    |     |    |
     * |----|-----|    |
     *      | original |
     *      |----------|
     * @param {integer} eyeX - the eye position relative to the model center in proportion to the width of model.
     * @param {integer} eyeY - ditto.
     * @param {float} widthRange - the half of width of camera proportion to the width of model
     * @param {float} heightRange - ditto.
     * @param {integer} imgWidth - final dumped image pixel width
     * @param {integer} imgHeight - final dumped image pixel height
     * @return {object} the god view camera matrix info
     */
    InAppNavigation.prototype.getGodView = function(eyeX, eyeY, widthRange, heightRange, imgWidth, imgHeight, resetScreenPosition) {
        this.mapWidth = imgWidth || 1000;
        this.mapHeight = imgHeight || 1000;
        
        //This two line of code is caused by the fact that the retina ration which has pixel ratio not 1 case.
        //(1.25, 1.5, 2.0 and so on), which means the real width and height after Math.floor of the canvas will not
        //be same as original size after resize.
        //The mini map is suppose to be 1000 * 1000, but if the device ratio is 1.5, 1000 / 1.5 = 666, 666 * 1.5 = 999
        //There will be one pixel different between render target and camera viewport. This can cause progressive 
        //rendering wrong.
        this.mapWidth = Math.floor(Math.floor(this.mapWidth / Globals.devicePixelRatio) * Globals.devicePixelRatio);
        this.mapHeight = Math.floor(Math.floor(this.mapHeight / Globals.devicePixelRatio) * Globals.devicePixelRatio);
        
        widthRange = widthRange || 1;
        heightRange = heightRange || 1;
        
        this._renderTarget.resize(this.mapWidth, this.mapHeight);

        var bbox = this._scene.clipping.get();
        MyMath.aabb.scale(bbox,bbox,this._sceneScale);
        
        var size = MyMath.aabb.size(bbox);

        var aspect = this.mapWidth / this.mapHeight;

        var width = size.height * 0.5 * 1.1; // times with 1.1 to add some blank region around the model in minimap.
        var height = size.width * 0.5 * 1.1;

        width = Math.max(aspect * height, width);
        height = width / aspect;

        //eyeX and eyeY should be during 0 ~ 1
        this._godView._perspective = false;
        if (eyeX && eyeY) {
            this._godView.eye[0] = (bbox[0] + bbox[3]) * 0.5 + (eyeY * 2 - 1) * width;
            this._godView.eye[1] = (bbox[1] + bbox[4]) * 0.5 + ((1.0-eyeX) * 2 - 1) * height;
            this._godView.eye[2] = this._cameraHeight + 0.01;        
        } else {
            vec3.set(this._godView.eye, (bbox[0] + bbox[3]) * 0.5, (bbox[1] + bbox[4]) * 0.5, this._cameraHeight + 0.01);
        }
        
        vec3.set(this._godView._at, this._godView.eye[0], this._godView.eye[1], this._godView.eye[2] - 1.01);
        mat4.lookAt(this._godView.viewMatrix, this._godView.eye, this._godView._at, [0, 1, 0]);

        width = widthRange ? width * widthRange : width;
        height = heightRange ? height * heightRange : height;
        mat4.ortho(this._godView.projectMatrix, -width, width, -height, height, 0.01, this._cameraHeight - bbox[2] + 0.02);

        this._godView.viewport = [0, 0, this.mapWidth, this.mapHeight];
        mat4.multiply(this._godView.vpMatrix, this._godView.projectMatrix, this._godView.viewMatrix);
        this._godView._cull.update();
        
        if (resetScreenPosition) {
            while (!this._resetScreenPostion()) {
                this._sceneScale++;
                this.getGodView(eyeX, eyeY, widthRange, heightRange, imgWidth, imgHeight, resetScreenPosition);
            }
        }
        this._sceneScale = 1;
        return this._godView;
    };
    
    //range = [minx, miny, minz, maxx, maxy, maxz]
    InAppNavigation.prototype.getGodViewForFloorPlan = function(range, imgWidth) {
        this.mapWidth = imgWidth || 1000;
        this.mapHeight = this.mapWidth * (range[4] - range[1]) / (range[3] -  range[0]);
        
        this.mapWidth = Math.floor(Math.floor(this.mapWidth / Globals.devicePixelRatio) * Globals.devicePixelRatio);
        this.mapHeight = Math.floor(Math.floor(this.mapHeight / Globals.devicePixelRatio) * Globals.devicePixelRatio);
        this._cameraHeight = range[2] + this.ORDINARY_PEOPLE_HEIGHT;
        
        var bbox = new Float32Array(6);
        MyMath.aabb.copy(bbox, range);
        //SVG is reversed Y coord
        var tmp = bbox[4];
        bbox[4] = -range[1];
        bbox[1] = -tmp;
        
        var size = MyMath.aabb.size(bbox);

        var aspect = this.mapWidth / this.mapHeight;

        var height = size.height * 0.5; 
        var width = size.width * 0.5;

        //eyeX and eyeY should be during 0 ~ 1
        this._godView._perspective = false;
        vec3.set(this._godView.eye, (bbox[0] + bbox[3]) * 0.5, (bbox[1] + bbox[4]) * 0.5, bbox[5]);
        vec3.set(this._godView._at, this._godView.eye[0], this._godView.eye[1], bbox[2]);
        
        mat4.lookAt(this._godView.viewMatrix, this._godView.eye, this._godView._at, [0, 1, 0]);

        mat4.ortho(this._godView.projectMatrix, -width, width, -height, height, 0.01, (bbox[5] - bbox[2])+ 0.01);

        this._godView.viewport = [0, 0, this.mapWidth, this.mapHeight];
        mat4.multiply(this._godView.vpMatrix, this._godView.projectMatrix, this._godView.viewMatrix);
        mat4.invert(this._godView.invertVPMatrix, this._godView.vpMatrix);

        this._godView._cull.update();
    };
    
    
    InAppNavigation.prototype.getScreenPosList = function() {
        var res = [];
        for (var i = 0, len = this._keypoints.length; i < len; i++) {
            res.push({
                eye2d : this._keypoints[i].eye2d,
                at2d : this._keypoints[i].at2d,
            });
        } 
        return res;
    };
    
    /**
     * @description get the x, y position for pos in god viewport
     * @param {object} pos - 3d position.
     * @return {object} x and y coord in mini map
     */
    InAppNavigation.prototype.getMapCoord = function(pos) {
        //get the x, y position for pos in god viewport
        var _pos = pos || this._camera._at;
        var posHom = vec3.fromValues(_pos[0], _pos[1], _pos[2]);
        vec3.transformMat4(posHom, posHom, this._godView.vpMatrix);
        var x = (posHom[0] / 2.0 + 0.5) * this.mapWidth;
        var y = this.mapHeight - 1 - (posHom[1] / 2.0 + 0.5) * this.mapHeight;
        return  { x: x,  y: y, height: 0 };
    };

    /**
     * @description Move camera vertically by the ratio value, up or down
     * @param {float} ratio - the height in ratio for 0 to 1.
     * @return {null} - return nothing
     */
    InAppNavigation.prototype.setViewHeightByRatio = function(ratio) {
        var clip = this._scene.clipping.get();
        if (ratio !== undefined || ratio !== null) {
            this._cameraHeight =  clip[2] + this.ORDINARY_PEOPLE_HEIGHT + ratio * (clip[5] - clip[2] - this.ORDINARY_PEOPLE_HEIGHT);
        } else {
            this._cameraHeight = this._keypoints[this._keypoints.length -1].eye3d[2];
        }
        var targetEye = vec3.fromValues(this._camera.eye[0], this._camera.eye[1], this._cameraHeight);
        var targetAt = vec3.fromValues(this._camera._at[0], this._camera._at[1], this._cameraHeight);

        this._moveTo(targetEye, targetAt);
    };

    /**
     * @description Get the camera's z height
     * @return {null} - return nothing
     */
    InAppNavigation.prototype.getViewHeight = function() {
        return this._cameraHeight;
    };

    /**
     * @description Get the trajectories, the navigation path
     * @return {null} - return nothing
     */
    InAppNavigation.prototype.getTrajectories = function() {
        var total = "";
        for (var i = 0; i < this._trajectories.length; i++) {
            for (var j = 0; j < this._trajectories[i].length; j++) {
                total += (this._trajectories[i][j].toString() + ",");
            }
            total += "-";
        }
        
        var compressed = LZString.compressToEncodedURIComponent(total);
        return compressed;
    };

    /**
     * @description Get the height in range to adjust the slider bar in frontend page
     * @return {float} ratio from 0 to 1
     */
    InAppNavigation.prototype.getViewHeightRatio = function() {
        var clip = this._scene.clipping.get();

        var height = this._keypoints.length > 1 ? this._camera.eye[2] : this._cameraHeight;

        var ratio = (height - clip[2] - this.ORDINARY_PEOPLE_HEIGHT) / (clip[5] - clip[2] - this.ORDINARY_PEOPLE_HEIGHT);
        return ratio;
    };

    /**
     * @description Set the navigation speed
     * @param {float} speed - new speed.
     * @return {null} - return nothing
     */
    InAppNavigation.prototype.setSpeed = function(speed) {
        this._speed = speed;
        this._calculateAdjust();
    };

    InAppNavigation.prototype._resetScreenPostion = function() {
        var screenPostion = vec3.create();
        var x, y;
        for (var i = 0, len = this._keypoints.length; i < len; i++) {
            vec3.transformMat4(screenPostion, this._keypoints[i].eye3d, this._godView.vpMatrix);
            x = (screenPostion[0] / 2.0 + 0.5) * this.mapWidth;
            y = this.mapHeight - 1 - (screenPostion[1] / 2.0 + 0.5) * this.mapHeight;
            
            this._keypoints[i].eye2d[0] = x;
            this._keypoints[i].eye2d[1] = y;
            
            vec3.transformMat4(screenPostion, this._keypoints[i].at3d, this._godView.vpMatrix);
            x = (screenPostion[0] / 2.0 + 0.5) * this.mapWidth;
            y = this.mapHeight - 1 - (screenPostion[1] / 2.0 + 0.5) * this.mapHeight;
            
            this._keypoints[i].at2d[0] = x;
            this._keypoints[i].at2d[1] = y;
            if (x < 0 || x > this.mapWidth || y < 0 || y > this.mapHeight) {
                return false;
            }
        }
        return true;
    };
    
    /**
     * @description private function to get the 3d position according to the depth buffer and x, y coord
     * @param {integer} x - the x coord.
     * @param {integer} y - the y coord.
     * @return {object} world position in 3d
     */
    InAppNavigation.prototype._getWorldPosition = function(x, y) {
        
        if (this._floorPlan) {
            var worldPosition = vec3.fromValues(
                                    2.0 * (x / this.mapWidth - 0.5),
                                    2.0 * ((this.mapHeight - 1 - y) / this.mapHeight - 0.5),
                                    1.0);

            vec3.transformMat4(worldPosition, worldPosition, this._godView.invertVPMatrix);
            worldPosition[2] = this._cameraHeight;
            return worldPosition;
        }
        
        var depthBuffer;
        var inversedVPMatrix;
        if (this._lod.level === 1) {
            depthBuffer = this._lod.depthbuffers[0];
            inversedVPMatrix = this._lod.inversedVPMatrices[0];
            
            //clamp value to 0~999
            x = MyMath.clamp(Math.floor(x), 1, this.mapWidth);
            y = MyMath.clamp(Math.floor(y), 1, this.mapHeight);
        } else {
            //decide which piece to use
            var partX = Math.floor(x * this._lod.level / this.mapWidth);
            var partY = Math.floor(y * this._lod.level / this.mapWidth);
            var index = partX + partY * this._lod.level;
            var depthBuffer = this._lod.depthbuffers[index];
            var inversedVPMatrix = this._lod.inversedVPMatrices[index];
            
            x = x * this._lod.level - partX * this.mapWidth;
            y = y * this._lod.level - partY * this.mapHeight;
            
            //clamp value to 0~999
            x = MyMath.clamp(Math.floor(x), 1, this.mapWidth);
            y = MyMath.clamp(Math.floor(y), 1, this.mapHeight);
        }
        
        var offset = 4 * (Math.floor(x) + Math.floor(this.mapHeight - y) * this.mapWidth);
        var depthPixel = [depthBuffer[offset],
                          depthBuffer[offset + 1],
                          depthBuffer[offset + 2],
                          depthBuffer[offset + 3]];
                          
        var depth;
        // Even the depth may be invalid, we still compute the correct (x, y) in world space.
        if (depthPixel[0] === 0 &&
            depthPixel[1] === 0 &&
            depthPixel[2] === 0 &&
            depthPixel[3] === 0) {
            depth = 0.5;
        } else {
            depth = depthPixel[0] / 255.0 * (1.0/(255.0*255.0*255.0)) +
                    depthPixel[1] / 255.0 * (1.0/(255.0*255.0)) +
                    depthPixel[2] / 255.0 * (1.0/(255.0)) +
                    depthPixel[3] / 255.0;
        }

        var worldPosition = vec3.fromValues(
                                            2.0 * (x / this.mapWidth - 0.5),
                                            2.0 * ((this.mapHeight - 1 - y) / this.mapHeight - 0.5),
                                            2 * depth - 1.0);

        vec3.transformMat4(worldPosition, worldPosition, inversedVPMatrix);
        worldPosition[2] += this.ORDINARY_PEOPLE_HEIGHT;
        return worldPosition;
    };

    InAppNavigation.prototype._calculateAdjust = function() {
        if (this._keypoints.length === 0) {
            return;
        }
        if (this._keypoints.length > 1) {
            var diff1 = vec2.create();
            var diff2 = vec2.create();
            for (var i = 0, len = this._keypoints.length-1; i < len; i++) {
                var k1 = this._keypoints[i];
                var k2 = this._keypoints[i+1];
                
                //1 get the distance of two points
                var distance = vec3.distance(k1.eye3d, k2.eye3d);
                
                vec2.subtract(diff1, k1.at2d, k1.eye2d);
                vec2.subtract(diff2, k2.at2d, k2.eye2d);
                vec2.normalize(diff1, diff1);
                vec2.normalize(diff2, diff2);
                var angle1 = Math.atan2(diff1[1], diff1[0])+ Math.PI;
                var angle2 = Math.atan2(diff2[1], diff2[0])+ Math.PI;
                var sign = Math.sign(angle2 - angle1);
                
                //2 get the angle difference
                var angleDiff = Math.abs(angle2 - angle1);
                
                //3 if bigger than PI, use the other half
                if (angleDiff > Math.PI) {
                    angleDiff = 2 * Math.PI - angleDiff;
                    sign *= -1;
                }
                
                this._keypoints[i].angleDiff = angleDiff * sign;

                if (angleDiff == 0) {
                    this._keypoints[i].adjust = 1;
                } else {
                    this._keypoints[i].adjust = MyMath.clamp(0.08 * distance / angleDiff, 0.1, 1);
                }
                
                //this._keypoints[i].adjust = 1.0;
                //console.log("Point " + i + ", adjust ratio: " + this._keypoints[i].adjust);
            }
        }
        this._keypoints[this._keypoints.length - 1].adjust = 1;
    };
    
    /**
     * @description private function to move the camera to the specific position
     * @param {object} eye - the eye position.
     * @param {object} at - the at position.
     * @return {null} - return nothing
     */
    InAppNavigation.prototype._moveTo = function(eye, at) {
        this._animator.bind(this._camera);
        this._animator.start(eye, at);
        this._animator.stop();
    };
    
    /**
     * @description private function to stop the navigation
     * @param {boolean} forceStop - force to stop the navigation
     */
    InAppNavigation.prototype.stop = function(forceStop) {
        if (this._camera.animator instanceof CameraAnimatorTransition) {
            this._camera.animator.stop();
        }
        if(this._camera.animator instanceof CameraAnimatorNavigate) {
            this._animator.stop(forceStop);
        }
    };

    /**
     * @description Calculate the trajectory between two key points
     * @param {integer} idx - the specific key point's index.
     * @return {null} - return nothing
     */
    InAppNavigation.prototype._calculateTrajectory = function(idx) {
        if (idx < 0 || idx > this._trajectories.length - 1) {
            return;
        }

        this._trajectories[idx] = [];
        var distance = this._distances[idx + 1] - this._distances[idx];
        var num = Math.ceil(distance / this._speed);
        for (var i = 0; i < num; i++) {
            var eye2d = vec2.create();
            vec3.lerp(eye2d, this._keypoints[idx].eye2d, this._keypoints[idx + 1].eye2d, i / num);
            var p = this._getWorldPosition(eye2d[0], eye2d[1]);
            this._trajectories[idx].push(p[2]);
        }
    };

    /**
     * @description Clear all the navigation info data to save memory
     * @return {null} - return nothing
     */
    InAppNavigation.prototype._clearData = function() {
        this._keypoints   = [];
        this._distances   = [];
        this._trajectories = [];
    };
  
    InAppNavigation.prototype.recompileShader = function(resourceManager, states) {
        if (!this._depthQuery) {
            this._depthQuery = new DepthQuery(this._scene, this._resourceManager);
        }
        this._depthQuery.recompileShader(resourceManager, states);
    };
    
    return InAppNavigation;    
})();
    
