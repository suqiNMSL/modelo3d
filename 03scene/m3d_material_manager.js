//
// m3d_material_manager.js
// The material manager which manages the model materials
// that comes from model file.
//
//  

import Material         from "./materials/m3d_material.js";
import MaterialAdhoc    from "./materials/m3d_material_adhoc.js";
import MaterialPbs      from "./materials/m3d_material_pbs.js";


export default (function() {
    "use strict";

    function MaterialManager(resourceManager) {
        this._materials = {};
        
        this._count    = 0;
        this._buffer   = new Uint8Array(255 * 4); // 4 for current valid material parameters (diffuse, transparency)

        this.texture = resourceManager.getTexture("texturemanager");
        this.texture.create(255, 1, gl.RGBA, gl.NEAREST, gl.CLAMP_TO_EDGE);
    }; 

    MaterialManager.prototype.destroy = function() {
        for (var name in this._materials) {
            this._materials[name].destroy();
        }
        
        this._materials = null;
        delete this._materials;

        this.texture = null;
        delete this.texture;

        this._buffer = null;
        delete this._buffer;
    };
    
    // name can be optional
    MaterialManager.prototype.createMaterialAdhoc = function(name) {
        
        if (typeof(name) === "string") {
            if (this._materials[name]) {
                return this._materials[name];
            }
            
            this._materials[name] = new MaterialAdhoc(name);
            this._materials[name].index = this._count;
            
            this._count++;

            return this._materials[name];
        } else {
            var hashkey = MaterialAdhoc.hash(name);
            
            if (this._materials[hashkey]) {
                if (this._materials[hashkey].equal(name)) {
                    return this._materials[hashkey];
                } else { 
                    var newHashKey = this._materials[hashKey].hash();
                    this._materials[newHashKey] = this._materials[hashKey];
                }
            }
            
            this._materials[hashkey] = new MaterialAdhoc();
            this._materials[hashkey].index = this._count;
            
            this._count++;
            return this._materials[hashkey];
        }
    };
    
    MaterialManager.prototype.createMaterialPbs = function(name) {
    };
    
    MaterialManager.prototype.getMaterial = function(name) {
        return this._materials[name];
    };

    // upload material data to GPU.
    MaterialManager.prototype.upload = function() {
        var buffer = new Uint8Array(255 * 4); // 4 for current valid material parameters (diffuse, transparency)
        for (var m in this.materials) {
            var material = this.materials[m];
            var index = material.index * 4;

            buffer[index]     = Math.floor(material.getDiffuse()[0] * 255.0);
            buffer[index + 1] = Math.floor(material.getDiffuse()[1] * 255.0);
            buffer[index + 2] = Math.floor(material.getDiffuse()[2] * 255.0);
            buffer[index + 3] = Math.floor(material.getTransparent() * 255.0);
        }

        this.texture.update(buffer);
    };
    
    MaterialManager.prototype.getAllMaterials = function() {
        return this._materials;
    };

    return MaterialManager;
})();
    
        
