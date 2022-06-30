//
// m3d_mouse.js
// Mouse event wrapper
//
//  

import Globals  from "../../m3d_globals.js";

export default (function() {
    "use strict";

    function Mouse(canvas) {
        this.x = -1;  // The current mouse coordinate.
        this.y = -1;  // Ditto.
        this.x0 = -1; // The click-down position
        this.y0 = -1; // Ditto
        this.dx = -1; // The movement since last position.
        this.dy = -1; // Ditto
        this.down = true;
        this.moved = false; // If mouse has moved a certain distance since down.
        this.mouseDownCallback        = null; // Callback functions when mouse down.
        this.mouseMoveCallback        = null; // Ditto.
        this.mouseUpCallback          = null;  // Ditto.
        this.mouseDoubleClickCallback = null;  // Ditto.
        this.mouseWheelCallback       = null;  // Ditto.
        this.delta = 0; // The wheel movement.
        this.event = null; // The current event.
        this.lastWheelTime = 0;
        this.zoomCount = 0; // accumulated wheeling movement times
        this.canvas = canvas;
            
        // Hook up canvas mouse events
        var that = this;
        var eventType = 0;

        var normalizeMouse = function normalizeMouse(func){
            return function(e) {
                // var from = e.relatedTarget || e.toElement;
                // if (from !== that.canvas) {
                //    return ;
                // }

                e.offsetX_norm = e.offsetX === undefined ? e.layerX : e.offsetX;
                e.offsetY_norm = e.offsetY === undefined ? e.layerY : e.offsetY;
                
                if (Globals.browserName === "firefox" || Globals.browserName === "edge") {
                    e.buttonDown = eventType;
                } else {
                    e.buttonDown = e.which;
                }

                return func.call(that, e);
            };
        };


        this.canvas.ondblclick   = normalizeMouse(this.onDoubleClick);
        this.canvas.onwheel      = normalizeMouse(this.onMouseWheel);
        this.canvas.onmousemove  = normalizeMouse(this.onMouseMove);

        var mouseDown            = normalizeMouse(this.onMouseDown);
        var mouseUp              = normalizeMouse(this.onMouseUp);

        this.canvas.onmousedown = function(e) {
            eventType = e.which;
            mouseDown(e);
        };

        this.canvas.onmouseup = function(e) {
            mouseUp(e);
            eventType = 0;
        };



        this._onMouseLeave = function(e){
            eventType = 0;
        };

        document.addEventListener("mouseout", this._onMouseLeave, false );
    }; 

    Mouse.prototype.destroy = function() {
        this.canvas.onmousedown  = null;
        this.canvas.onmouseup    = null;
        this.canvas.onmouseleave = null;
        this.canvas.ondblclick   = null;
        this.canvas.onwheel      = null;
        this.canvas.onmousemove  = null;

        document.removeEventListener("mouseout", this._onMouseLeave );
    };

    Mouse.prototype.onMouseDown = function(event) {
        this.down = true;
        var x = event.offsetX_norm;
        var y = event.offsetY_norm;
        this.x0 = this.x;
        this.y0 = this.y;
        this.dx = 0;
        this.dy = 0;
        this.x  = x;
        this.y  = y;
        this.moved = false;
        this.event = event;

        if (this.mouseDownCallback) {
            this.mouseDownCallback();
        }
    }; 

    Mouse.prototype.onMouseUp = function(event) {
        this.down = true;
        var x = event.offsetX_norm;
        var y = event.offsetY_norm;
        this.dx = x - this.x;
        this.dy = y - this.y;
        this.x = x;
        this.y = y;
        this.event = event;

        if (Math.abs(this.x - this.x0) > 3 || Math.abs(this.y - this.y0) > 3) {
            this.moved = true;
        }

        if (this.mouseUpCallback) {
            this.mouseUpCallback();
        }
    }; // end of Mouse.prototype.onMouseUp

    Mouse.prototype.onMouseMove = function(event) {
        var x = event.offsetX_norm;
        var y = event.offsetY_norm;
        this.dx = x - this.x;
        this.dy = y - this.y;
        this.x = x;
        this.y = y;
        this.event = event;

        if (Math.abs(this.x - this.x0) > 3 || Math.abs(this.y - this.y0) > 3) {
            this.moved = true;
        }

        if (this.mouseMoveCallback) {
            this.mouseMoveCallback();
        }
    }; // end of Mouse.prototype.onMouseMove

    Mouse.prototype.onDoubleClick = function(event) {
        this.x = event.offsetX_norm;
        this.y = event.offsetY_norm;
        this.x0 = this.x;
        this.y0 = this.y;
        this.dx = 0;
        this.dy = 0;
        this.moved = false;
        this.event = event;

        if (this.mouseDoubleClickCallback) {
            this.mouseDoubleClickCallback();
        }
    }; // end of Mouse.prototype.onMouseDoubleClick

    Mouse.prototype.onMouseWheel = function(e) {
        e.preventDefault();
        // Clamp deltaY to (-1, 1)
        var deltaY = e.deltaY;
        this.delta = -Math.max(-1, Math.min(1, deltaY));
        // Using trackpad will generate deltaY less than 50
        // at an inertia scrolling. We want to iron out the effect of 
        // the inertia scrolling movement to just a little.
        // Using mouse to scroll will generate inertia larger than 200
        // according to experiments, so the bound [0, 50] can capture
        // the tarckpad scrolling.
        // FIXME: The firefox case is really complicated. In windows, the deltaY
        // is +-3, +-6, +-9 with mouse and trackpad. In mac, the deltaY is
        // from -20 to 20 with inertia scrolling, let's just uniform the delta
        // to +- 1 in firefox for now.
        if (Globals.browserName !== "firefox") {
            this.delta *= Math.min(deltaY * deltaY / 2500.0, 1.0); 
        }
       
        if (this.mouseWheelCallback) {
            this.mouseWheelCallback();
        }
    }; // end of Mouse.prototype.onMouseWheel

    return Mouse;
})();
    

