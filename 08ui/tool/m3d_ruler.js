//
// m3d_ruler.js
// The ruler gizmo
//
//  


import Globals       from "../../m3d_globals.js";
import MyMath        from "../../00utility/m3d_math.js";
import ShaderLibrary from "../../02resource/m3d_shader_library.js";
import Gizmo2D       from "../../03scene/drawables/m3d_gizmo2d.js";
import SceneCamera   from "../../03scene/camera/m3d_scene_camera.js";
import Material      from "../../03scene/materials/m3d_material.js";
import RenderTarget  from "../../04renderer/m3d_rendertarget.js";
import RenderPass    from "../../04renderer/m3d_renderpass.js";
import DepthQuery    from "./m3d_depth_query.js";
import MyLine        from "./m3d_line.js";
import Measure       from "./m3d_measure.js";

export default (function() {
    "use strict";
    
    function Ruler(scene, resourceManager, eventEmitter) {
        // public:
        Measure.apply(this, arguments);
        if (Globals.isMobile) {
            return;
        }
        this._anchors  = [
            {visible: false, x: 0, y: 0, position: [], snapped: false},
            {visible: false, x: 0, y: 0, position: [], snapped: false},
            {visible: false, x: 0, y: 0, position: [], snapped: false}
        ];
        
        this._lines[0] = new MyLine("line_0", resourceManager, [0.969, 0.398, 0.238], false);
        this._lines[1] = new MyLine("line_1", resourceManager, [0, 0, 1], false);
        this._lines[2] = new MyLine("line_2", resourceManager, [1, 0, 0], false);
        this._lines[3] = new MyLine("line_3", resourceManager, [0, 1, 0], false);
        this._lines[4] = new MyLine("line_4", resourceManager, [0.969, 0.398, 0.238], true);
        for (var i = 0; i < 5; i++) {
            this._vertices.push(new Float32Array(6));
        }
    }; 
    Ruler.prototype = Object.create(Measure.prototype);
    Ruler.prototype.constructor = Ruler;
    
    Ruler.prototype.setEnabled = function(enabled) {
        this.enabled = enabled;
        if (!this.enabled) {
            this._current = 0;
            this._bufferDirty = true;
            this._anchors[0].visible = false;
            this._anchors[1].visible = false;
            this._anchors[2].visible = false;
        }
        Measure.prototype.setEnabled.apply(this, arguments);
    }; 

    Ruler.prototype.onMouseWheel = function(mouse, renderer, camera) {
        if (!this.enabled) {
            return;
        }
        // if the one point is pressed, and wheel happens, do not render the line
        if (this._current === 1) {
            this._anchors[1].visible = false;
        }
        // do not show the mouse point while wheeling
        this._anchors[2].visible = false;
        // Invalidate the snapping buffers if camera changes.
        if (this._normalSnapping || this._lineSnapping) {
            this._bufferDirty = true;
            this._bufferDirtyTime = Globals.frame;
        }
    };
    
    Ruler.prototype.onMouseMove = function(mouse, renderer, camera) {
        if (!this.enabled) {
            return;
        }
        // Hide the ruler line when users are dragging the model.
        // Also make the maps dirty. Rotate movement
        this._anchors[2].visible = true && (this._normalSnapping || this._lineSnapping);
        if (mouse.event.buttonDown !== 0) {
            // if rotating happens, do not show the mouse blue dot
            this._anchors[2].visible = false;
            if (this._current === 1) {
                this._anchors[1].visible = false;
            }

            // Invalidate the snapping buffers if camera changes.
            if (mouse.moved && (this._normalSnapping || this._lineSnapping)) {
                this._bufferDirty = true;
                this._bufferDirtyTime = Globals.frame;
            }
            return ;
        }
        
        if (mouse.moved) {
            var x = mouse.x;
            var y = mouse.y;
            
            // Snap the mouse cursor
            if (this._normalSnapping || this._lineSnapping) {
                this._snapCoarse(x, y, renderer, camera);
                x = this._snapCoord[0];
                y = this._snapCoord[1];
            }
            
            var position = camera.unproject(x, y);
            
            if (this._current === 1) {
                this._updateAnchor(x, y, position, camera);
                this._anchors[1].visible = true;
            }

            // update snap point to mouse dot
            this._anchors[2].x = x;
            this._anchors[2].y = y;
            
        }
    }; 
    
    //Do not consider wheel and double click event in ruler since we need to wait until
    //the camera stops then re-take the normal depth map. This is too complicated.
    Ruler.prototype.onMouseUp = function(mouse, renderer, camera) {
        if (!this.enabled) {
            return false;
        }

        // Start a new measurement.
        if (this._current === 2) {
            this._current = 0;
            this._distance = {};
            this._anchors[0].visible = false;
            this._anchors[1].visible = false;
        }
        
        var x = mouse.x;
        var y = mouse.y;
        if (this._normalSnapping || this._lineSnapping) {
            x = this._snapCoord[0];
            y = this._snapCoord[1];
        }

        if (this._current === 0) {
            this._eventEmitter.emit("rulerupdate", {distance: 0, x : 0, y : 0,z : 0});
        }
        var position = this._depthQuery.unproject(x, y, renderer, camera);
        if (position) {
            if ((this._lineSnapping ||this._normalSnapping) && !this._bufferDirty) {
                this._snapFine(position, renderer, camera);
            } else {
                this._updateAnchor(x, y, position, camera);
            }

            this._anchors[this._current].visible = true;
            if (this._current === 1) {
                this._updateSubLines(camera);
            }
            this._current++;
            return true;
        }

        return false;
    }; 

    Ruler.prototype._updateAnchor = function(x, y, position, camera) {
        // We should update the first anchor during mouse movement when both
        // two are pinned donw.
        var current = this._current % 2;
        this._anchors[current].x = x;
        this._anchors[current].y = y;

        if (!position) {
            return ;
        }
        
        this._anchors[current].position[0] = position[0];
        this._anchors[current].position[1] = position[1];
        this._anchors[current].position[2] = position[2];

        if (current === 0) {
            this._vertices[0][0] = position[0];
            this._vertices[0][1] = position[1];
            this._vertices[0][2] = position[2];
        } else if (current === 1) {
            this._vertices[0][3] = position[0];
            this._vertices[0][4] = position[1];
            this._vertices[0][5] = position[2];
            var xScreen = camera.project([this._vertices[0][0], this._vertices[0][1], this._vertices[0][2]]); 
            var yScreen = camera.project([this._vertices[0][3], this._vertices[0][4], this._vertices[0][5]]); 
            this._lines[0].updateVertices(xScreen[0], xScreen[1], yScreen[0], yScreen[1]);
        }
    };
    
    Ruler.prototype.render = function(renderer, camera) {
        if (!this.enabled) {
            return;
        }

        if (this._anchors[1].visible) {
            // Draw the line.
            this._renderLine(renderer, camera, 0);
        }
        
        if (this._current === 2) {
            for (var i = 1; i < 5; i++) {
                this._renderLine(renderer, camera, i);
            }
            // Update screen coord
            this._updateScreenCoords(camera);
        }

        // Draw the anchored pins
        for (var i = 0; i < 2; ++i) {
            var screenPosition = camera.project(this._anchors[i].position); 
            this._anchors[i].x = screenPosition[0];
            this._anchors[i].y = screenPosition[1];
        }
        this._eventEmitter.emit("rulerDotsUpdate", this._anchors[0], this._anchors[1], this._anchors[2]);
    }; 
    
    Ruler.prototype._updateSubLines = function(camera) {
        this._vertices[1][0] = this._vertices[0][0];
        this._vertices[1][1] = this._vertices[0][1];
        this._vertices[1][2] = this._vertices[0][2];
        this._vertices[1][3] = this._vertices[0][0];
        this._vertices[1][4] = this._vertices[0][1];
        this._vertices[1][5] = this._vertices[0][5];
        
        this._vertices[2][0] = this._vertices[0][3];
        this._vertices[2][1] = this._vertices[0][4];
        this._vertices[2][2] = this._vertices[0][5];
        this._vertices[2][3] = this._vertices[0][0];
        this._vertices[2][4] = this._vertices[0][4];
        this._vertices[2][5] = this._vertices[0][5];
        
        this._vertices[3][0] = this._vertices[0][0];
        this._vertices[3][1] = this._vertices[0][1];
        this._vertices[3][2] = this._vertices[0][5];
        this._vertices[3][3] = this._vertices[0][0];
        this._vertices[3][4] = this._vertices[0][4];
        this._vertices[3][5] = this._vertices[0][5];
        
        this._vertices[4][0] = this._vertices[0][3];
        this._vertices[4][1] = this._vertices[0][4];
        this._vertices[4][2] = this._vertices[0][5];
        this._vertices[4][3] = this._vertices[0][0];
        this._vertices[4][4] = this._vertices[0][1];
        this._vertices[4][5] = this._vertices[0][5];
        
        // Compute the distance between two points and
        // show it on the line.
        var dx = this._anchors[0].position[0] - this._anchors[1].position[0];
        var dy = this._anchors[0].position[1] - this._anchors[1].position[1];
        var dz = this._anchors[0].position[2] - this._anchors[1].position[2];

        var label = Math.sqrt(dx * dx + dy * dy + dz * dz) * this._scene.scaleRatio;
        var res = {
            distance: Math.round(label * 100) / 100,
            x       : Math.abs(Math.round(dx * this._scene.scaleRatio * 100) / 100) ,
            y       : Math.abs(Math.round(dy * this._scene.scaleRatio * 100) / 100) ,
            z       : Math.abs(Math.round(dz * this._scene.scaleRatio * 100) / 100)
        };
        this._eventEmitter.emit("rulerupdate", res);
    };
    
    Ruler.prototype._updateScreenCoords = function (camera) {
        var xScreen = this._getScreenPosition(this._vertices[2], camera);
        var yScreen = this._getScreenPosition(this._vertices[3], camera);
        var zScreen = this._getScreenPosition(this._vertices[1], camera);
        this._eventEmitter.emit("rulerXYZUpdate", xScreen, yScreen, zScreen);
    };
    
    return Ruler;
})();
    

