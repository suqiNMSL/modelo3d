//
// m3d_blit.js
// A 2D image processing pass
//
//  

'use strict';

import MaterialBlit  from "../03scene/materials/m3d_material_blit.js";
import ShaderLibrary from "../02resource/m3d_shader_library.js";

export default (function() {
    "use strict";

    function Blit(resourceManager, shaderSource, mobile) {
        // private
        this._material     = null;
        this._shader       = null;

        // initialization:
        if (!shaderSource) {
            shaderSource = ShaderLibrary["blit"];
        }

        this._shader = resourceManager.getShader(shaderSource.name);

        if (!this._shader.ready) {
            this._shader.createFromShaderSource(shaderSource, mobile ? ["MOBILE"]: []);
        }
        
        this.ready = this._shader.ready;

        if (this.ready) {
            this._material = new MaterialBlit(shaderSource.name);
            this._material.attachShader(this._shader);
        }
    };

    Blit.prototype.destroy = function() {
        if (this.ready) {
            this._material.destroy();
            this._shader.destroy();

            this.ready = false;
        }
    };

    Blit.prototype.setTexture = function(texture) {
        this._material.setTexture(texture);
    };
    
    Blit.prototype.setDepthTexture = function(texture) {
        this._material.setDepthTexture(texture);
    };
    
    Blit.prototype.setParameter = function(parameter, value) {
        this._material.parameters[parameter].value = value;
    };

    /**
     * @param {object} renderer - render class.
     * @param {object} renderTarget - render target.
     * @param {boolean} blend - is blend.
     * @param {boolean} onlyValidPixels - is only render to valid pixels.
     * @return {null} -return nothing
     */
    Blit.prototype.render = function(renderer, renderTarget, blend, onlyValidPixels) {
        // FIXME: we touch many render state's private members.
        if (this.ready && renderTarget.ready) {

            var oldDepthMask = renderTarget._options.depthMask;
            renderTarget._options.depthMask = false;

            var depthFunc = onlyValidPixels? gl.GREATER : gl.ALWAYS;

            var oldDepthFunc = renderTarget._options.depthFunc;
            renderTarget._options.depthFunc = depthFunc;

            var oldBlend = renderTarget._options.blend;
            renderTarget._options.blend = blend || false;

            var invResolution = [
                1.0 / renderTarget.getWidth(), 
                1.0 / renderTarget.getHeight()];
            this._material.setInvResolution(invResolution);
            
            // Render a screen quad
            renderer.drawScreen(renderTarget, this._shader, this._material);
            
            renderTarget._options.depthMask = oldDepthMask;
            renderTarget._options.depthFunc = oldDepthFunc;
            renderTarget._options.blend = oldBlend;

            renderer.renderState.blend(renderTarget._options.blend);
            renderer.renderState.depthTest(renderTarget._options.depthTest,
                                           renderTarget._options.clearDepth,
                                           renderTarget._options.depthFunc);
            renderer.renderState.depthMask(renderTarget._options.depthMask);
        }
    };

    return Blit;
})();

