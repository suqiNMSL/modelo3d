//
// m3d_mesh.js
// The mesh attributes
//
//  


export default (function() {
    "use strict";

    function GetSizeOfType(type) {
        switch (type) {
            case gl.UNSIGNED_BYTE: 
            case gl.BYTE: 
                return 1;
            case gl.UNSIGNED_SHORT: 
            case gl.SHORT: 
                return 2;
            case gl.FLOAT: 
            case gl.INT: 
            case gl.UNSIGNED_INT: 
                return 4;
            default:
                throw new Error("unknown GL type");
                return 0;
        }

        return -1;
    };
    
    //
    // MeshAttribute
    //
    function MeshAttribute(name, type, normalized, size) {
        this.name       = name;
        this.index      = -1;
        this.type       = type;
        this.offset     = 0;
        this.stride     = 0;
        this.size       = size;
        this.normalized = !!normalized;
    };

    //
    // MeshAttributes
    //
    function MeshAttributes() {
        this.values = [];
        
        this.hasNormal  = false;
        this.hasColor   = false;
        this.hasUV      = false;
        this.id         = 0;
        this.primitive  = gl.TRIANGLES;
        
        // We compress the mesh by absorbing normals into positions.
        // The last 8 bit of position coordinate value carries a 8-bit normal. For
        // example, the x coordinate of position is 32-bit floating number. In compression
        // mode, its last/insignificant 8-bit is for normal.
        this.compressed = false;
    };

    // Create built-in attributes.
    MeshAttributes.prototype.builtin = function(positionType, normalType, uvType, colorType) {
        var offset = 0;

        var attribute = null;

        if (positionType) {
            attribute = new MeshAttribute("m_aPosition", positionType, false, 3);
            attribute.index  = 0;
            attribute.offset = 0;
            this.values.push(attribute);
            offset = 3 * GetSizeOfType(positionType);
        }
        if (normalType) {
            var size = 3;
            var normalized = false;

            size = 3;
            normalized = false;
            if (normalType !== gl.FLOAT) {
                normalized = true;
                size = 4;
            }
            attribute = new MeshAttribute("m_aNormal", normalType, normalized, size);
            attribute.index  = 1;
            attribute.offset = offset;
            this.values.push(attribute);
            offset += size * GetSizeOfType(normalType);
            
            this.hasNormal = true;
        }
        if (uvType) {
            attribute = new MeshAttribute("m_aTexCoord", uvType, false, 2);
            attribute.index  = 4;
            attribute.offset = offset;
            this.values.push(attribute);
            offset += 2 * GetSizeOfType(uvType);
            this.hasUV = true;
        }
        if (colorType) {
            attribute = new MeshAttribute("m_aColor", colorType, false, 4);
            attribute.index  = 5;
            attribute.offset = offset;
            if (normalType !== gl.FLOAT) { 
                attribute.normalized = true;
            }
            this.values.push(attribute);
            offset += 4 * GetSizeOfType(colorType);
            this.hasColor = true;
        }
        
        for (var i = 0, len = this.values.length; i < len; ++i) {
            this.values[i].stride = offset;
        }

        this.id = (positionType? 16 : 0) + 
                  (normalType? 8 : 0) +
                  (uvType? 4 : 0) +
                  (colorType? 2 : 0);
    };
    
    MeshAttributes.prototype.compress = function() {
        // we are about to compress normal.
        if (!this.hasNormal || this.compressed) {
            return ;
        } 

        this.compressed = true;

        this.id += 32;

        var values = [];

        values.push(this.values[0]); // position

        var attribute = null;
                
        attribute = new MeshAttribute("m_aNormal0", gl.BYTE, true, 1, null);
        attribute.index  = 1;
        attribute.offset = 0;
        values.push(attribute);

        attribute = new MeshAttribute("m_aNormal1", gl.BYTE, true, 1, null);
        attribute.index  = 2;
        attribute.offset = 4;
        values.push(attribute);

        attribute = new MeshAttribute("m_aNormal2", gl.BYTE, true, 1, null);
        attribute.index  = 3;
        attribute.offset = 8;
        values.push(attribute);

        for (var i = 2, len = this.values.length; i < len; i++) {
            this.values[i].offset -= 4;
            values.push(this.values[i]);
        }

        var stride = this.values[0].stride - 4;
        
        for (var i = 0, len = values.length; i < len; ++i) {
            values[i].stride = stride;
        }

        this.values = values;
    };

    // Clone this mesh attribute to a new one
    MeshAttributes.prototype.clone = function() {
        var ret = new MeshAttributes();

        ret.id         = this.id;
        ret.hasNormal  = this.hasNormal;
        ret.hasColor   = this.hasColor;
        ret.hasUV      = this.hasUV;
        ret.compressed = this.compressed;
        ret.primitive  = this.primitive;

        ret.values = new Array(this.values.length);
        for (var i = 0, len = this.values.length; i < len; i++) {
            var v = this.values[i];
            ret.values[i] = new MeshAttribute(v.name, v.type, v.normalized, v.size);
            ret.values[i].index = v.index;
            ret.values[i].offset = v.offset;
            ret.values[i].stride = v.stride;
        }

        return ret;
    };
    

    // Add the customized attributes. It should not have the same
    // name as any of built-in attributes.
    MeshAttributes.prototype.add = function(name, type, normalized, size) {
        if (!this.has(name)) {
            var attribute = new MeshAttribute(name, type, normalized, size);
            this.values.push(attribute);
        }
    };
    
    MeshAttributes.prototype.has = function(attribute) {
        for (var i = 0, len = this.values.length; i < len; ++i) {
            if (this.values[i].name === attribute) {
                return true;
            }
        }
        return false;
    };

    MeshAttributes.prototype.bind = function(buffer) {
        // FIXME: in Chrome 62, a dangling vertex attrib will crash the context.
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(2);
        gl.disableVertexAttribArray(3);
        gl.disableVertexAttribArray(4);
        gl.disableVertexAttribArray(5);
        gl.disableVertexAttribArray(6);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        // We already enabled vertex attribute 0 at GL initialization.
        for (var i = 0, len = this.values.length; i < len; i++) {
            var index = this.values[i].index;
            gl.vertexAttribPointer(index,
                    this.values[i].size, 
                    this.values[i].type, 
                    this.values[i].normalized, 
                    this.values[i].stride, 
                    this.values[i].offset); 
            //if (gl.getError() != gl.NO_ERROR) {
            //    console.log(this.values[i]);
            //}

            gl.enableVertexAttribArray(index); 
        }
    };

    return MeshAttributes;
})();

