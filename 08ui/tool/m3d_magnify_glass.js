//
// m3d_magnify_glass.js
// Magnify target region
//
//  

import Globals      from "../../m3d_globals.js";
import Gizmo2D      from "../../03scene/drawables/m3d_gizmo2d.js";
import SceneCamera  from "../../03scene/camera/m3d_scene_camera.js";
import CameraAnimatorTransition from "../../03scene/camera/m3d_camera_animator_transition.js";
import RenderTarget from "../../04renderer/m3d_rendertarget.js";
import DepthQuery   from "./m3d_depth_query.js";

export default (function() {
    "use strict";

    function MagnifyGlass(scene, resourceManager, camera, _eventEmitter) {
        // private:
        this._scene        = scene;
        this._camera       = camera;
        this._eventEmitter = _eventEmitter;
        this._animator     = new CameraAnimatorTransition();

        this._startX     = 0;
        this._startY     = 0;
        this._endX       = 0;
        this._endY       = 0;
        this._enabled    = false;

        this._drawable       = null;

        this._ZOOM_LIMIT = 0.01;
        this._lineWidth  = 1;
        this._dashLength = 1;

        this._depthQuery = new DepthQuery(scene, resourceManager);
        this._renderTarget = new RenderTarget("default", resourceManager,
            Globals.width, Globals.height, { depthTest: false });

        var mesh = resourceManager.getMesh("magnify");
        mesh.createQuad();
        this._drawable = new Gizmo2D("magnify", mesh, resourceManager);

        var texture = resourceManager.getTexture("magnify");
        var that = this;
        texture.createFromFile("data:image/png;base64,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",
                gl.RGB, gl.LINEAR, gl.REPEAT, function(texture) {
                    that._drawable.setTexture(texture);
                    that._dashLength = texture.width;
            });


        this._vertices = new Float32Array(80);
        this._indices  = new Uint8Array(24);
        for (var i = 0; i < 4; ++i) {
            this._indices[0 + i * 6] = 0 + i * 4;
            this._indices[1 + i * 6] = 1 + i * 4;
            this._indices[2 + i * 6] = 2 + i * 4;
            this._indices[3 + i * 6] = 2 + i * 4;
            this._indices[4 + i * 6] = 3 + i * 4;
            this._indices[5 + i * 6] = 0 + i * 4;
        }
        this._resetVertices();
    };

    MagnifyGlass.prototype.destroy = function() {
        this._renderTarget.destroy();
        this._depthQuery.destroy();
        this._drawable.destroy();
        this._vertices = null;
        this._indices = null;
    };

    MagnifyGlass.isEnabled = function() {
        return this._enable;
    };

    MagnifyGlass.prototype.setEnabled = function(enabled) {
        this._enabled = enabled;

        if (!this._enabled) {
            this._startX = 0;
            this._startY = 0;
            this._endX = 0;
            this._endY = 0;
        }
    };

    MagnifyGlass.prototype.render = function(renderer) {
        if (!this._enabled) {
            return;
        }

        renderer.drawDrawable(this._renderTarget, this._drawable, this._camera,
                null, null, null, false);
    };

    MagnifyGlass.prototype.onMouseDown = function(mouse) {
        if (!this._enabled || mouse.event.buttonDown !== 1) {
            return true;
        }
        this._startX = mouse.x;
        this._startY = mouse.y;
        this._endX = this._startX;
        this._endY = this._startY;
        return false;
    };

    MagnifyGlass.prototype.onMouseMove = function(mouse) {
        if (!this._enabled || mouse.event.buttonDown !== 1 || !mouse.down) {
            return true;
        }
        this._endX += mouse.dx;
        this._endY += mouse.dy;

        this._updateVertices();
        return false;
    };

    MagnifyGlass.prototype.onMouseUp = function(mouse, renderer) {
        if (!this._enabled || mouse.event.buttonDown !== 1) {
            return true;
        }

        this._inputStop(renderer);
        return false;
    };

    MagnifyGlass.prototype.onTouchStart = function(touch) {
        if (!this._enabled || touch.numCursors !== 1) {
            return true;
        }
        var cursor0 = touch.cursor(0);
        this._startX = cursor0.x;
        this._startY = cursor0.y;
        this._endX = this._startX;
        this._endY = this._startY;

        return false;
    };

    MagnifyGlass.prototype.onTouchMove = function(touch) {
        if (!this._enabled || touch.numCursors !== 1) {
            return true;
        }
        var cursor0 = touch.cursor(0);
        this._endX += cursor0.dx;
        this._endY += cursor0.dy;
        this._updateVertices();

        return false;
    };

    MagnifyGlass.prototype.onTouchStop = function(touch, renderer) {
        if (!this._enabled || touch.numCursors !== 1) {
            return true;
        }

        this._inputStop(renderer);
        return false;
    };

    MagnifyGlass.prototype._inputStop = function(renderer) {
        this._resetVertices();

        if (this._startX > this._endX) {
            var tmp = this._startX;
            this._startX = this._endX;
            this._endX = tmp;
        }
        if (this._startY > this._endY) {
            var tmp = this._startY;
            this._startY = this._endY;
            this._endY = tmp;
        }

        if (this._startX === this._endX || this._startY === this._endY) {
            this.setEnabled(false);
            return this._eventEmitter.emit("magnificationSelected");
        }
 
        var position = this._depthQuery.getNearest(this._startX, this._startY,
                this._endX, this._endY, renderer, this._camera);
        if (position === null) {
            this.setEnabled(false);
            return this._eventEmitter.emit("magnificationSelected");
        }

        var dir = vec3.create();
        vec3.subtract(dir, position, this._camera.eye);
        var distance = vec3.length(dir);
        if (distance < this._ZOOM_LIMIT * this._scene.radius) {
            this.setEnabled(false);
            return this._eventEmitter.emit("magnificationSelected");
        }
        var scale = Math.max(Math.abs(this._endX - this._startX) / Globals.width,
                             Math.abs(this._endY - this._startY) / Globals.height);
        
        if (this._camera.isPerspective()) {
            var cameraData = {
                fov: this._camera._fov,
                theta: this._camera._theta,
                phi: this._camera._phi,
                at: [position[0], position[1], position[2]],
                distance: scale * distance
            };

            this._animator.bind(this._camera);
            this._animator.start(cameraData, false, 50);
        } else {
            this._camera.zoomBy(scale);
        }

        this.setEnabled(false);
        this._eventEmitter.emit("magnificationSelected");
        return null;
    };

    MagnifyGlass.prototype.resize = function(width, height) {
        this._renderTarget.resize(width, height);
    };

    MagnifyGlass.prototype.setLineWidth = function(lineWidth) {
        this._lineWidth = lineWidth;
    };

    MagnifyGlass.prototype._updateVertices = function() {
        var sx = this._startX;
        var ex = this._endX;
        var sy = this._startY;
        var ey = this._endY;
        if (this._startX > this._endX) {
            sx = this._endX;
            ex = this._startX;
        }

        if (this._startY > this._endY) {
            sy = this._endY;
            ey = this._startY;
        }

        sx = Math.floor(sx * Globals.devicePixelRatio);
        sy = Math.floor(Globals.height - 1 - sy * Globals.devicePixelRatio);
        ex = Math.floor(ex * Globals.devicePixelRatio);
        ey = Math.floor(Globals.height - 1 - ey * Globals.devicePixelRatio);

        var w = ex - sx;
        var h = sy - ey;

        var t = Math.floor(this._lineWidth * Globals.devicePixelRatio);

        this._addQuad(sx, sy, sx + t, ey, 0, 0, h, h, 0);
        this._addQuad(sx, sy, ex, sy + t, 0, w, w, 0, 20);
        this._addQuad(ex - t, sy, ex, ey, 0, 0, h, h, 40);
        this._addQuad(sx, ey - t, ex, ey, 0, w, w, 0, 60);

        this._drawable.mesh.update(this._vertices, this._indices, gl.UNSIGNED_BYTE);
    };

    MagnifyGlass.prototype._addQuad = function(sx, sy, ex, ey, t0, t1, t2, t3, offset) {
        sx = sx / Globals.width * 2.0 - 1.0;
        ex = ex / Globals.width * 2.0 - 1.0;
        sy = sy / Globals.height * 2.0 - 1.0;
        ey = ey / Globals.height * 2.0 - 1.0;

        this._vertices[0 + offset] = sx;
        this._vertices[1 + offset] = sy;
        this._vertices[2 + offset] = 0.0;
        this._vertices[3 + offset] = t0 / this._dashLength;
        this._vertices[4 + offset] = 0.5;

        this._vertices[5 + offset] = ex;
        this._vertices[6 + offset] = sy;
        this._vertices[7 + offset] = 0.0;
        this._vertices[8 + offset] = t1 / this._dashLength;
        this._vertices[9 + offset] = 0.5;

        this._vertices[10 + offset] = ex;
        this._vertices[11 + offset] = ey;
        this._vertices[12 + offset] = 0.0;
        this._vertices[13 + offset] = t2 / this._dashLength; 
        this._vertices[14 + offset] = 0.5;

        this._vertices[15 + offset] = sx;
        this._vertices[16 + offset] = ey;
        this._vertices[17 + offset] = 0.0;
        this._vertices[18 + offset] = t3 / this._dashLength;
        this._vertices[19 + offset] = 0.5;
    };

    MagnifyGlass.prototype._resetVertices = function() {
        for (var i = 0; i < 80; ++i) {
            this._vertices[i] = -1000000;
        }
        this._drawable.mesh.update(this._vertices, this._indices, gl.UNSIGNED_BYTE);
    };

    return MagnifyGlass;
})();
    
