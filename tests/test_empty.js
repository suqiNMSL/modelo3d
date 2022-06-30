//
// test_empty.js
// A base class for all test cases
//
//  

import Globals from "../m3d_globals.js";

export default (function() {
    "use strict";

    function TestEmpty(canvas) {
        this._canvas = canvas;
        
        // Create the text panel
        var mainBody = document.getElementsByTagName("body")[0];
        this._text = document.createElement("div");
        this._text.style.color = 'blue';
        this._text.style.fontSize = Globals.isMobile? '10pt' : '9pt';
        this._text.style.position = 'absolute';
        this._text.style.top = '430px';
        this._text.style.left = '10px';
        this._text.innerHTML = "";
        mainBody.appendChild(this._text);
    };

    TestEmpty.prototype.update = function() {
    };
    
    TestEmpty.prototype._keyboard = function(key) {
        switch (key) {
            case 72: // 'h'
                break;
        }
                
        this._canvas._refreshRendering();
    };

    TestEmpty.prototype.bindKeyboard = function(keyboard) {
        var that = this;
        var keyboardCallback = keyboard.onKeyDownCallback;
        keyboard.onKeyDownCallback = function(key) {
            if (!that._keyboard(key)) {
                keyboardCallback(key);
            }
        };
    };

    return TestEmpty;
})();
