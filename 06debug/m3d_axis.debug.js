//
// m3d_axis.debug.js
// render a axis to indicate world XYZ
//
//  
import Globals        from "../m3d_globals.js";
import Gizmo          from "../03scene/drawables/m3d_gizmo.js";
import RenderTarget   from "../04renderer/m3d_rendertarget.js";

export default (function() {
    "use strict";
    
    function Axis (resourceManager) {
        // private:
        this._enabled      = false;
        this._ready        = false;
        this._materialx    = null;
        this._materialy    = null;
        this._materialz    = null;
        this._renderTarget = null;
        this._drawablex    = null;
        this._drawabley    = null;
        this._drawablez    = null;
        this._meshx        = null;
        this._meshy        = null;
        this._meshz        = null;
        this._vertices     = new Float32Array(6);
        this._indices      = new Uint8Array(2);
        
        this._renderTarget = new RenderTarget("default", resourceManager, 
                            Globals.width, Globals.height);
                            
        this._meshx = resourceManager.getMesh("axis-x");
        this._meshx.createLine();
        this._drawablex = new Gizmo("axis-x", this._meshx, resourceManager);
        this._drawablex.setColor([1.0, 0.0, .0,]);
        this._drawablex.setTransparent(0.0);
        
        this._meshy = resourceManager.getMesh("axis-y");
        this._meshy.createLine();
        this._drawabley = new Gizmo("axis-y", this._meshy, resourceManager);
        this._drawabley.setColor([0.0, 1.0, 0.0,]);
        this._drawabley.setTransparent(0.0);
        
        this._meshz = resourceManager.getMesh("axis-z");
        this._meshz.createLine();
        this._drawablez = new Gizmo("axis-z", this._meshz, resourceManager);
        this._drawablez.setColor([0.0, 0.0, 1.0,]);
        this._drawablez.setTransparent(0.0);
        
        this._indices[0] = 0;
        this._indices[1] = 1;

        this._vertices[0] = 0.0; this._vertices[1] = 0; this._vertices[2] = 0;
        this._vertices[3] = 10.0; this._vertices[4] = 0; this._vertices[5] = 0;
        this._drawablex.mesh.update(this._vertices, this._indices, gl.UNSIGNED_BYTE);

        this._vertices[0] = 0.0; this._vertices[1] = 0; this._vertices[2] = 0;
        this._vertices[3] = 0.0; this._vertices[4] = 10.0; this._vertices[5] = 0;
        this._drawabley.mesh.update(this._vertices, this._indices, gl.UNSIGNED_BYTE);

        this._vertices[0] = 0.0; this._vertices[1] = 0; this._vertices[2] = 0;
        this._vertices[3] = 0.0; this._vertices[4] = 0; this._vertices[5] = 10.0;
        this._drawablez.mesh.update(this._vertices, this._indices, gl.UNSIGNED_BYTE);
    };

    Axis.prototype.destroy = function() {
        this._meshx.destroy();
        this._meshy.destroy();
        this._meshz.destroy();
        this._renderTarget = null;
        this._drawablex = null;
        this._drawabley = null;
        this._drawablez = null;
    };

    Axis.prototype.setEnabled = function(enabled) {
        this._enabled = enabled;
    };

    Axis.prototype.setPositionAndScale = function(x, y, z, length) {
        length = length || 10;
        this._vertices[0] = x;          this._vertices[1] =  y;         this._vertices[2] = z;
        this._vertices[3] = x + length; this._vertices[4] =  y;         this._vertices[5] = z;
        this._drawablex.mesh.update(this._vertices, this._indices, gl.UNSIGNED_BYTE);

        this._vertices[0] = x;          this._vertices[1] = y;          this._vertices[2] = z;
        this._vertices[3] = x;          this._vertices[4] = y + length; this._vertices[5] = 0;
        this._drawabley.mesh.update(this._vertices, this._indices, gl.UNSIGNED_BYTE);

        this._vertices[0] = x;          this._vertices[1] = y;          this._vertices[2] = z;
        this._vertices[3] = x;          this._vertices[4] = y;          this._vertices[5] = z + 10.0;
        this._drawablez.mesh.update(this._vertices, this._indices, gl.UNSIGNED_BYTE);

    };
    
    Axis.prototype.render = function(scene, renderer, camera) {
        if (!this._enabled) {
            return;
        }

        renderer.clear(this._renderTarget, gl.DEPTH_BUFFER_BIT);
        renderer.drawDrawable(this._renderTarget, this._drawablex, camera, null, null, null, false);
        renderer.drawDrawable(this._renderTarget, this._drawabley, camera, null, null, null, false);
        renderer.drawDrawable(this._renderTarget, this._drawablez, camera, null, null, null, false);
    };
    
    return Axis;
})();
