// m3d_state_manager.js
// Manage states of modelo3d
//
//  

export default (function () {
    "use strict";

    function StateManager(canvas) {
        // private:
        this._canvas = canvas;
    };

    // comment
    StateManager.prototype.onCommentEnabled = function(enabled) {
        if (enabled) {
            this._canvas._commentManager.update(this._canvas._sceneCamera);
        }
    };
    
    StateManager.prototype.onCommentChanged = function() {
        this._canvas.cameraManipulator.exitOrthoView();
        //MOD-6301, the frontend will all layers setting first, then the view setting
        //if pick view first, then comment, then the same view again, it will mess the 
        //drawables' visibility. Force to set the activeView to null when user pick a comment
        //which is not created by the model file
        if (this._canvas.orientation  && this._canvas.orientation.enabled) {
            this._canvas.orientation.reset(this._canvas._sceneCamera);
        }
        this.onSectionChanged();
    };

    // rendering settings
    StateManager.prototype.onShadowChanged = function(forceUpdate) {

        // No need to update the shadow when canvas is not visible.
        if (this._canvas._visible) {
            this._canvas._renderScene.setProgressiveEnabled(false);
            this._canvas._renderScene.updateShadow(forceUpdate);
        }
    };
    
    StateManager.prototype.onLightingChanged = function() {
        this.onShadowChanged();
        this._canvas._renderer.renderState.invalidateLight();
    };
    
    StateManager.prototype.onLayerChanged = function() {
        this.onSceneChanged();
        
        // When the scene is first loaded and there is no layers visible, then the camera's _targetDistance
        // and distance will be a very big negative number(check the _getViewDistance function in sceneCamera class)
        // so when the user reselect any layer visible again, we need to reset the _targetDistance and _distance
        // the reason why don't call the camera.reset function is because that the distance is far away from _targetDistance
        // and it took a long time to get to the _targetDistance.
        if (this._canvas._sceneCamera._targetDistance < -1e100){
            this._canvas._sceneCamera._targetDistance = this._canvas._sceneCamera._getViewDistance();
            this._canvas._sceneCamera._distance = this._canvas._sceneCamera._targetDistance;
        }
        //Add this to force the camera to update once, MOD-6283
        this._canvas._sceneCamera._distance += 1e-3;
    };

    // when visible drawables in the scene are changed.
    StateManager.prototype.onSceneChanged = function() {
        // Update the current scene bbox when section is not enabled.
        if (!this._canvas.isSectionEnabled()) {
            this._canvas._scene.clipping.initialize(this._canvas._scene.bbox);
            this._canvas._section.updateGeometry(this._canvas._renderer);
        }
        this._canvas._renderScene.onSceneChanged();
        this._canvas._renderer.invalidate();
        this.onShadowChanged(true);
    };
    
    StateManager.prototype.onChangeMaterialEnabled = function(enabled) {
        this._checkBimCullingStatus(enabled);
    };
    
    StateManager.prototype.onNavigationEnabled = function(enabled) {
        this._checkBimCullingStatus(enabled);
    };
    
    // measurement
    StateManager.prototype.onMeasureEnabled = function(enabled) {
        this._checkBimCullingStatus(enabled);
    };
    
    StateManager.prototype.onFocusElementEnabled = function(enabled) {
        //Sketch effect use overide shader and matetials, 
        //which will conflict with the bim rendering, so needs to disable it
        if (enabled) {
            this._isSketchEnabled = this._canvas._renderScene.isSketchEnabled();
            this._canvas.setSketchEnabled(false);
        } else {
            this._canvas.setSketchEnabled(this._isSketchEnabled);
        }
    };
    
    // section
    StateManager.prototype.onSectionEnabled = function (enabled) {

        var states = {
            "section": enabled,
            "sceneCompressed": this._canvas._scene.compressed
        };

        this._canvas._renderScene.setSectionEnabled(enabled);
        this._canvas._changeMaterial.recompileShader(this._canvas._resourceManager, states);
        this._canvas._ruler.recompileShader(this._canvas._resourceManager, states);
        this._canvas._protractor.recompileShader(this._canvas._resourceManager, states);
        this._canvas._section.recompileShader(this._canvas._resourceManager, states);
        this._canvas._commentManager.recompileShader(this._canvas._resourceManager, states);
        this._canvas.cameraManipulator.recompileShader(this._canvas._resourceManager, states);
        this._canvas._inAppNavigation.recompileShader(this._canvas._resourceManager, states);
        this._canvas._focusElement.recompileShader(this._canvas._resourceManager, states);
        if (!enabled) {
            this._canvas._scene.updateBBox();
            this._canvas._sceneCamera.update();
        }
        this._checkBimCullingStatus(enabled);
        
        this.onShadowChanged();
    };

    StateManager.prototype.onSectionChanged = function() {
        if (this._canvas._scene.clipping.isEnabled()) {
            this._canvas._changeMaterial.recompileShader(this._canvas._resourceManager, {"section": true});
        } else {
            this._canvas._changeMaterial.recompileShader(this._canvas._resourceManager, {"section": false});
        }
        this._canvas._renderer.renderState.invalidateClip();
        // When section changed, we should update shadow too.
        this.onShadowChanged();
    };

    // vr
    StateManager.prototype.onVREnabled = function(enabled) {
        if (enabled) {
            if (this._canvas.orientation) {
                this._canvas.orientation.attach(this._canvas._sceneCamera);
            }
        } else {
            if (this._canvas.orientation) {
                this._canvas.orientation.detach();
            }
            this._canvas._sceneCamera.reset(true);
        }
        this._canvas.lazyRendering = !enabled;
    };

    StateManager.prototype.getStates = function() {
         var states = {
            "doubleSided": this._canvas._scene.needRenderDoubleSided(),
            "shadow": this._canvas._renderScene.isShadowEnabled(),
            "section": this._canvas._renderScene.isSectionEnabled()
        };
         
        return states;
    };
    
    StateManager.prototype._checkBimCullingStatus = function(enabled) {
        this._canvas._bimCullingEnabled = !enabled;
        if (this._canvas._bimCullingEnabled && (this._canvas._changeMaterial.enabled || 
                                                this._canvas._ruler.enabled || 
                                                this._canvas._protractor.enabled || 
                                                this._canvas._section.enabled ||
                                                this._canvas._inAppNavigation.isEnabled())) {
            this._canvas._bimCullingEnabled = false;
        }
    };

    StateManager.prototype.updateMode = function(mode, enabled) {
        if (enabled) {
            this._canvas._ops.push(mode);
        } else {
            var index = this._canvas._ops.indexOf(mode);
            if (index < 0) {
                console.warn("Canvas mode is broken");
                this._canvas._ops = [0]; // FIXME: hardcode here. MODE_NORMAL === 0
            } else {
                this._canvas._ops.splice(index, 1);
            }
        }
             
        this._canvas._mode = this._canvas._ops[this._canvas._ops.length - 1];
    };

    return StateManager;
})();
    
