//
// m3d_comment.js
// The comment render data 
//
//  

import Globals                  from "../../m3d_globals.js";
import MyMath                   from "../../00utility/m3d_math.js";
import SceneCamera              from "../../03scene/camera/m3d_scene_camera.js";
import CameraAnimatorTransition from "../../03scene/camera/m3d_camera_animator_transition.js";
import CameraAnimatorNavigate   from "../../03scene/camera/m3d_camera_animator_navigate.js";
import DepthQuery               from "./m3d_depth_query.js";
import PickQuery                from "./m3d_pick_query.js";


export default (function() {
    "use strict";
    
    function RenderComment(x, y, layer, comment) {
        this.position       = comment.position; // <= 0.4.7, it is model space, > 0.4.7 it is in world space
        this.drawable       = layer;            // <= 0.4.7 it is the drawable object, > 0.4.7, it is the layer object.
        this.camera         = comment.camera;
        this.section        = comment.culling;
        this.visible        = true;
        this.onHiddenLayer  = false;
        this.coordinates    = {"x": x, "y": y};
        
        // FIXME: before 0.4.0 we don't dump fov of camera.
        this.camera.fov = this.camera.fov || 46;
    }; 

    function CommentManager(scene, resourceManager, eventEmitter) {
        this._scene                  = scene;
        this._enabled                = false;
        this._commentData            = null;
        // FIXME: drawables for pick query should be described later.
        this._pickQuery              = new PickQuery(scene, null, resourceManager);
        this._depthQuery             = new DepthQuery(scene, resourceManager);
        this._eventEmitter           = eventEmitter;
        this._animator               = new CameraAnimatorTransition(eventEmitter);
    }; 

    CommentManager.prototype.destroy = function() {
        this._pickQuery.destroy();
        this._depthQuery.destroy();
    };
    
    CommentManager.prototype.setCommentData = function(commentData) {
        this._commentData = commentData;
    };
    
    // For those models created before 0.4.8, their comments need to be upgraded.
    CommentManager.prototype.upgradeRenderData = function(sceneData) {
        var versionDigits = sceneData.version.split(".");
        var version = parseInt(versionDigits[0]) * 10000 +
                      parseInt(versionDigits[1]) * 100 +
                      parseInt(versionDigits[2]);

        if (version > 408) {
            return ;
        }

        var nodesLayer = {};
        var i, index, len;
        for (var layer in sceneData.layers) {
            var layerData = sceneData.layers[layer];

            for (i = 0, len = layerData.nodes.length; i < len; ++i) {
                var nodeName = layerData.nodes[i];

                nodesLayer[nodeName] = layer;
            }
        }
            
        // It is date of the deployment of 0.4.8.
        var oldCommentDate = new Date("2016-08-15T12:00:01.438Z");
        // It is the date we drop the old camera flipYZ.
        var oldFlipCommentDate = new Date("2016-10-30T12:00:01.438Z");
        
        for (index = 0, len = this._commentData.comments.length; index < len; index++) {
            var comment = this._commentData.comments[index];
            if (!comment.hasDot) {
                continue;
            }

            // Only upgrade the old comment (created before 0.4.8 gets deployed)
            var createdDate = new Date(comment.createdOn);
            if (createdDate.getTime() < oldCommentDate.getTime()) {
                // <= 0.4.7, comment's drawable and position are for drawable name and 
                // model-space position. > 0.4.8, we point them to layer name
                // and world space position.
                var nodeName = "n" + Number(comment.drawable.substring(1)); 
                var nodeData = sceneData.scene.nodes[nodeName];
                if (!nodeData) {
                    nodeData = sceneData.scene.billboards[nodeName];
                }
            
                if (nodeData.transform) {
                    var transform = mat4.create();
                    transform[0] = nodeData.transform[0];
                    transform[1] = nodeData.transform[1];
                    transform[2] = nodeData.transform[2];

                    transform[4] = nodeData.transform[3];
                    transform[5] = nodeData.transform[4];
                    transform[6] = nodeData.transform[5];

                    transform[8] = nodeData.transform[6];
                    transform[9] = nodeData.transform[7];
                    transform[10] = nodeData.transform[8];

                    transform[12] = nodeData.transform[9];
                    transform[13] = nodeData.transform[10];
                    transform[14] = nodeData.transform[11];
            
                    var worldPosition = vec3.create();
                    vec3.transformMat4(worldPosition, comment.position, transform);
                    comment.position = worldPosition;
                } 

                var layer = this._scene.getLayerByName(nodesLayer[comment.drawable]);

                // Since that version, we don't use old camera flipYZ algorithm, and so we need
                // to transform the comment created before that version.
                // Note that camera.flip is removed together when we dropped flipYZ from camera implementation.
                // It only exists in the comment created before that.
                if (comment.camera.flip && createdDate.getTime() < oldFlipCommentDate.getTime()) {
                    comment.camera.theta = comment.camera.theta + Math.PI * 1.5;
                    var y, z;
                    y = comment.camera.at[1];
                    z = comment.camera.at[2];
                    
                    comment.camera.at[1] = -z;
                    comment.camera.at[2] =  y;
                }

                comment.renderData = new RenderComment(0, 0, layer, comment);
            }
        }
    };

    CommentManager.prototype.recompileShader = function(resourceManager, states) {
        this._pickQuery.recompileShader(resourceManager, states);
        this._depthQuery.recompileShader(resourceManager, states);
    };


    // Return if the rendering needs refreshing.
    CommentManager.prototype.setFocusedComment = function(comment, camera, isVrEnabled) {
        if (!comment.reviewId) {
            return false;
        }

        var sectionChanged = false;
        var oldSectionEnabled = this._scene.clipping.isEnabled();
        var newSectionEnabled = false;

        // Restore to clipping state when the comment has section information.
        if (comment.renderData.section) {
            newSectionEnabled = true;
            if (oldSectionEnabled) {
                var clip = MyMath.aabb.create(comment.renderData.section.min,
                                                comment.renderData.section.max);
                // See if the section/clipping box has changed.
                sectionChanged = MyMath.aabb.isEqual(this._scene.clipping.get(), clip);
            }
            // if section has min and max, which means it's old version's section data
            if (comment.renderData.section.min && comment.renderData.section.max) {
                this._scene.clipping.set(comment.renderData.section.min,
                                          comment.renderData.section.max);
            } else {
                this._scene.clipping.set(comment.renderData.section.planes,
                                          comment.renderData.section.points);
            }
        } else {
            this._scene.clipping.reset();
            newSectionEnabled = false;
        }
        // Either the section mode changed or the current section is on, we think the
        // section status is not the same before, and thus ask to update the rendering.
        sectionChanged = sectionChanged || (oldSectionEnabled !== newSectionEnabled);

        if(camera.animator instanceof CameraAnimatorTransition || camera.animator instanceof CameraAnimatorNavigate) {
            camera.animator.stop(true);
        }
        this._animator.bind(camera);
        return this._animator.start(comment.renderData.camera, isVrEnabled) || sectionChanged;
    }; 

    CommentManager.prototype.setTransitionSpeed = function(speed) {
        this._animator.setTransitionSpeed(speed);
    };

    CommentManager.prototype.initializeRenderData = function(comment, camera) {
        var layer = this._scene.getLayerByName(comment.drawable);
        if (!layer) {
            return;
        }

        var screenPosition = camera.project(comment.position);

        comment.renderData = new RenderComment(screenPosition[0], screenPosition[1], layer, comment);
    };

    CommentManager.prototype.retrieveRenderData = function(x, y, camera, renderer) {
        var drawable = this._pickQuery.pick(x, y, renderer, camera);

        if (drawable === null) {
            return null;
        }
        // Find the world position of the mouse click
        var worldPosition = this._depthQuery.unproject(x, y, renderer, camera);
        var renderData = {
            position:         worldPosition,         // the comment position in the model space.
            drawable:             drawable.layer.name,       // drawable's layer
            camera:           camera.dump(),         // camera parameters
            section:          this._scene.clipping.isEnabled()? {
            planes:           this._scene.clipping.getClippingPlanes(true),
            points:           this._scene.clipping.getClippingPoints(true)
            } : null // dump the section information if it is currently in section mode
        };
        return renderData;
    };

    // Update all comments positions and visibility
    CommentManager.prototype.update = function(camera) {
        if (!this._enabled) {
            return; 
        }

        var cameraDirection = camera.getViewDirection();

        var commentToCamera = vec3.create(0, 0, 0);
        var worldPosition = vec3.create();

        for (var index = 0, len = this._commentData.comments.length; index < len; index++) {
            var comment = this._commentData.comments[index];
            if (!comment.hasDot) {
                continue;
            }
            
            // FIXME: for comments created between 0.4.8 deployment and MOD-3590 fix
            // we are using comment.position. It is a hack.
            if (!comment.renderData) {
                comment.renderData = new RenderComment(-1, -1, this._scene.layers[0], comment);
            }

            // >= 0.4.8, drawable field in comment is actually the layer.
            var layer = comment.renderData.drawable;

            comment.renderData.visible = true;

            // If this comment is on an invisible layer disable
            if (layer && !layer.visible) {
                comment.renderData.visible = false;
                comment.renderData.onHiddenLayer = true;
                continue;
            } else {
                comment.renderData.onHiddenLayer = false;
            }

            var position = comment.position;
            
            // When the current camera has no intersection with camera when comment is created,
            // the comment is marked as invisible.
            //var dotProduct =  vec3.dot(comment.renderData.faceDirection, cameraDirection);
            //if (dotProduct < 0) {
            //    comment.renderData.visible = false;
            //    continue;
            //}
            // If the comment is behind the viewer, hide it.
            vec3.subtract(commentToCamera, position, camera.eye);
            if (vec3.dot(commentToCamera, cameraDirection) < 0) {
                comment.renderData.visible = false;
                continue;
            }

            // If the comment is out of viewport, make it invisible
            var screenPosition = camera.project(position);

            // 300px is the side comment card width.
            if (screenPosition[0] > Globals.width || screenPosition[0] < 0 ||
                screenPosition[1] > Globals.height || screenPosition[1] < 0) {
                comment.renderData.visible = false;
                continue;
            }

            // Does comment get culled
            if (this._scene.clipping.isEnabled()) {
                var planes = this._scene.clipping.getClippingPlanes();
                //although it a vec4 of plane[i], but vec3.dot will only use the first 3 components
                if (vec3.dot(position, planes[0]) > -planes[0][3] ||
                    vec3.dot(position, planes[1]) > -planes[1][3] ||
                    vec3.dot(position, planes[2]) > -planes[2][3] ||
                    vec3.dot(position, planes[3]) > -planes[3][3] ||
                    vec3.dot(position, planes[4]) > -planes[4][3] ||
                    vec3.dot(position, planes[5]) > -planes[5][3]) {
                    comment.renderData.visible = false;
                }
                if (!comment.renderData.visible) {
                    continue;
                }
            }

            comment.renderData.coordinates.x = screenPosition[0];
            comment.renderData.coordinates.y = screenPosition[1];
        }

        this._eventEmitter.emit("updateComments");
    };
    
    CommentManager.prototype.setEnabled = function(enabled) {
        this._enabled = enabled;

        // Exit the comment mode and update all comments positions and visibility
        if (!this._enabled) {
            for (var index = 0, len = this._commentData.comments.length; index < len; index++) {
                var comment = this._commentData.comments[index];

                comment.renderData.visible = false;
            }

            this._eventEmitter.emit("updateComments");
        }
    };
    
    CommentManager.prototype.isEnabled = function() {
        return this._enabled;
    };

    return CommentManager;
})();
    

