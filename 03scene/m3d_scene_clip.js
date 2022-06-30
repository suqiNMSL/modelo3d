//
// m3d_scene_clip.js
// Do clipping over the scene
//
//  

import Math from "../00utility/m3d_math.js";

export default (function() {
    "use strict";

    function SceneClipping(scene) {
        // private:
        this._enabled = false;       

        // The scene bounding box, [-x, -y, -z, +x, +y, +z] 
        this._bbox = Math.aabb.createFromArray([-1, -1, -1, 1, 1, 1]); 

        // The actual cliping bbox, which is aabb
        this._clip = Math.aabb.createFromArray([0, 0, 0, 0, 0, 0]);
        this._points = []; // 8 points of bounding in world space, which may be not axis aligned
        this._planes = []; // 6 planes of bounding in world space, which may be not axis aligned
    }; 

    SceneClipping.prototype.initialize = function(bbox) {
        this._bbox = Math.aabb.createFromArray(bbox);
        this._bbox[0] -= 2e-5;
        this._bbox[1] -= 2e-5;
        this._bbox[2] -= 2e-5;
        this._bbox[3] += 2e-5;
        this._bbox[4] += 2e-5;
        this._bbox[5] += 2e-5;
        this.reset();
    }; 
    
    SceneClipping.prototype.reset = function() {
        this._enabled = false;
        var minClip = Math.aabb.min(this._bbox);
        var maxClip = Math.aabb.max(this._bbox);
        this._clip = Math.aabb.create(minClip, maxClip);
        this._points = Math.aabb.points(this._clip);
        this._planes = Math.aabb.planes(this._clip); 
    }; 

    // Get the center of clipping scene in the world space
    SceneClipping.prototype.getCenter = function() {
        return Math.aabb.center(this._clip);
    };
    
    SceneClipping.prototype.getRadius = function() {
        return Math.aabb.length(this._clip) * 0.5;
    };

    SceneClipping.prototype.get = function() {
        return this._clip;
    };
    
    SceneClipping.prototype.getBBox = function() {
        return this._bbox;
    };
    
    SceneClipping.prototype.getClippingPlanes = function(copy) {
        if (copy) {
            var planes = [];
            planes.push(vec4.clone(this._planes[0]));
            planes.push(vec4.clone(this._planes[1]));
            planes.push(vec4.clone(this._planes[2]));
            planes.push(vec4.clone(this._planes[3]));
            planes.push(vec4.clone(this._planes[4]));
            planes.push(vec4.clone(this._planes[5]));
            return planes;
        } else {
            return this._planes;
        }
    };
    
    SceneClipping.prototype.getClippingPoints = function(copy) {
        if (copy) {
            var points = [];
            points.push(vec3.clone(this._points[0]));
            points.push(vec3.clone(this._points[1]));
            points.push(vec3.clone(this._points[2]));
            points.push(vec3.clone(this._points[3]));
            points.push(vec3.clone(this._points[4]));
            points.push(vec3.clone(this._points[5]));
            points.push(vec3.clone(this._points[6]));
            points.push(vec3.clone(this._points[7]));
            return points;
        } else {
            return this._points;
        }
    };
    
    SceneClipping.prototype.getMin = function() {
        return Math.aabb.min(this._clip);
    };
    
    SceneClipping.prototype.getMax = function() {
        return Math.aabb.max(this._clip);
    };

    // update through 8 points 
    SceneClipping.prototype.update = function(points) {
        //copy the points to local
        for (var i = 0; i < points.length; i++) {
            vec3.copy(this._points[i], points[i]);
        }
        
        Math.aabb.createFromPoints(this._clip, points);
        
        vec4.copy(this._planes[0], Math.plane.create(points[0], points[4], points[7])); // -x
        vec4.copy(this._planes[1], Math.plane.create(points[1], points[2], points[6])); //  x
        vec4.copy(this._planes[2], Math.plane.create(points[0], points[1], points[5])); // -y
        vec4.copy(this._planes[3], Math.plane.create(points[2], points[3], points[7])); //  y
        vec4.copy(this._planes[4], Math.plane.create(points[0], points[3], points[2])); // -z
        vec4.copy(this._planes[5], Math.plane.create(points[4], points[5], points[6])); //  z
    };
    
    SceneClipping.prototype.set = function(minClip, maxClip) {
        this._enabled = true;
        if (typeof maxClip[0] === 'number') {
            this._clip = Math.aabb.create(minClip, maxClip);
            this._points = Math.aabb.points(this._clip);
            this._planes = Math.aabb.planes(this._clip);
        } else {
            this.update(maxClip);
        }
         
    };

    SceneClipping.prototype.isEnabled = function() {
        return this._enabled;
    };

    SceneClipping.prototype.setEnabled = function(enabled) {
        this._enabled = enabled;
    };

    return SceneClipping;
})();
    
