//
// m3d_hud.debug.js
// Print debug information to HUD
//
//  

import Globals from "../../m3d_globals.js";

export default (function() {
    "use strict";

    function HUD() {
        // private:
        this._hud = document.createElement("div");
        this._hud.style.fontSize = Globals.isMobile? '10pt' : '9pt';
        this._hud.style.position = 'absolute';
        this._hud.style.top = '100px';
        this._hud.style.left = '10px';
        this._hud.style.color = 'black';
	this._hud.style.opacity = '0.9';
	this._hud.style.background = 'white';
	this._hud.style.width = '250px';
	this._hud.style.padding = '20px';
        
        this._hud.innerHTML = "<p></p>";

        var mainBody = document.getElementsByTagName("body")[0];
        mainBody.appendChild(this._hud);
    };
    
    HUD.prototype.destroy = function() {
    };

    HUD.prototype.render = function(text) {
        this._hud.innerHTML = "<p>" + text + "</p>";
    };

    HUD.prototype.setFontSize = function(size) {
        this._hud.style.fontSize = size + "pt";
    };
    
    HUD.prototype.setFontColor = function(color) {
        this._hud.style.color = color;
    };

    HUD.prototype.setBackgroundColor = function(color) {
        this._hud.style.background = color;
    };
    
    HUD.prototype.setBackgroundOpacity = function(opacity) {
        this._hud.style.opacity = opacity
    };

    HUD.prototype.setWidth = function(width) {
        this._hud.style.width = width + 'px';
    };

    return HUD;
})();
    
