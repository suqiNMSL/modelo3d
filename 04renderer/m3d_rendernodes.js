// m3d_rendernodes.js
// a render elements contains a render target, a render elements queue 
// and a few overrided parameters, e.g., material
//
//  


export default (function () {
    "use strict";

    function _Drawable(node) {
        this.drawable      = node.drawable;
        this.indexSize     = this.drawable.mesh.indexSize;
        this.indicesOffset = node.indicesOffset;
        this.indicesCount  = node.indicesCount;
    };
    
    function _NodesQueue() {
        this.queue = [];
        this.overridedShaders = null;
        this.overridedMaterial = null;
    };
    
    function RenderNodes(scene) {
        this._groups    = {};
        this._normal    = new _NodesQueue(); //render withou using overrided material
                                             //used for panel picking and scene picking

        this._nodesPool = {};
        this._cullFace  = scene.needRenderDoubleSided()? false : gl.CCW;
        this._scene     = scene;
    };

    RenderNodes.NORMAL = 0;
    RenderNodes.GROUP  = 1;
    
    RenderNodes.prototype.destroy = function() {
        delete this._groups;
        delete this._normal;
        delete this._nodesPool;
    };

    RenderNodes.prototype.render = function(renderTargets, renderer, shadow, camera) {
        if (!this.isRenderable()) {
            return;
        }
        
        renderer.drawElements(renderTargets[0], this._normal.queue, camera, this._scene.clipping,
                this._scene.getMainLight(), shadow, this._cullFace, null, null);

        for (var name in this._groups) {
            var nodeQueue = this._groups[name];
            renderer.drawElements(renderTargets[0], nodeQueue.queue, camera, this._scene.clipping,
                this._scene.getMainLight(), shadow, this._cullFace, nodeQueue.overridedShaders, nodeQueue.overridedMaterial);
        }
    };
    
    RenderNodes.prototype.isRenderable = function() {
        for (var name in this._groups) {
            if (this._groups[name].queue.length > 0) {
                return true;
            }
        }

        if (this._normal.queue.length > 0) {
            return true;
        }

        return false;
    };
    
    RenderNodes.prototype.setRenderNodesMateterial= function(nodes, overridedShaders, overridedMaterial, mode) {
        if (mode === RenderNodes.NORMAL) {
            this._normal.queue = nodes;
            this._optimize(this._normal);
        } else {
            for (var i = 0, len = nodes.length; i < len; i++) {
                var id = nodes[i].id.toString();
                this._nodesPool[id] = {
                                        node : nodes[i],
                                        material : overridedMaterial.name
                                      };
            }
            this._groups = {};
            for (var id in this._nodesPool) {
                var material = this._nodesPool[id].material;
                if (!this._groups[material]) {
                    this._groups[material] = new _NodesQueue();
                    this._groups[material].overridedShaders = overridedShaders;
                    this._groups[material].overridedMaterial = overridedMaterial;
                    this._groups[material].queue.push(this._nodesPool[id].node);
                }
            }
            for (var material in this._groups) {
                this._optimize(this._groups[material]);
            }
        }
        
    };
    
    //Only the group type will have this option
    RenderNodes.prototype.restoreNodesMaterial = function(nodes, overridedShaders, overridedMaterial) {
        for (var i = 0, len = nodes.length; i < len; i++) {
            var id = nodes[i].id.toString();
            if (this._nodesPool[id]) {
                delete this._nodesPool[id];
            }
        }
        this._groups = {};
        for (var id in this._nodesPool) {
            var material = this._nodesPool[id].material;
            if (!this._groups[material]) {
                this._groups[material] = new _NodesQueue();
                this._groups[material].overridedShaders = overridedShaders;
                this._groups[material].overridedMaterial = overridedMaterial;
                this._groups[material].queue.push(this._nodesPool[id].node);
            }
        }
        for (var material in this._groups) {
            this._optimize(this._groups[material]);
        }
    };
    
    RenderNodes.prototype.clearRenderNodes = function(type) {
        if (type == RenderNodes.NORMAL) {
            this._normal.queue = [];
        } else {
            this._groups    = {};
            this._nodesPool = {};
        }
    };
    
    RenderNodes.prototype._optimize = function(nodesQueue) {
        
        var nodes = nodesQueue.queue;
        
        nodesQueue.queue = [];
        
        nodes.sort(function(a, b) {
            var ret = 0;
            ret = a.drawable.name.localeCompare(b.drawable.name);
            if (ret !== 0) {
                return ret;
            }
            return a.indicesOffset - b.indicesOffset;
        });
        var name = "";
        for (var i = 0, len = nodes.length; i < len; i++) {
            var node = nodes[i];
            var drawable = nodes[i].drawable;
            if (name !== drawable.name) {
                nodesQueue.queue.push(new _Drawable(node));
                name = drawable.name;
            } else {
                var d = nodesQueue.queue[nodesQueue.queue.length - 1];
                if (drawable.transform.count > 1) { // instanced
                    if (d.indicesOffset + 1 === node.indicesOffset) {
                        d.indiciesCount += 1;
                    } else {
                        nodesQueue.queue.push(new _Drawable(node));
                    }
                } else {
                    if (d.indicesOffset + d.indicesCount * d.indexSize === node.indicesOffset) {
                        d.indicesCount += node.indicesCount;
                    } else {
                        nodesQueue.queue.push(new _Drawable(node));
                    }
                }
            }
        }
    };
    
    return RenderNodes;
})();
