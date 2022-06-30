//
// m3d_touch.js
// Touch event wrapper
//
//  


export default (function() {
    "use strict";

    // --------------------------------------------------------------
    // class Touch
    // --------------------------------------------------------------
    function Touch(canvas) {
        this.canvas = canvas;
        this.numCursors = 0; // How many fingers are done
        this.x0 = 0; // The start position.
        this.y0 = 0; // Ditto.
        this.cursors = {};   // The finger position information
        this.touchStartCallback = null; // Callback functions when mouse down.
        this.touchMoveCallback  = null; // Ditto.
        this.touchStopCallback  = null;  // Ditto.
        this.identifers = []; // The identifiers of fingers on the screen.
        this.lastCursor = null;
        this.isDoubleClick = false;
        this.clickTime = 0;
        this.allowMoveEvent = true;
        this.moveEventDisabeldTime = null;
        this.isMoved = false;

        // Hook up canvas touch events.
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchStop = this.onTouchStop.bind(this);

        this.canvas.addEventListener("touchstart", this.onTouchStart, false);
        this.canvas.addEventListener("touchmove", this.onTouchMove, false);
        this.canvas.addEventListener("touchend", this.onTouchStop, false);
    }; 

    Touch.prototype.destroy = function() {
        this.canvas.removeEventListener("touchstart", this.onTouchStart);
        this.canvas.removeEventListener("touchmove", this.onTouchMove);
        this.canvas.removeEventListener("touchend", this.onTouchStop);
    };

    // Get the cursor sequentially. Not that parameter id is the index
    // of valid cursor in this touch object, not the identifier of the
    // cursor itself.
    Touch.prototype.cursor = function(id) {
        if (id < this.identifers.length) {
            return this.cursors[this.identifers[id]];
        }
        return null;
    }; // end of modelo.Touch.prototype.cursor

    Touch.prototype.onTouchStart = function(e) {
        e.preventDefault();

        this.numCursors = e.touches.length;

        for (var i = 0; i < e.changedTouches.length; ++i) {
            this._addCursor(e.changedTouches[i]);
        }

        var activeId = 0;
        for (var cursor in this.cursors) {
            if (this.cursors[cursor] !== null) {
                activeId = cursor;
            }
        }

        if (this.numCursors === 1) {

            var cursor0 = this.cursors[activeId];
            var click = new Date();
            var clickTime = click.getTime();
            if (this.lastCursor) {
                if ((clickTime - this.clickTime) < 200 &&
                    (Math.abs(this.lastCursor.x - cursor0.x) < 20 &&
                     Math.abs(this.lastCursor.y - cursor0.y) < 20)) {
                    this.isDoubleClick = true;
                } else {
                    this.isDoubleClick = false;
                }
            }
            this.lastCursor = this.cursor(0);
            this.clickTime = clickTime;
        } else {
            this.isDoubleClick = false;
        }

        if (this.touchStartCallback) {
            this.touchStartCallback();
        }
    }; // end of modelo.Touch.prototype.onTouchStart

    Touch.prototype.onTouchMove = function(e) {
        e.preventDefault();
        var that = this;

        this.numCursors = e.touches.length;

        var seenTouches = [];

        _.forEach( e.touches, function(touch) {
            if (!that.cursors[touch.identifier]) {
                that._addCursor(touch);
            }
            seenTouches.push(touch.identifier);
        });

        _.forEach(that.cursors, function(cursor, id) {
            id = Number(id);
            var index = seenTouches.indexOf(id);
            if (index === -1) {
                that._removeCursor(id);
            }
        });

        if (!this.allowMoveEvent) {
            // re-enable after 200ms
            var now = new Date().getTime();
            this.allowMoveEvent = now - this.moveEventDisabeldTime >  200;
        }

        if (this.allowMoveEvent) {
            this.isMoved = true;
            for (var i = 0; i < e.changedTouches.length; ++i) {
                var x = e.changedTouches[i].pageX;
                var y = e.changedTouches[i].pageY;

                var id = e.changedTouches[i].identifier; // The unique id of the finger.
                this.cursors[id].dx = x - this.cursors[id].x;
                this.cursors[id].dy = y - this.cursors[id].y;
                this.cursors[id].x = x;
                this.cursors[id].y = y;
                this.cursors[id].moved = true;
            }

            if (this.touchMoveCallback) {
                this.touchMoveCallback();
            }
        }
    }; // end of modelo.Touch.prototype.onTouchMove

    Touch.prototype.onTouchStop = function(e) {
        e.preventDefault();

        if (this.touchStopCallback) {
            this.touchStopCallback();
        }
        
        this.isMoved = false;
        var that = this;
        that.numCursors = e.touches.length;

        _.forEach(e.changedTouches, function(changedEvent) {
            var id = changedEvent.identifier;
            that._removeCursor(id);
        });

        // Take in consideration if one finger comes off before second
        if (that.numCursors) {
            that.allowMoveEvent = false;
            that.moveEventDisabeldTime =  new Date().getTime();
        }
        
    }; // end of modelo.Touch.prototype.onTouchStop

    Touch.prototype._removeCursor = function(id) {

        var index = this.identifers.indexOf(id);
        if (index !== -1) {
            this.identifers.splice(index, 1);
        }
        delete this.cursors[id];
    };

    Touch.prototype._addCursor = function(touch) {
        var id = touch.identifier;
        var cursor = {
            x: touch.pageX,
            y: touch.pageY,
            dx: 0,
            dy: 0,
            moved: false
        };

        this.cursors[id] = cursor;
        this.identifers.push(id);
    };

    return Touch;
})();
    
