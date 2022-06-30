//
// m3d_drawable_instanced.js
// The drawable drawable with many instances.
//
//  

import MyMath             from "../../00utility/m3d_math.js"
import Node               from "../graph/m3d_node.js";
import TransformInstanced from "./m3d_transform_instanced.js";
import Drawable           from "./m3d_drawable.js";

export default (function() {
    "use strict";

    function DrawableInstanced(name, mesh, layer, shader, material, transform, bbox, meshBBox) {
        // Inheritance:
        Drawable.apply(this, [name, mesh, layer, shader, material, null, bbox]);

        // Self:
        this.transform = new TransformInstanced(transform);

        var s = MyMath.aabb.size(meshBBox);
        this.meshRadius = Math.sqrt(s.width * s.width + s.height * s.height + s.depth * s.depth) * 0.5;
    };
    
    DrawableInstanced.prototype.destroy = function() {
        this.transform.destroy();
        this.transform = null;
        delete this.transform;

        this.mesh     = null;
        this.material = null;
        this.layer    = null;
    };
    
    DrawableInstanced.prototype = Object.create(Drawable.prototype);
    DrawableInstanced.prototype.constructor = DrawableInstanced;

    DrawableInstanced.prototype.isInstancing = function() {
        return true;
    };

    // Since this drawable are identical in term of BIM region, they are neither kept or culled away
    // by bim culling. Thus indicies are not used in this draw.
    DrawableInstanced.prototype.render = function(camera, shader, indices) {
        this.transform.use(camera, shader, 0);
        this.mesh.renderInstanced(this.transform.count);

        // FIXME: since we don't have other instanced attributes, we
        // can skip the divisor disable here.
        //gl.vertexAttribDivisor(4, 0);
        //gl.vertexAttribDivisor(5, 0);
        //gl.vertexAttribDivisor(6, 0);
        //gl.vertexAttribDivisor(7, 0);
    };
    
    // Render the base to base + count instances.
    DrawableInstanced.prototype.renderBaseInstance = function(camera, shader, indices) {
        this.transform.use(camera, shader, indices[0]);
        this.mesh.renderInstanced(indices[1]);
    };

    DrawableInstanced.prototype.removeElements = function(elements) {
        // Delete the entire drawable
        if (elements.length === this.elements.length) {
            console.warn("drawable " + this.name + " is to be deleted.");
            this.destroy();
            return ;
        }

        // Find the element in the drawable
        var deleteElementsIndices = new Array(this.elements.length);
        for (var i = 0, len = this.elements.length; i < len; ++i) {
            deleteElementsIndices[i] = -1;

            for (var j = 0, len1 = elements.length; j < len1; ++j) {
                if (this.elements[i].id === elements[j].id) {
                    deleteElementsIndices[i] = j;
                    break;
                }
            }
        }

        // Upgrade the transformation buffer and elements
        var leftElementsIndices = [];
        var leftElements = [];
        for (var i = 0, len = deleteElementsIndices.length; i < len; i++) {
            if (deleteElementsIndices[i] < 0) {
                leftElementsIndices.push(i);

                var element = this.elements[i];
                element.indicesOffset = leftElements.length;
                leftElements.push(element);
            }
        }

        var transform = this.transform.slice(leftElementsIndices);
        this.transform.destroy();
        this.transform = transform;

        this.elements = leftElements;
    };

    DrawableInstanced.prototype.addElements = function(scene, drawablesInfo) {
        for (var i = 0, len = drawablesInfo.length; i < len; i++) {
            var element = scene.graph.nodes[drawablesInfo[i].id];
            element.indicesOffset = this.elements.length;
            this.elements.push(element);
        
            this.transform.append(drawablesInfo[i].transform);
        }

        this.hidables = -1;
        if (this.elements[0].region >= Node.STRUCTURE_INTERIOR) {
            this.hidables = 0;
        }
    };
    
    function DrawableInfo() {
        this.id             = 0; // element's node index
        this.layer          = -1;
        this.primitive      = 0; 
        this.instanced      = false;
        this.transform      = null;
        this.attributes     = null;
        this.verticesOffset = 0;
        this.verticesBytes  = 0;
        this.indicesOffset  = 0;
        this.indicesBytes   = 0;
        this.indexSize      = 0;
        this.verticesBinary = null;
        this.indicesBinary  = null;
        this.mesh           = "";
    };
    
    DrawableInstanced.prototype.getElementInfo = function(element, outDrawablesInfo) {
        var drawableInfo = new DrawableInfo();
        drawableInfo.id             = element.id;
        drawableInfo.instanced      = true;
        drawableInfo.layer          = this.layer.index;
        drawableInfo.primitive      = this.mesh._primitive;
        drawableInfo.attributes     = this.mesh._attributes;
        drawableInfo.mesh           = this.mesh._name;
        
        for (var i = 0, len = this.elements.length; i < len; i++) {
            if (this.elements[i].id === element.id) {
                drawableInfo.transform = this.transform.getTransformData(i);
                break; 
            }
        }

        outDrawablesInfo.push(drawableInfo);
    };
    
    return DrawableInstanced;
})();
