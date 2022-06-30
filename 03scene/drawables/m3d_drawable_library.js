//
// m3d_drawable_library.js
// Generate a handful of drawables
//
//  

import Drawable      from "./m3d_drawable.js";
import MaterialAdhoc from "../materials/m3d_material_adhoc.js";
import ShaderLibrary from "../../02resource/m3d_shader_library.js";

export default (function() {
    "use strict";

    var DrawableLibrary = {
        "createSolidSphere": function(resourceManager, color, radius, position) {
            color = color || [1, 0, 0];
            radius = radius || 1.0;
            position = position || [0, 0, 0];

            var mesh = resourceManager.getMesh("sphere");
            mesh.createSphere(32, 16);

            var shaderType = "constant";
            var shader = resourceManager.getShader(shaderType, ["MODEL_TRANSFORM"]);
            if (!shader.ready) {
                var shaderSource = ShaderLibrary[shaderType];
                shader.createFromShaderSource(shaderSource, ["MODEL_TRANSFORM"]);
                if (!shader.ready) {
                    throw("modelo3d error at creating shader '" + shaderType + "'!");
                }
            }

            var material = new MaterialAdhoc("solid-sphere-material");
            material.attachShader(shader);
            material.setDiffuse(color);
            material.setTransparent(1);

            var drawable = new Drawable("solid-sphere", mesh, null, shader, material, 
                    null, [position[0] - radius, position[1] - radius, position[2] - radius, 
                           position[0] + radius, position[1] + radius, position[2] + radius]); 
            drawable.transform.setTranslation(position[0], position[1], position[2]);
            drawable.transform.setScaling(radius, radius, radius);

            return drawable;
        },
        
        "createWiredCube": function(resourceManager, color, size, position) {
            color = color || [1, 0, 0];
            size = size || 1.0;
            position = position || [0, 0, 0];

            var mesh = resourceManager.getMesh("wired-cube");
            mesh.createWiredCube();

            var shaderType = "constant";
            var shader = resourceManager.getShader(shaderType, ["MODEL_TRANSFORM"]);
            if (!shader.ready) {
                var shaderSource = ShaderLibrary[shaderType];
                shader.createFromShaderSource(shaderSource, ["MODEL_TRANSFORM"]);
                if (!shader.ready) {
                    throw("modelo3d error at creating shader '" + shaderType + "'!");
                }
            }

            var material = new MaterialAdhoc("wired-cube-material");
            material.attachShader(shader);
            material.setDiffuse(color);
            material.setTransparent(1);

            var drawable = new Drawable("wired-cube", mesh, null, shader, material, 
                    null, [position[0] - size, position[1] - size, position[2] - size, 
                           position[0] + size, position[1] + size, position[2] + size]); 
            drawable.transform.setTranslation(position[0], position[1], position[2]);
            drawable.transform.setScaling(size, size, size);

            return drawable;
        },

        "createSolidCube": function(resourceManager, color, size, position) {
            color = color || [1, 0, 0];
            size = size || 1.0;
            position = position || [0, 0, 0];

            var mesh = resourceManager.getMesh("cube");
            mesh.createSolidCube();

            var shaderType = "constant";
            var shader = resourceManager.getShader(shaderType, ["MODEL_TRANSFORM"]);
            if (!shader.ready) {
                var shaderSource = ShaderLibrary[shaderType];
                shader.createFromShaderSource(shaderSource);
                if (!shader.ready) {
                    throw("modelo3d error at creating shader '" + shaderType + "'!");
                }
            }

            var material = new MaterialAdhoc("solid-cube-material");
            material.attachShader(shader);
            material.setDiffuse(color);
            material.setTransparent(1);

            var drawable = new Drawable("solid-cube", mesh, null, shader, material, 
                    null, [position[0] - size, position[1] - size, position[2] - size, 
                           position[0] + size, position[1] + size, position[2] + size]); 
            drawable.transform.setTranslation(position[0], position[1], position[2]);
            drawable.transform.setScaling(size, size, size);

            return drawable;
        },
    
        "createShadedSphere": function(resourceManager, color) {
            color = color || [1, 0, 0];

            var mesh = resourceManager.getMesh("sphere");
            mesh.createSphere(32, 16);

            var shaderType = "solid";
            var shader = resourceManager.getShader();
            if (!shader.ready) {
                var shaderSource = ShaderLibrary[shaderType];
                shader.createFromShaderSource(shaderSource);
                if (!shader.ready) {
                    throw("modelo3d error at creating shader '" + shaderType + "'!");
                }
            }

            var material = new MaterialAdhoc("shaded-sphere-material");
            material.attachShader(shader);
            material.setDiffuse(color);
            material.setTransparent(1);

            var drawable = new Drawable("shaded-sphere", mesh, null, shader, material, 
                    null, [-1.0, -1.0, -1.0, 1.0, 1.0, 1.0]);

            return drawable;
        },

        "createShadedCube": function(resourceManager, color) {
            color = color || [1, 0, 0];

            var mesh = resourceManager.getMesh("sphere");
            mesh.createSolidCube();

            var shaderType = "constant";
            var shader = resourceManager.getShader();
            if (!shader.ready) {
                var shaderSource = ShaderLibrary[shaderType];
                shader.createFromShaderSource(shaderSource);
                if (!shader.ready) {
                    throw("modelo3d error at creating shader '" + shaderType + "'!");
                }
            }

            var material = new MaterialAdhoc("shaded-cube-material");
            material.attachShader(shader);
            material.setDiffuse(color);
            material.setTransparent(1);

            var drawable = new Drawable("shaded-cube", mesh, null, shader, material, 
                    null, [-1.0, -1.0, -1.0, 1.0, 1.0, 1.0]);

            return drawable;
        },
    
        "createDrawable": function(resourceManager, mesh, color) {
            color = color || [1, 0, 0];

            var shaderType = "constant";
            var shader = resourceManager.getShader();
            if (!shader.ready) {
                var shaderSource = ShaderLibrary[shaderType];
                shader.createFromShaderSource(shaderSource);
                if (!shader.ready) {
                    throw("modelo3d error at creating shader '" + shaderType + "'!");
                }
            }

            var material = new MaterialAdhoc("wired-drawable-material");
            material.attachShader(shader);
            material.setDiffuse(color);
            material.setTransparent(1);

            var drawable = new Drawable(mesh.name, mesh, null, shader, material, 
                    null, [-1.0, -1.0, -1.0, 1.0, 1.0, 1.0]);

            return drawable;
        }
    };

    return DrawableLibrary;
})();

