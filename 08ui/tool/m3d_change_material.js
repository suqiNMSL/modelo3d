//
// m3d_change_material.js
// Change the material color
//
//  


import Globals   from "../../m3d_globals.js";
import Contour   from "../../05fx/m3d_contour.js";
import PickQuery from "./m3d_pick_query.js";

export default (function() {
    "use strict";
    
    function ChangeMaterial(scene, resourceManager, eventEmitter) {
        // public:
        this.enabled          = false;

        // private:
        this._scene            = scene;
        this._savedColors      = {};        // Save the material color value so that we can restore.
        this._savedTransparent = {};
        this._pickedMaterial   = null;      // The current picked material
        this._hoveringMaterial = null;      // The current material of drawable that mouse is hovering on
        this._resourceManager  = resourceManager;   
        this._pickQuery        = null; 
        this._contour          = null;
        this._eventEmitter     = eventEmitter;
        
        // Initialization:

        // Since there is no change material UI on the mobile, we disable this feature.
        if (Globals.isMobile) {
            return;
        }
        
        // FIXME: drawables for pick query should be described later.
        this._pickQuery = new PickQuery(this._scene, null, this._resourceManager);
        this._contour   = new Contour(this._resourceManager, this._scene);
        this._contour.setColor([1.0, 0.0, 0.0, 1.0]);
    };

    ChangeMaterial.prototype.destroy = function () {
        if (Globals.isMobile) {
            return;
        }
        this._contour.destroy();
        this._pickQuery.destroy();
    };
    
    ChangeMaterial.prototype.resize = function(width, height) {
        if (Globals.isMobile) {
            return;
        }
        this._contour.resize(width, height);
    };

    ChangeMaterial.prototype.recompileShader = function(resourceManager, states) {
        if (Globals.isMobile) {
            return;
        }
        this._pickQuery.recompileShader(resourceManager, states);
        this._contour.recompileShader(resourceManager, states);
    };

    ChangeMaterial.prototype.onMouseUp = function(mouse) {
        if (!this.enabled) {
            return;
        }

        this._onInputStop();
    };

    ChangeMaterial.prototype.onTouchStop = function(touch) {
        if (!this.enabled || touch.numCursors !== 1) {
            return;
        }
        if (!touch.isMoved) {
            this._onInputStop();
        }
    };
    
    ChangeMaterial.prototype.onTouchStart = function(touch, renderer, camera) {
        if (!this.enabled || touch.numCursors !== 1) {
            return true;
        }
        
        this._onInputStart(touch.cursor(0).x, touch.cursor(0).y, renderer, camera);
        return null;
    };

    ChangeMaterial.prototype.onMouseMove = function(mouse, renderer, camera) {
        if (!this.enabled) {
            return true;
        }
        // Don't response when it is a dragging event.
        if (mouse.event.buttonDown !== 0) {
            return true;
        }
        
        this._onInputStart(mouse.x, mouse.y, renderer, camera);
        return null;
    };
    

    ChangeMaterial.prototype.setMaterialColor = function(materialName, color) {
        var material = this._scene.materialManager.getMaterial(materialName);
        if (material) {
            material.setDiffuse(color);
        }
    };

    ChangeMaterial.prototype.setMaterialTransparency = function(materialName, transparency) {
        var material = this._scene.materialManager.getMaterial(materialName);
        if (material && material.setTransparent) {
            material.setTransparent(transparency);
        }
    };

    ChangeMaterial.prototype.restoreMaterials = function() {
        this._pickedMaterial   = null;
        this._hoveringMaterial = null;

        // colors were never backed up
        if (_.isEmpty(this._savedColors)) {
            return;
        }

        // Restore the saved color
        for (var materialName in this._savedColors) {
            var material = this._scene.materialManager.getMaterial(materialName);
            material.setDiffuse(this._savedColors[materialName]);
        }
        
        for (var materialName in this._savedTransparent) {
            var material = this._scene.materialManager.getMaterial(materialName);
            if (material.getTransparent) {
                material.setTransparent(this._savedTransparent[materialName]);
            }
        }
        
    };

    ChangeMaterial.prototype.backupMaterials = function() {
        
        this._savedColors = {};
        this._savedTransparent = {};
        var matetials = this._scene.materialManager.getAllMaterials();
        for (var materialName in matetials) {
            var material = this._scene.materialManager.getMaterial(materialName);
            if (!material.getDiffuse()) {
                continue;
            }
            this._savedColors[materialName] = material.getDiffuse().slice(0);
            if (material.getTransparent) {
                this._savedTransparent[materialName] = material.getTransparent();
            }
        }
    };

    ChangeMaterial.prototype.setEnabled = function(enabled) {
        this.enabled = enabled;
        this._pickedMaterial = null;
        this._hoveringMaterial = null;
    };

    ChangeMaterial.prototype.render = function(renderer, camera) {
        if (!this.enabled) {
            return;
        }
        var drawables;
        if (this._pickedMaterial !== null) {
            drawables = this._scene.materialManager.getMaterial(this._pickedMaterial).drawables;
            this._contour.setColor([0.968, 0.322, 0.137, 1.0]);
            this._contour.render(renderer, this._scene, drawables, camera);
        }
        
        if (this._hoveringMaterial !== null && this._hoveringMaterial !== this._pickedMaterial) {
            drawables = this._scene.materialManager.getMaterial(this._hoveringMaterial).drawables;
            this._contour.setColor([1, 0.565, 0.443, 1.0]);
            this._contour.render(renderer, this._scene, drawables, camera);
        }
    };

    ChangeMaterial.prototype.getPickedMaterial = function() {
        return this._pickedMaterial;
    };

    ChangeMaterial.prototype.clearPickedMaterial = function() {
        this._pickedMaterial = null;
    };
    
    ChangeMaterial.prototype._onInputStop = function() {
        this._pickedMaterial = this._hoveringMaterial;

        if (this._pickedMaterial) {
            // Update the color value in color picker panel
            var material = this._scene.materialManager.getMaterial(this._pickedMaterial);
            var color = material.getDiffuse();
            var dec2hex = function(dec) {
                var num =  Number(parseInt(dec, 10));
                return num >= 16 ?  num.toString(16): "0" + num.toString(16);
            };
            var hexColor = "#" + dec2hex(color[0] * 255.0) + dec2hex(color[1] * 255.0) + dec2hex(color[2] * 255.0);

            this._eventEmitter.emit("newMaterialPicked", material, hexColor, material.getTransparent ? material.getTransparent() : null );
        } 
    };

    ChangeMaterial.prototype._onInputStart = function(x, y, renderer, camera) {
        var hoveringDrawable = this._pickQuery.pick(x, y, renderer, camera);
        if (hoveringDrawable !== null) {
            if (hoveringDrawable.mesh.hasColor()) {
                this._eventEmitter.emit("textureSelected");
            } else {
                this._eventEmitter.emit("materialSelected");
            }
            this._hoveringMaterial = hoveringDrawable.material.name;
        } else {
            this._hoveringMaterial = null;
            this._eventEmitter.emit("nothingSelected");
        }
    };

    return ChangeMaterial;
})();
    


