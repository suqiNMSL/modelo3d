//
// m3d_texture_viewer.debug.js
// render a texture in a corner of the window
//
//  

import Globals      from "../m3d_globals.js";
import Blit         from "../04renderer/m3d_blit.js";
import RenderTarget from "../04renderer/m3d_rendertarget.js";


export default (function() {
    "use strict";

    function TextureViewer(resourceManager) {
        // private:
        this._texture      = null;
        this._renderTarget = null;
        this._enabled      = false;
        this._blit         = null;

        // initialization:
        this._blit         = new Blit(resourceManager);
        this._renderTarget = new RenderTarget("default", resourceManager, 
                Globals.width, Globals.height, { depthTest: false } ); 
    };

    TextureViewer.prototype.destroy = function() {
        if (this._material) {
            this._renderTarget.destroy();
        }
    };

    TextureViewer.prototype.setPosition = function(position) {
        console.error("setPositon() is not implemented");
    };
    
    TextureViewer.prototype.setTexture = function(texture) {
        if (texture && texture.ready) {
            this._texture = texture;
            this._enabled = true;
        } else {
            //console.log("textureViewer detects an invalid texture.");
            this._enabled = false;
        }
    };

    TextureViewer.prototype.render = function(renderer) {
        if (this._enabled) {
            //var w = this._texture.width / 5;
            //var h = this._texture.height / 5;
            
            var w = 250;
            var h = 250 * this._texture.height / this._texture.width;
            
            var x = Globals.width - w;
            var y = 0;
            renderer.renderState.viewport([x, y, w, h]);
            this._blit.setTexture(this._texture);
            this._blit.render(renderer, this._renderTarget);
        }
    };

    TextureViewer.prototype.setEnabled = function(enabled) {
        this._enabled = enabled;
    };

    return TextureViewer;
})();
    
