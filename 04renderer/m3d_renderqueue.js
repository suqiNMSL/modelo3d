//
// m3d_renderqueue.js
// The render queue that consists many drawables.
//
//  

export default (function() {
    "use strict";

    function RenderQueue(name, selector) {
        this.name    = name;
        this.valid   = false;
        this.drawables   = [];

        this._setSelector(selector);
    };
    
    RenderQueue.prototype.destroy = function() {
        this.drawables = null;
    }; 
    
    RenderQueue.prototype.removeDrawables = function() {
        this.drawables = [];
        this.valid = false;
    }; 
    
    RenderQueue.prototype.addDrawable = function(drawable) {
        if (drawable.visible && this._selector(drawable)) {
            this.drawables.push(drawable);
            this.valid = true;
        }
    };

    RenderQueue.prototype.optimize = function() {
        if (this.drawables.length === 0) {
            return;
        }
        
        this.drawables.sort(function(a, b) { 
            return a.shader.name.localeCompare(b.shader.name); 
        });

        //// Sort drawables in the renderqueue with mesh first. 
        //this.drawables.sort(function(a, b){ return a.mesh._name.localeCompare(b.mesh._name); });

        //// Then with material.
        //var currentMesh = this.drawables[0].mesh;
        //var currentIndex = 0;
        //var subarray;
        //for (var i = 1, len = this.drawables.length; i < len; ++i) {
        //    if (currentMesh !== this.drawables[i].mesh) {
        //        // Sort by material for this subarray
        //        if (i - currentIndex > 1) {
        //            subarray = this.drawables.slice(currentIndex, i);
        //            subarray.sort(function(a, b){ return a.material.name.localeCompare(b.material.name); });

        //            for (var j = currentIndex; j < i; ++j) {
        //                this.drawables[j] = subarray[j - currentIndex];
        //            }
        //        }
        //        
        //        currentMesh = this.drawables[i].mesh;
        //        currentIndex = i;
        //    }
        //}
        //if (this.drawables.length - currentIndex > 1) {
        //    subarray = this.drawables.slice(currentIndex, this.drawables.length);
        //    subarray.sort(function(a, b){ return a.material.name.localeCompare(b.material.name); });
        //    for (var j = currentIndex, len = this.drawables.length; j < len; ++j) {
        //        this.drawables[j] = subarray[j - currentIndex];
        //    }
        //}
    };

    RenderQueue.prototype.update = function(camera) {
        for (var i = 0, len = this.drawables.length; i < len; ++i) {
            this.drawables[i].update(camera);
        }
    };

    // A select will decide if a drawable is accepted by this queue.
    RenderQueue.prototype._setSelector = function(selector) {
        this._selector = function(drawable) {
            if (!selector) {
                return true;
            }
            
            if (selector.line !== undefined && (selector.line !== drawable.mesh.isLine())) {
                return false;
            }
            
            if (selector.texture !== undefined && (selector.texture !== drawable.material.hasTexture)) {
                return false;
            }
            
            if (selector.mask !== undefined && (selector.mask !== drawable.material.hasMask)) {
                return false;
            }
            
            if (selector.transparent !== undefined && (selector.transparent !== drawable.material.transparent)) {
                return false;
            }
            
            if (selector.shadowCaster !== undefined && (selector.shadowCaster !== drawable.isShadowCaster())) {
                return false;
            }
            
            return true;
        };
    };
    RenderQueue.prototype.sort = function(camera) {
        // Sort the drawables in this queue with respect to the distance of the drawable
        // to the camera.
        if (!this.valid) {
            return;
        }

        var eyeDir = camera.getViewDirection();

        var dir = vec3.fromValues();

        var sortArray = [];
        for (var i = 0, len = this.drawables.length; i < len; ++i) {
            var drawable = this.drawables[i];

            vec3.subtract(dir, drawable.bsphere, camera.eye);
            drawable.distance = vec3.dot(dir, eyeDir);

            //TODO: merge transparent could cause bbox and visible calculation error.
            //drawable.visible = (drawable.distance > 0); 
        }
        this.drawables.sort(function(a, b){return b.distance - a.distance});
    }

    // need more consideration before put this way of cull in
    // RenderQueue.prototype.cull = function(camera) {
    //     if (!this.valid) {
    //         return;
    //     }

    //     var i = 0;
    //     var j = this.drawables.length - 1; 

    //     // set culled to true and put them to the back of render queue
    //     // when renderer renders drawables the render loop will break when it hits the first culled drawable
    //     while (i < j) {
    //         var drawable = this.drawables[i];
    //         if (camera.cull(drawable) ||
    //             !drawable.visible ||
    //             !drawable.mesh) {

    //             this.drawables[i] = this.drawables[j];
    //             this.drawables[j] = drawable;
    //             drawable.culled = true;
    //             j--;
    //         } else {
    //             i++;
    //             drawable.culled = false;
    //         }
    //     }
    // };

    return RenderQueue;
})();
    
