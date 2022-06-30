//
// m3d_section.js
// The section _gizmo
//
//  

import Globals        from "../../m3d_globals.js";
import MyMath         from "../../00utility/m3d_math.js";
import MeshAttributes from "../../02resource/m3d_mesh_attribute.js";
import ShaderLibrary  from "../../02resource/m3d_shader_library.js";
import Gizmo          from "../../03scene/drawables/m3d_gizmo.js";
import Material       from "../../03scene/materials/m3d_material.js";
import RenderTarget   from "../../04renderer/m3d_rendertarget.js";
import RenderPass     from "../../04renderer/m3d_renderpass.js";

export default (function() {
    "use strict";

    function _NormalDepthObject(resourceManager, scene) {
        this.renderTarget    = new RenderTarget("section-normal-depth", resourceManager,
                                            Globals.width, Globals.height, {
                                                colorFormat: "RGBA32F", 
                                                clearColor: [0.0, 0.0, 0.0, 0.0],
                                                colorBuffer: 0,
                                                depthFormat: gl.DEPTH_STENCIL,
                                                depthBuffer: 0 
                                            });
                                            
        this.buffer          = new Float32Array(Globals.width * Globals.height * 4);
        this.bufferDirty     = true;
        this.bufferDirtyTime = 0;
        this.normal          = vec3.create();
        this.position        = vec3.create();
        this.inversedVPMatrix = mat4.create();
        this.renderPass       = new RenderPass(scene, false, true, {line : false});
        
        var shader = resourceManager.getShader("normaldepth", ["WORLDSPACE_NORMAL"]);
        if (!shader.ready) {
            var shaderSource = ShaderLibrary["normaldepth"];
            shader.createFromShaderSource(shaderSource, ["WORLDSPACE_NORMAL"]);
        }
        this.renderPass.setOverridedShader(shader);
        this.renderPass.setOverridedMaterial(new Material("section-normal-depth"));
    };
    
    _NormalDepthObject.prototype.resize = function(width, height) {
        this.renderTarget.resize(width, height);
        this.buffer = new Float32Array(width * height * 4);
    };
    
    _NormalDepthObject.prototype.destroy = function() {
        this.buffer = null;
        this.normal = null;
        this.depth = null;
        this.inversedVPMatrix = null;
        this.renderTarget.destroy();
        this.renderPass.destroy();
    };
    
    _NormalDepthObject.prototype.render = function(renderer, camera) {
        //draw normal depth buffer
        renderer.invalidate();
        renderer.clear(this.renderTarget, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        this.renderPass.render(this.renderTarget, renderer, null, camera);
        gl.readPixels(0, 0, Globals.width, Globals.height, gl.RGBA, gl.FLOAT, this.buffer);
        mat4.invert(this.inversedVPMatrix, camera.vpMatrix);
    };
    
    _NormalDepthObject.prototype.getNormalDepth = function(x, y) {
        var width = Globals.width;
        var height = Globals.height;
        
        var offset = 4 * (x + (height - y) * width);
        var depth = this.buffer[offset + 3];
        
        var depth;
        if (depth === 0) {
            return false;
        } 
        
        var worldPosition = vec3.fromValues(2.0 * (x / width - 0.5),
                                            2.0 * ((height - 1 - y) / height - 0.5),
                                            2.0 * depth - 1.0);

        vec3.transformMat4(worldPosition, worldPosition, this.inversedVPMatrix);
        
        this.normal[0] = this.buffer[offset];
        this.normal[1] = this.buffer[offset + 1];
        this.normal[2] = this.buffer[offset + 2];
        
        //Line does not have normal info
        if (isNaN(this.normal[0]) || isNaN(this.normal[1]) || isNaN(this.normal[2])) {
            return false;
        }
        
        this.position[0] = worldPosition[0];
        this.position[1] = worldPosition[1];
        this.position[2] = worldPosition[2];
        
        return true;
    };
    
    function Section(scene, resourceManager, renderScene, _eventEmitter) {
        // public:
        this.enabled          = false;

        // private:
        this._scene            = scene;
        this._renderScene      = renderScene;
        this._eventEmitter     = _eventEmitter;
        this._cube             = null;
        this._plane            = null;
        this._sensitivity      = 0.005;
        this._interactive      = false;                            // When it is true, the section box is drawn and we can use mouse
                                                                // to change the section box.
        this._vertices         = new Float32Array(24);             // Plane mesh
        this._indices          = [];                               // Plane
        this._indices[0] = new Uint16Array([0, 4, 7, 7, 3, 0]); // -x
        this._indices[1] = new Uint16Array([0, 1, 5, 5, 4, 0]); // -y
        this._indices[2] = new Uint16Array([0, 3, 2, 2, 1, 0]); // -z
        this._indices[3] = new Uint16Array([5, 1, 2, 2, 6, 5]); // +x
        this._indices[4] = new Uint16Array([6, 2, 3, 3, 7, 6]); // +y
        this._indices[5] = new Uint16Array([4, 5, 6, 6, 7, 4]); // +z
        
        this._cubeRT = new RenderTarget("default", resourceManager, Globals.width, Globals.height);
            
        this._planeRT = new RenderTarget("default", resourceManager, Globals.width, Globals.height, 
                {depthTest: false, blend: true});

        var mesh;
        // Cube
        mesh = resourceManager.getMesh("wiredcube");
        mesh.createWiredCube();
        this._cube = new Gizmo("clipbox", mesh, resourceManager);
        this._cube.setColor([0.2, 0.2, 0.2]);
        this._cube.setTransparent(1.0);
        
        // Plane
        var attributes = new MeshAttributes();
        attributes.builtin(gl.FLOAT);
        mesh = resourceManager.getMesh("cliplane");
        mesh.create(gl.TRIANGLES, attributes, this._vertices, this._indices[0]);

        this._plane = new Gizmo("clipplane", mesh, resourceManager);
        this._plane.setColor([0.969, 0.322, 0.137]);
        this._plane.setTransparent(0.19);
        
        this._isPressed       = false;
        this._planeUpdated    = false;
        
        this._gizmoPlaneIndex = null;               // If mouse is down over a plane of the clip box, the _gizmo of clipping
                                                    // is enabled and _gizmo is pointing to the plane index of the cube.
        
        this._rotate          = false;              // if using rotate mode
        this._rotateMatrix    = mat4.create();
        this._invertedRotateMatrix = mat4.create();

        this._bbox            = MyMath.aabb.create();   // in rotate matrix's space, not world space
        this._sectionedBBox   = MyMath.aabb.create();   // ditto
        this._points          = MyMath.aabb.points(this._scene.clipping.getBBox());
        
        if (!Globals.isMobile) {
            this._normalDepth = new _NormalDepthObject(resourceManager, scene); 
        } else {
            console.warn("Rotation section box is not supported on iOS.");
        }
    }; 

    Section.prototype.destroy = function() {
        this._vertices = null;
        this._indices = null;
        this._plane.destroy();
        this._cube.destroy();
        this._cubeRT.destroy();
        this._planeRT.destroy();
        if (!Globals.isMobile) {
            this._normalDepth.destroy();
        }
    };
    
    Section.prototype.resize = function(width, height) {
        this._cubeRT.resize(width, height);
        this._planeRT.resize(width, height);
        if (!Globals.isMobile) {
            this._normalDepth.resize(width, height);
        }
    };

    var CUBE_INDICES = new Uint8Array([0, 1, 1, 2, 2, 3, 3, 0, 
                                       0, 4, 1, 5, 2, 6, 3, 7, 
                                       4, 5, 5, 6, 6, 7, 7, 4]);

    // update cube's vertices for rendering
    Section.prototype.updateGeometry = function(renderer) {
        this._vertices[0]  = this._points[0][0];  this._vertices[1]  = this._points[0][1]; this._vertices[2]  = this._points[0][2];
        this._vertices[3]  = this._points[1][0];  this._vertices[4]  = this._points[1][1]; this._vertices[5]  = this._points[1][2];
        this._vertices[6]  = this._points[2][0];  this._vertices[7]  = this._points[2][1]; this._vertices[8]  = this._points[2][2];
        this._vertices[9]  = this._points[3][0];  this._vertices[10] = this._points[3][1]; this._vertices[11] = this._points[3][2];
        this._vertices[12] = this._points[4][0];  this._vertices[13] = this._points[4][1]; this._vertices[14] = this._points[4][2];
        this._vertices[15] = this._points[5][0];  this._vertices[16] = this._points[5][1]; this._vertices[17] = this._points[5][2];
        this._vertices[18] = this._points[6][0];  this._vertices[19] = this._points[6][1]; this._vertices[20] = this._points[6][2];
        this._vertices[21] = this._points[7][0];  this._vertices[22] = this._points[7][1]; this._vertices[23] = this._points[7][2];
        this._cube.mesh.update(this._vertices, CUBE_INDICES, gl.UNSIGNED_BYTE);
        if (renderer) {
            renderer.renderState.invalidateClip();
        }
    }; 

    Section.prototype.render = function(renderer, camera) {
        if (this.enabled && this._interactive) {
            // Draw the clipping box
            renderer.drawGizmo(this._cubeRT, this._cube, camera, gl.CCW);
            
            renderer.renderState.invalidateClip();      
            renderer.clear(renderer._renderTarget, gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

            // Draw the _gizmo plane
            if (this._gizmoPlaneIndex !== null) {
                renderer.drawGizmo(this._planeRT, this._plane, camera, gl.CCW);
            }
        }
    }; 

    Section.prototype.reset = function(renderer) {
        this._rotate = false;
        this._updateBBox([0, -1, 0]);
        this._updatePoints();
        this.updateGeometry(renderer);
        if (!Globals.isMobile) {
            this._normalDepth.bufferDirty = true;
        }
    }; 
    
    Section.prototype.setClipRanges = function(min, max) {
        this._scene.clipping.set(min, max);
        if (typeof max[0] === 'number') {
            this._updateBBox([0, -1, 0]);
        } else {
            this._updateBBox(min[5]);
            for (var i = 0; i < this._points.length; i++) {
                vec3.copy(this._points[i], max[i]);
            }
        }
        for (var i = 0; i < this._points.length; i++) {
            vec3.transformMat4(this._points[i], this._points[i], this._rotateMatrix);
        }
        MyMath.aabb.createFromPoints(this._sectionedBBox, this._points);
        this._updatePoints();
        this.updateGeometry();
        this._gizmoPlaneIndex = null;
    }; 

    Section.prototype.setEnabled = function(enabled, renderer) {
        this.enabled = enabled;
        if (!this.enabled) {
            this.reset(renderer);
            this._scene.clipping.setEnabled(enabled);
        } else {
            this._scene.clipping.initialize(this._scene.bbox);
            this._scene.clipping.setEnabled(enabled);
            this._updateBBox([0, -1, 0]);
            this._updatePoints();
            this.updateGeometry(renderer);
        }
        if (this.enabled && this._normalDepth && !this._normalDepth.renderPass.queue.isValid()) {
            for (var i = 0, len = this._scene.model.drawables.length; i < len; i++) {
                this._normalDepth.renderPass.queue.addDrawable(this._scene.model.drawables[i]);
            }
        }
    }; 
    
    Section.prototype.setRotatable = function(enabled) {
        this._rotate = enabled;
        if (enabled) {
            this._gizmoPlaneIndex = null;
        }
    }; 

    Section.prototype.isRotatable = function(enabled) {
        return this._rotate;
    };

    Section.prototype.onMouseDown = function(mouse) {
        return this.enabled;
    }; 
    
    Section.prototype.onTouchStart = function(touch, camera) {
        if (!this.enabled || !this._interactive || touch.numCursors !== 1) {
            return false;
        }
        var cursor0 = touch.cursor(0);
        var x = cursor0.x;
        var y = cursor0.y;

        return this._focusPlane(x, y, camera);
    }; 
    
    Section.prototype.onMouseWheel = function(mouse) {
        if (!this.enabled) {
            return;
        }
        // if the one point is pressed, and wheel happens, do not render the line
        if (this._rotate) {
            this._normalDepth.bufferDirty = true;
            this._normalDepth.bufferDirtyTime = Globals.frame;
        }
    };
    
    Section.prototype.onMouseMove = function(mouse, pressed, camera, renderer) {
        if (!this.enabled || !this._interactive) {
            return false;
        }
        this._isPressed = pressed;
        
        if (mouse.event.buttonDown !== 0 && mouse.moved && this._rotate) {
            this._normalDepth.bufferDirty = true;
            this._normalDepth.bufferDirtyTime = Globals.frame;
            return false;
        }
        
        if (mouse.moved && this._normalDepth.bufferDirty && (!camera.updated && this._normalDepth.bufferDirtyTime < Globals.frame)) {
            this._normalDepth.render(renderer, camera);
            this._normalDepth.bufferDirty = false;
        }
        
        if (pressed) {
            return this._updatePlane(mouse.dx);
        } else {
            if (this._rotate && !this._normalDepth.bufferDirty) {
                return this.updateCube(mouse, camera, [0.5, 0.5, 0.5]);
            }
            return this._focusPlane(mouse.x, mouse.y, camera);
        }
    }; 

    Section.prototype.onTouchMove = function(touch) {
        if (!this.enabled || !this._interactive || touch.numCursors !== 1) {
            return false;
        }
        this._isPressed = true;
        var cursor0 = touch.cursor(0);
        return this._updatePlane(cursor0.dx);
    }; 
    
    Section.prototype.onMouseUp = function(mouse, renderer, camera) {
        if (!this.enabled || !this._interactive) {
            return;
        }

        if (this._rotate && !this._normalDepth.bufferDirty) {
            var res = this.updateCube(mouse, camera, [0.2, 0.2, 0.2]);
            if (res) {
                this._eventEmitter.emit("rotateSectionFacePicked");
            }
        }
        
        this._gizmoPlaneIndex = null;
        this._isPressed = false;
    }; 

    Section.prototype.updateCube = function(mouse, camera, color) {
        var res = this._normalDepth.getNormalDepth(Math.floor(mouse.x * Globals.devicePixelRatio), Math.floor(mouse.y * Globals.devicePixelRatio));
        if (res) {
            //update rotated cube's 8 points' world position
            this._updateBBox(this._normalDepth.normal);
            this._cube.setColor(color);
            //update buffer of cube
            this.updateGeometry();
            this._scene.radius = this._scene.clipping.getRadius();
            camera._updateProjection();
        }
        return res;
    };

    Section.prototype.onTouchStop = function() {
        if (!this.enabled || !this._interactive) {
            return;
        }
        this._gizmoPlaneIndex = null;
        this._isPressed = false;
    }; 

    Section.prototype.isInteractEnabled = function() {
        return this._interactive;
    };
    
    Section.prototype.setInteractEnabled = function(enabled) {
        this._interactive = enabled;
    };
    
    Section.prototype.setSensitivity = function(sensitivity) {
        this._sensitivity = sensitivity;
    };
    
    Section.prototype._updatePlane = function(dx) {
        if (this._gizmoPlaneIndex !== null) {
            var offset = dx * this._sensitivity;

            var index = this._gizmoPlaneIndex > 2 ? 1 : 0;
            var axis  = this._gizmoPlaneIndex % 3;
            var sign  = this._gizmoPlaneIndex > 2 ? -1 : 1;
            
            offset *= sign * (this._scene.bbox[3 + axis] - this._scene.bbox[axis]);
            var maxRange, minRange;
            var bufferRange = 2e-5;
            if (index === 0) {
                minRange = this._bbox[axis] + bufferRange;
                maxRange = this._sectionedBBox[3 + axis] - bufferRange;
            } else {
                minRange = this._sectionedBBox[axis] + bufferRange;
                maxRange = this._bbox[3 + axis] - bufferRange;
            }
            this._sectionedBBox[index * 3 + axis] = MyMath.clamp(this._sectionedBBox[index * 3 + axis] + offset, 
                    minRange, maxRange);

            this._updatePoints();
            this.updateGeometry();
            this._plane.mesh.update(this._vertices, this._indices[this._gizmoPlaneIndex]);
            return true;
        } else {
            return false;
        }
    };

    // See which face of the clipping box the cursor is over.
    Section.prototype._focusPlane = function(x, y, camera) {
        if (!this._rotate) {
            var q, p, direction;
            if (camera.isPerspective()) {
                q = vec3.create();
                vec3.copy(q, camera.eye);
                p = camera.unproject(x, y);
            } else {
                q = camera.unproject(x, y);
                p = vec3.create();
                direction = camera.getViewDirection();
                vec3.add(p, q, direction);
            }
            
            vec3.transformMat4(q, q, this._rotateMatrix);
            vec3.transformMat4(p, p, this._rotateMatrix);
            direction = [];
            direction[0] = p[0] - q[0];
            direction[1] = p[1] - q[1];
            direction[2] = p[2] - q[2];
            
            var intersect = MyMath.intersect.ray_aabb(q, direction, this._sectionedBBox);
            var planes = MyMath.aabb.planes(this._sectionedBBox); //-x, -y, -z, x, y, z
            
            if (intersect !== null) {
                for (var i = 0; i < 6; ++i) {
                    if (Math.abs(vec3.dot(intersect, planes[i]) + planes[i][3]) < 1e-6) {
                        if (this._gizmoPlaneIndex !== i) {
                            this._gizmoPlaneIndex = i;
                            this._plane.mesh.update(this._vertices, this._indices[i]);
                            this._planeUpdated = true;
                        }
                        return true; 
                    }
                }
            } else {
                this._gizmoPlaneIndex = null;
            }                 
        }
        return false;
    };
    
    Section.prototype._updateBBox = function(normal) {
        var center = MyMath.aabb.center(this._scene.bbox);
        var eye = vec3.create();
        vec3.scaleAndAdd(eye, center, normal, this._scene.radius);

        // Create the transformation matrix of world->rotate space
        if (Math.abs(normal[2]) > 0.9999) {
            mat4.lookAt(this._rotateMatrix, eye, center, [0, 1, 0]);
        } else {
            mat4.lookAt(this._rotateMatrix, eye, center, [0, 0, 1]);
        }
        mat4.invert(this._invertedRotateMatrix, this._rotateMatrix);
        
        var aabb = this._scene.clipping.getBBox();
        if (this._scene.compressed) {
            var offset = 1e-4;
            aabb[0] -= offset;
            aabb[1] -= offset;
            aabb[2] -= offset;
            aabb[3] += offset;
            aabb[4] += offset;
            aabb[5] += offset;
        }
        MyMath.aabb.points2(aabb, this._points);
            
        // Transform points into rotate space and create new bbox in the rotate space.
        for (var i = 0, len = this._points.length; i < len; i++) {
            vec3.transformMat4(this._points[i], this._points[i], this._rotateMatrix);
        }
        MyMath.aabb.createFromPoints(this._bbox, this._points);

        MyMath.aabb.copy(this._sectionedBBox, this._bbox);

        // Convert points back of new aabb to the world space.
        this._updatePoints();
    };
    
    // update points and transfer them into world space
    Section.prototype._updatePoints = function() {
        MyMath.aabb.points2(this._sectionedBBox, this._points);
        
        vec3.transformMat4(this._points[0], this._points[0], this._invertedRotateMatrix);
        vec3.transformMat4(this._points[1], this._points[1], this._invertedRotateMatrix);
        vec3.transformMat4(this._points[2], this._points[2], this._invertedRotateMatrix);
        vec3.transformMat4(this._points[3], this._points[3], this._invertedRotateMatrix);
        vec3.transformMat4(this._points[4], this._points[4], this._invertedRotateMatrix);
        vec3.transformMat4(this._points[5], this._points[5], this._invertedRotateMatrix);
        vec3.transformMat4(this._points[6], this._points[6], this._invertedRotateMatrix);
        vec3.transformMat4(this._points[7], this._points[7], this._invertedRotateMatrix);
            
        this._scene.clipping.update(this._points);
    };
    
    Section.prototype.recompileShader = function(resourceManager, states) {
        if (!this.enabled) {
            return;
        }

        // update shader0
        var flags = [];
        if (states.section) {
            flags.push("CLIPPING");
        }
        if (states.doubleSided) {
            flags.push("DOUBLESIDED");
        }
        if (this._scene.compressed) {
            flags.push("COMPRESSION");
        }
        flags.push("WORLDSPACE_NORMAL");
        if (this._normalDepth) {
            this._normalDepth.renderPass.recompileOverridedShader(resourceManager, flags);
        }
    };
    
    return Section;
})();
    
