//
// m3d_measure.js
// The measure gizmo
//
//  


import Globals       from "../../m3d_globals.js";
import MyMath        from "../../00utility/m3d_math.js";
import Gizmo2D       from "../../03scene/drawables/m3d_gizmo2d.js";
import Material      from "../../03scene/materials/m3d_material.js";
import RenderTarget  from "../../04renderer/m3d_rendertarget.js";

export default (function() {
    "use strict";
    
    function MyLine(name, resourceManager, color, isDashed) {
        this._dashed     = isDashed;
        this._lineWidth    = Math.floor(3 * Globals.devicePixelRatio);

        var mesh = resourceManager.getMesh("line_mesh_" + name);
        mesh.createSolidQuad();
        this._drawable = new Gizmo2D("line_drawable_" + name, mesh, resourceManager);
        this._drawable.setColor(color);
        this._drawable.setTransparent(0.0);

        if (!this._dashed) {
            this._vertices = new Float32Array(12);
            this._indices  = new Uint8Array(6);
            this._indices[0] = 0; this._indices[1] = 1; this._indices[2] = 2;
            this._indices[3] = 2; this._indices[4] = 3; this._indices[5] = 0;
        } else {
            this._vertices = new Float32Array(240); //20  quads
            this._indices  = new Uint8Array(120);
            for (var i = 0; i < 20; ++i) {
                this._indices[0 + i * 6] = 0 + i * 4;
                this._indices[1 + i * 6] = 1 + i * 4;
                this._indices[2 + i * 6] = 2 + i * 4;
                this._indices[3 + i * 6] = 2 + i * 4;
                this._indices[4 + i * 6] = 3 + i * 4;
                this._indices[5 + i * 6] = 0 + i * 4;
            }
        }

        for (var i = 0; i < this._vertices.length; ++i) {
            this._vertices[i] = -1000000;
        }
        this._drawable.mesh.update(this._vertices, this._indices, gl.UNSIGNED_BYTE);
    };
    
    MyLine.prototype.render = function(renderTarget, renderer, camera) {
        renderer.drawDrawable(renderTarget, this._drawable, camera, null, null, null, false);
    };

    MyLine.prototype._addQuad = function(sx, sy, ex, ey, offset) {
        var w = ex - sx;
        var h = ey - sy;
        var angle = Math.atan2(w, h);

        var sign = Math.sign(w * h) || 1;
        var yh = Math.sin(angle) * this._lineWidth * 0.5 / Globals.height * sign;
        var xh = Math.cos(angle) * this._lineWidth * 0.5 / Globals.width * sign;
        
        //Set to -1 to 1, the quad range
        sx = sx / Globals.width * 2.0 - 1.0;
        ex = ex / Globals.width * 2.0 - 1.0;
        sy = sy / Globals.height * 2.0 - 1.0;
        ey = ey / Globals.height * 2.0 - 1.0;

        this._vertices[0 + offset] = sx - xh;
        this._vertices[1 + offset] = sy + yh;

        this._vertices[3 + offset] = sx + xh;
        this._vertices[4 + offset] = sy - yh;

        this._vertices[6 + offset] = ex + xh;
        this._vertices[7 + offset] = ey - yh;

        this._vertices[9 + offset] = ex - xh;
        this._vertices[10 + offset] = ey + yh;
        
        this._vertices[2 + offset] = 0.0;
        this._vertices[5 + offset] = 0.0;
        this._vertices[8 + offset] = 0.0;
        this._vertices[11 + offset] = 0.0;
    }
    
    MyLine.prototype.updateVertices = function(startX, startY, endX, endY) {
        var sx = startX;
        var ex = endX;
        var sy = startY;
        var ey = endY;

        sx = sx * Globals.devicePixelRatio;
        sy = Globals.height - 1 - sy * Globals.devicePixelRatio;
        ex = ex * Globals.devicePixelRatio;
        ey = Globals.height - 1 - ey * Globals.devicePixelRatio;
        
        var w = ex - sx;
        var h = ey - sy;

        if (this._dashed) {
            for (var i = 0; i < 20; i++) {
                var subSx = sx + w / 39 * 2 * i;
                var subSy = sy + h / 39 * 2 * i; 
                var subEx = subSx + w / 39;
                var subEy = subSy + h / 39;
                //pixel pos
                this._addQuad(subSx, subSy, subEx, subEy, i * 12);
            }
        } else {
            this._addQuad(sx, sy, ex, ey, 0);
        }
        
        this._drawable.mesh.update(this._vertices, this._indices, gl.UNSIGNED_BYTE);
    };
    
    MyLine.prototype.setLineWidth = function (width) {
        this._lineWidth = Math.floor(Math.min(width, 1) * Globals.devicePixelRatio);
    };
    
    MyLine.prototype.destroy = function () {
        this._drawable.destroy();
        this._vertices = null;
        this._indices  = null;
    };
    
    return MyLine;    
})();
