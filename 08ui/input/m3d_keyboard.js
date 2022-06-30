//
// m3d_keyboard.js
// Hook the document keyboard events
//
//  


export default (function() {
    "use strict";

    var KEYDOWN = 0;
    var KEYPRESSED = 1;
    var KEYUP = 2;


    function Keyboard() {
        // private:
        this._status = 0; // DOWN, PRESSED or UP.
        this._enabled = true;

        // public:
        this.key = 0; // The key scancode
        this.onKeyUpCallback = null;
        this.onKeyDownCallback = null;


        // we need to keep a reference to the function as need to remove the listeners from document on Keyboard destroy
        this._keyDownFn   = this._keyDown.bind(this);
        this._keyUpFn     = this._keyUp.bind(this);

        // initialization
        document.addEventListener("keydown", this._keyDownFn);
        document.addEventListener("keyup", this._keyUpFn);
    };

    Keyboard.prototype.destroy = function() {
        document.removeEventListener("keydown",this._keyDownFn);
        document.removeEventListener("keyup",this._keyUpFn);
        this._keyUpFn = null;
        this._keyDownFn = null;
    };

    Keyboard.prototype.setEnabled = function(enabled) {
        this._enabled = enabled;
    };

    Keyboard.prototype._keyDown = function(e) {
        if (!this._doesCanvasHaveFocus()) {
            return;
        }

        this._status = KEYPRESSED;
        this.key = e.keyCode;

        if (this.onKeyDownCallback) {
            e.preventDefault();
            this.onKeyDownCallback(this.key);
        }
    };

    Keyboard.prototype._keyUp = function(e) {
        if(!this._doesCanvasHaveFocus()){
            return;
        }

        this._status = KEYUP;
        this.key = e.keyCode;

        if (this.onKeyUpCallback) {
            e.preventDefault();
            this.onKeyUpCallback(this.key);
        }
    };

    Keyboard.prototype._doesCanvasHaveFocus = function() {
        if(!this._enabled){
            return false;
        }

        // check if anything but the body has focus.
        var focusedElement = document.activeElement;
        var anotherElementHasFocus =  focusedElement && focusedElement !== document.body;

        if(anotherElementHasFocus){
            return false;
        }

        // check if anything is selected
        var text = "";
        if (typeof window.getSelection !== "undefined") {
            text = window.getSelection().toString();
        } else if (typeof document.selection !== "undefined" && document.selection.type === "Text") {
            text = document.selection.createRange().text;
        }


        return !text && !anotherElementHasFocus;
    };

    return Keyboard; 
})();
    
