//
// m3d_unitplane.debug.js
// render a texture in a corner of the window
//
//  

var modelo3d = modelo3d || {};

(function() {
    "use strict";

    modelo3d.UnitPlane = function(resourceManager) {
        // private:
        this._enabled      = false;
        this._ready        = false;
        this._material     = null;
        this._renderTarget = null;
        this._drawable         = null;
        this._mesh         = null;

        var that = this;
        var shader = resourceManager.getShader("simple");
        shader.createFromFile("/model/shaders/simple.vs", "/model/shaders/simple.fs",
            function() {
                that._material = new modelo3d.Material("unitplane");
                that._material.attachShader(shader);
                that._material.materialParameters["uMaterial.kd"].value = new Float32Array([0.0, 0.0, 1.0]);
                that._material.materialParameters["uMaterial.transparent"].value = 1.0;

                that._renderTarget = new modelo3d.RenderTarget("default", resourceManager, 
                    modelo3d.width, modelo3d.height);

                var indices = new Uint16Array(8);
                indices[0] = 0;
                indices[1] = 1;
                indices[2] = 1;
                indices[3] = 2;
                indices[4] = 2;
                indices[5] = 3;
                indices[6] = 3;
                indices[7] = 0;

                var vertices = new Float32Array(12);
                vertices[0] = 0.0; vertices[1] = 0.0; vertices[2] = 0.0;
                vertices[3] = 1.0; vertices[4] = 0.0; vertices[5] = 0.0;
                vertices[6] = 1.0; vertices[7] = 1.0; vertices[8] = 0.0;
                vertices[9] = 0.0; vertices[10] = 1.0; vertices[11] = 0.0;
        
                var attributes = {
                    "primitive": gl.LINES,
                    "values": {
                        "POSITION": {
                            index: 0,
                            offset: 0,
                            stride: 12,
                            size: 3,
                            type: gl.FLOAT
                        }
                    }
                };

                that._mesh = resourceManager.getMesh("unitplane");
                that._mesh.create(attributes, vertices, indices);

                that._drawable = new modelo3d.Drawable("unitplane", that._mesh, null, that._material);

                that._ready = true;
            });
    };

    modelo3d.UnitPlane.prototype.destroy = function() {
        if (this._ready) {
            this._material.destroy();
            this._renderTarget.destroy();
            this._drawable.destroy();
            this._mesh.destroy();
        }
    };
    
    modelo3d.UnitPlane.prototype.setEnabled = function(enabled) {
        this._enabled = enabled;
    };
    
    modelo3d.UnitPlane.prototype.render = function(scene, renderer, camera) {
        if (!this._ready) {
            console.log("unitplane is not ready.");
            return;
        }
        if (!this._enabled) {
            return;
        }

        renderer.clear(this._renderTarget, gl.DEPTH_BUFFER_BIT);
        renderer.drawDrawable(this._renderTarget, this._drawable, camera, 
                this._material, false);
        
    };

})();
