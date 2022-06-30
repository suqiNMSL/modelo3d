//
// m3d_tranform_gizmo.js
// The transform gizmo widget(translation of xyz, uniform scaling and xyz rotation)
//
// Copyright Modelo XX - 2015, All rights reserved.

import Globals        from "../../m3d_globals.js";
import MyMath         from "../../00utility/m3d_math.js";
import RenderTarget   from "../../04renderer/m3d_rendertarget.js";
import GeometricShape from "../../02resource/m3d_geometric_shape.js";
import Gizmo          from "../../03scene/drawables/m3d_gizmo.js";
import PickQuery      from "./m3d_pick_query.js";


export default (function() {
    "use strict";

    var COLORS = {
        "axis-x": vec4.fromValues(1, 0, 0, 1),
        "axis-y": vec4.fromValues(0, 1, 0, 1),
        "axis-z": vec4.fromValues(0, 0, 1, 1),
        "picked": vec4.fromValues(1, 1, 0, 1)
    };

    function TransformGizmo(scene, resourceManager) {
        // initialize
        this._enabled      = false;
        this._renderTarget = new RenderTarget("default", resourceManager, Globals.width, Globals.height);
        this._scene        = scene;
        this._picked       = null;      // The picked gizmo part
        this._translation  = [0, 0, 0]; // The translation of gizmo
        this._drawables    = [];        // The gizmo rendering nodes.
        this._resourceManager = resourceManager;

        this._callback     = null;
    };
    
    TransformGizmo.prototype.destroy = function() {
        this._renderTarget.destroy();
        this._renderTarget = null;
        delete this._renderTarget;

        this._pickQuery.destroy();
        this._pickQuery = null;
        delete this._pickQuery;

        this._translation = null;
        delete this._translation;
    };

    TransformGizmo.prototype.setCallback = function(cbk) {
        this._callback = cbk;
    };

    TransformGizmo.prototype.setPosition = function(x, y, z) {
        this._translation[0] = x;
        this._translation[1] = y;
        this._translation[2] = z;
    };

    TransformGizmo.prototype.setEnabled = function(enabled) {
        this._enabled = enabled;

        // Put the gizmo at the lower corner of the scene's bbox.
        if (this._enabled) {
            if (this._drawables.length === 0) {
                this._createGizmo(this._resourceManager);
                this._pickQuery = new PickQuery(this._scene, this._drawables, this._resourceManager);
            }
            
            this._move(this._translation);
        } 
    };
    
    TransformGizmo.prototype.isEnabled = function() {
        return this._enabled;
    };

    TransformGizmo.prototype.render = function(renderer, camera) {
        if (!this._enabled) {
            return ;
        }
        renderer.drawGizmo(this._renderTarget, this._axisX, camera);
        renderer.drawGizmo(this._renderTarget, this._axisY, camera);
        renderer.drawGizmo(this._renderTarget, this._axisZ, camera);
    };

    TransformGizmo.prototype.onMouseDown = function(mouse, camera) {
        if (!this._enabled) {
            return true;
        };

        return true;
    };

    var mouse_move_translation = [0, 0, 0];

    TransformGizmo.prototype.onMouseMove = function(mouse, renderer, camera) {
        if (!this._enabled) {
            return true;
        }

        var pressed = (mouse.event.buttonDown === 1);

        if (pressed) {
            if (this._picked) {
                mouse_move_translation[0] = this._translation[0];
                mouse_move_translation[1] = this._translation[1];
                mouse_move_translation[2] = this._translation[2];

                this._updateTranslation(mouse, camera);

                this._move(this._translation);

                // We send how much movement gizmo goes this time.
                if (this._callback) {
                    mouse_move_translation[0] = this._translation[0] - mouse_move_translation[0];
                    mouse_move_translation[1] = this._translation[1] - mouse_move_translation[1];
                    mouse_move_translation[2] = this._translation[2] - mouse_move_translation[2];
                    this._callback(mouse_move_translation[0],
                                   mouse_move_translation[1],
                                   mouse_move_translation[2]);
                }

                return false;
            }
        } else {
            var picked = this._pickQuery.pick(mouse.x, mouse.y, renderer, camera);
            if (picked !== this._picked) {
                // Restore the previously picked axis color.
                if (this._picked) {
                    this._picked.setColor(COLORS[this._picked.name]);
                }
                this._picked = picked;
                // Highlight the picked axis.
                if (this._picked) {
                    this._picked.setColor(COLORS["picked"]);
                }
            }
        }
            
        return true;
    };

    TransformGizmo.prototype.onMouseUp = function(mouse) {
        // Doing nothing for now
    };

    var move_transform = mat4.create();
    // Move the gizmo to position
    TransformGizmo.prototype._move = function(position) {
        // Transform the gizmo to position.
        var m = move_transform;

        m[12] = this._translation[0];
        m[13] = this._translation[1];
        m[14] = this._translation[2];

        this._axisX.transform.setTransform(m);
        this._axisY.transform.setTransform(m);
        this._axisZ.transform.setTransform(m);
    };
    
    TransformGizmo.prototype._updateTranslation = function(mouse, camera) {
        var p0 = camera.unproject(mouse.x, mouse.y);
        var p1 = vec3.fromValues(p0[0], p0[1], p0[2]);
        var p0 = camera.unproject(mouse.x - mouse.dx, mouse.y - mouse.dy);
        var p2 = vec3.fromValues(p0[0], p0[1], p0[2]);
        vec3.sub(p1, p1, p2);

        switch (this._picked.name) {
            case "axis-x": 
                if (p1[0] !== 0) {
                    this._translation[0] += p1[0];
                }
                break;
            case "axis-y": 
                if (p1[1] !== 0) {
                    this._translation[1] += p1[1];
                }
                break;
            case "axis-z": 
                if (p1[2] !== 0) {
                    this._translation[2] += p1[2];
                }
                break;
        };
    };
    
    TransformGizmo.prototype._createGizmo = function(resourceManager) {

        var arrowScale = MyMath.aabb.length(this._scene.bbox) * 0.05;

        // axis-X
        var axisX = resourceManager.getMesh("transformX");
        var axisXGeomShape = new GeometricShape();
        axisXGeomShape.createArrow(0.1 * arrowScale, 1 * arrowScale);
        axisXGeomShape.rotate(0, Math.PI / 2, 0);
        axisX.createArrow(axisXGeomShape);
        
        // axis-Y
        var axisY = resourceManager.getMesh("transformY");
        var axisYGeomShape = new GeometricShape();
        axisYGeomShape.createArrow(0.1 * arrowScale, 1 * arrowScale);
        axisYGeomShape.rotate(-Math.PI / 2, 0, 0);
        axisY.createArrow(axisYGeomShape);
        
        // axis-Z
        var axisZ = resourceManager.getMesh("transformZ");
        var axisZGeomShape = new GeometricShape();
        axisZGeomShape.createArrow(0.1* arrowScale, 1 * arrowScale);
        axisZ.createArrow(axisZGeomShape);

        this._axisX = new Gizmo("axis-x", axisX, resourceManager);
        this._axisX.transform.identity = false;
        this._axisX.setColor(COLORS["axis-x"]);
        
        this._axisY = new Gizmo("axis-y", axisY, resourceManager);
        this._axisY.transform.identity = false;
        this._axisY.setColor(COLORS["axis-y"]);
        
        this._axisZ = new Gizmo("axis-z", axisZ, resourceManager);
        this._axisZ.transform.identity = false;
        this._axisZ.setColor(COLORS["axis-z"]);
        
        this._drawables.push(this._axisX);
        this._drawables.push(this._axisY);
        this._drawables.push(this._axisZ);
    };

    return TransformGizmo;
})();
