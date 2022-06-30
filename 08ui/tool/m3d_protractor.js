//
// m3d_protractor.js
// The protractor gizmo
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
    
    function Protractor(scene, resourceManager, eventEmitter) {
        // public:
        Measure.apply(this, arguments);
        if (Globals.isMobile) {
            return;
        }
        this._anchors  = [
            {visible: false, x: 0, y: 0, position: [], snapped: false},
            {visible: false, x: 0, y: 0, position: [], snapped: false},
            {visible: false, x: 0, y: 0, position: [], snapped: false},
            {visible: false, x: 0, y: 0, position: [], snapped: false}
        ];
        
        this._lines[0] = new MyLine("line_0", resourceManager, [0.969, 0.398, 0.238], false);
        this._lines[1] = new MyLine("line_1", resourceManager, [0.969, 0.398, 0.238], false);
        this._lines[2] = new MyLine("line_2", resourceManager, [0.969, 0.398, 0.238], false);
        for (var i = 0; i < 3; i++) {
            this._vertices.push(new Float32Array(6));
        }
    }; 
    Protractor.prototype = Object.create(Measure.prototype);
    Protractor.prototype.constructor = Protractor;
    
    Protractor.prototype.setEnabled = function(enabled) {
        this.enabled = enabled;
        if (!this.enabled) {
            this._current = 0;
            this._bufferDirty = true;
            this._anchors[0].visible = false;
            this._anchors[1].visible = false;
            this._anchors[2].visible = false;
            this._anchors[3].visible = false;
            this._eventEmitter.emit("protractorDotsUpdate", this._anchors[0], this._anchors[1], this._anchors[2], this._anchors[3]);
        }
        Measure.prototype.setEnabled.apply(this, arguments);
    }; 

    Protractor.prototype.onMouseWheel = function(mouse, renderer, camera) {
        if (!this.enabled) {
            return;
        }
        // if the one point is pressed, and wheel happens, do not render the line
        if (this._current === 1 || this._current === 2) {
            this._anchors[1].visible = false;
            this._anchors[2].visible = false;
        }
        
        // do not show the mouse point while wheeling
        this._anchors[3].visible = false;
        // Invalidate the snapping buffers if camera changes.
        if (this._normalSnapping || this._lineSnapping) {
            this._bufferDirty = true;
            this._bufferDirtyTime = Globals.frame;
        }
    };
    
    Protractor.prototype.onMouseMove = function(mouse, renderer, camera) {
        if (!this.enabled) {
            return;
        }
        // Hide the ruler line when users are dragging the model.
        // Also make the maps dirty. Rotate movement
        this._anchors[3].visible = true && (this._normalSnapping || this._lineSnapping);
        if (mouse.event.buttonDown !== 0) {
            // if rotating happens, do not show the mouse blue dot
            this._anchors[3].visible = false;
            if (this._current === 1 || this._current === 2) {
                this._anchors[1].visible = false;
                this._anchors[2].visible = false;
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
            
            this._anchors[1].visible = true;
            
            if (this._current === 1) {
                this._updateAnchor(x, y, position, camera);
                this._anchors[2].visible = false;
            }
            
            if (this._current === 2) {
                this._updateAnchor(x, y, position, camera);
                this._anchors[2].visible = true;
            }

            // update snap point to mouse dot
            this._anchors[3].x = x;
            this._anchors[3].y = y;
            
        }
    }; 
    
    //Do not consider wheel and double click event in ruler since we need to wait until
    //the camera stops then re-take the normal depth map. This is too complicated.
    Protractor.prototype.onMouseUp = function(mouse, renderer, camera) {
        if (!this.enabled) {
            return false;
        }

        // Start a new measurement.
        if (this._current === 3) {
            this._current = 0;
            this._distance = {};
            this._anchors[0].visible = false;
            this._anchors[1].visible = false;
            this._anchors[2].visible = false;
        }
        
        var x = mouse.x;
        var y = mouse.y;
        if (this._normalSnapping || this._lineSnapping) {
            x = this._snapCoord[0];
            y = this._snapCoord[1];
        }

        if (this._current === 0) {
            this._eventEmitter.emit("protractorUpdate", -1);
        }
        var position = this._depthQuery.unproject(x, y, renderer, camera);
        if (position) {
            if ((this._lineSnapping ||this._normalSnapping) && !this._bufferDirty) {
                this._snapFine(position, renderer, camera);
            } else {
                this._updateAnchor(x, y, position, camera);
            }

            this._anchors[this._current].visible = true;
            if (this._current === 1 || this._current === 2) {
                this._updateSubLines(camera);
            }
            
            this._current++;

            return true;
        }

        return false;
    }; 

    Protractor.prototype._updateAnchor = function(x, y, position, camera) {
        // We should update the first anchor during mouse movement when both
        // two are pinned donw.
        var current = this._current % 3;
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
            this._vertices[1][0] = position[0];
            this._vertices[1][1] = position[1];
            this._vertices[1][2] = position[2];
            var xScreen = camera.project([this._vertices[0][0], this._vertices[0][1], this._vertices[0][2]]); 
            var yScreen = camera.project([this._vertices[0][3], this._vertices[0][4], this._vertices[0][5]]); 
            this._lines[0].updateVertices(xScreen[0], xScreen[1], yScreen[0], yScreen[1]);
        } else if (current === 2) {
            this._vertices[1][3] = position[0];
            this._vertices[1][4] = position[1];
            this._vertices[1][5] = position[2];
            var xScreen = camera.project([this._vertices[1][0], this._vertices[1][1], this._vertices[1][2]]); 
            var yScreen = camera.project([this._vertices[1][3], this._vertices[1][4], this._vertices[1][5]]); 
            this._lines[1].updateVertices(xScreen[0], xScreen[1], yScreen[0], yScreen[1]);
        }
    };
    
    Protractor.prototype.render = function(renderer, camera) {
        if (!this.enabled) {
            return;
        }

        if (this._anchors[1].visible) {
            // Draw the line.
            this._renderLine(renderer, camera, 0);
        }
        if (this._anchors[2].visible) {
            // Draw the line.
            this._renderLine(renderer, camera, 1);
        }
        
        if (this._current === 3) {
            for (var i = 1; i < 3; i++) {
                this._renderLine(renderer, camera, i);
            }
        }

        // Draw the anchored pins
        for (var i = 0; i < 3; ++i) {
            var screenPosition = camera.project(this._anchors[i].position); 
            this._anchors[i].x = screenPosition[0];
            this._anchors[i].y = screenPosition[1];
        }
        this._eventEmitter.emit("protractorDotsUpdate", this._anchors[0], this._anchors[1], this._anchors[2], this._anchors[3]);
    }; 
    
    Protractor.prototype._updateSubLines = function(camera) {
        var tmp0 = vec3.create();
        var tmp1 = vec3.create();
        vec3.sub(tmp0, this._anchors[0].position, this._anchors[1].position);
        vec3.sub(tmp1, this._anchors[2].position, this._anchors[1].position);
        var length0 = vec3.length(tmp0);
        var length1 = vec3.length(tmp1);
        
        var angle = vec3.angle(tmp0, tmp1);
        var length = Math.min(length0, length1);
        vec3.lerp(tmp0, this._anchors[1].position, this._anchors[0].position, length * 0.1 / length0);
        vec3.lerp(tmp1, this._anchors[1].position, this._anchors[2].position, length * 0.1 / length1);
        
        this._vertices[2][0] = tmp0[0];
        this._vertices[2][1] = tmp0[1];
        this._vertices[2][2] = tmp0[2];
        this._vertices[2][3] = tmp1[0];
        this._vertices[2][4] = tmp1[1];
        this._vertices[2][5] = tmp1[2];
        
        if (this._current === 2) {
            this._eventEmitter.emit("protractorUpdate", angle);
        }
    };

    return Protractor;
})();
    

