//
// m3d_load_mesh.worker.js
// A webworker to take part of the mesh loading work
//
//  
//
(function() {
    "use strict";

    function NodeInfo() {
        this.name        = null;
        this.mesh        = null;
        this.layer       = null;
        this.material    = null;
        this.billboard   = false;
        this.transform   = null;
        this.bbox        = null;
        this.views       = "";
    };
    
    function ExtendTransform(transform) {
        var ret = new Float32Array(16);

        ret[0] = transform[0];
        ret[1] = transform[1];
        ret[2] = transform[2];
        ret[3] = 0;

        ret[4] = transform[3];
        ret[5] = transform[4];
        ret[6] = transform[5];
        ret[7] = 0;

        ret[8] = transform[6];
        ret[9] = transform[7];
        ret[10] = transform[8];
        ret[11] = 0;

        ret[12] = transform[9];
        ret[13] = transform[10];
        ret[14] = transform[11];
        ret[15] = 1;

        return ret;
    };
    
    self.littleEndian    = null;
    self.compressed      = null;
    self.memoryBudget    = null;
    self.attributesData  = null;
    self.retMessage      = {
        finished:       false,
        meshBinaryName: null,
        nodes:          null,
        meshBinary:     null
    };
    self.allocatedBytes  = 0;
    self.billboards      = null;
    self.nodesInfo       = null;
    self.nodes           = null;
    self.nodesGroups     = null;
    self.version         = null;
    self.groupCosts      = null;
    self.sceneData       = null;

    function HasTranslucentTexture(nodeData) {
        var materialData = self.sceneData.materials[nodeData.material];
        if (materialData.values.diffuseTexture) {
            var textureData = self.sceneData.textures[materialData.values.diffuseTexture];
            return textureData.format === "rgba";
        }
        return false;
    }; 

    // Group nodes with their material, vertex format and layer.
    function GroupNodes(nodesData, meshesData) {

        nodesData.sort(function(a, b) {
            var ret = a.material.localeCompare(b.material);
            if (ret !== 0) {
                return ret;
            }

            ret = a.layer.localeCompare(b.layer);
            if (ret !== 0) {
                return ret;
            }

            var attr0 = meshesData[a.mesh].attribute;
            var attr1 = meshesData[b.mesh].attribute;
            ret = attr0.localeCompare(attr1);
            if (ret !== 0) {
                return ret;
            }

            var views1 = a.views.join('');
            var views2 = b.views.join('');
            return views1.localeCompare(views2);
        });

        var nodesGroups = [];
        var nodesGroup = [];

        var currentMaterial   = nodesData[0].material;
        var currentLayer      = nodesData[0].layer;
        var currentAttribute  = meshesData[nodesData[0].mesh].attribute;
        var currentViews      = nodesData[0].views.join('');

        nodesGroup.push(nodesData[0]);

        var len = nodesData.length;
        var nodesGroupUint;
        var nodesGroupOther;
        var i, k;
        for (i = 1; i < len; ++i) {
            var attr = meshesData[nodesData[i].mesh].attribute;
            var views = nodesData[i].views.join('');

            if (nodesData[i].material !== currentMaterial ||
                nodesData[i].layer !== currentLayer       ||
                attr !== currentAttribute                 ||
                views !== currentViews                    ||
                HasTranslucentTexture(nodesData[i])       ||
                false) {

                // divide the group into two parts, one with uint index type
                // and the other for the rest.
                nodesGroupUint = [];
                nodesGroupOther = [];
                for (var k = 0, len1 = nodesGroup.length; k < len1; ++k) {
                    var meshData = meshesData[nodesGroup[k].mesh];
                    if (meshData.indexType && meshData.indexType > 2) {
                        nodesGroupUint.push(nodesGroup[k]);
                    } else {
                        nodesGroupOther.push(nodesGroup[k]);
                    }
                }

                if (nodesGroupUint.length > 0) {
                    nodesGroups.push(nodesGroupUint);
                }
                if (nodesGroupOther.length > 0) {
                    nodesGroups.push(nodesGroupOther);
                }
                nodesGroup = [];

                currentMaterial  = nodesData[i].material;
                currentLayer     = nodesData[i].layer;
                currentViews     = views;
                currentAttribute = attr;
            } 
            
            nodesGroup.push(nodesData[i]);
        }

        nodesGroupUint = [];
        nodesGroupOther = [];
        for (k = 0, len = nodesGroup.length; k < len; ++k) {
            var meshData = meshesData[nodesGroup[k].mesh];
            if (meshData.indexType && meshData.indexType > 2) {
                nodesGroupUint.push(nodesGroup[k]);
            } else {
                nodesGroupOther.push(nodesGroup[k]);
            }
        }

        if (nodesGroupUint.length > 0) {
            nodesGroups.push(nodesGroupUint);
        }
        if (nodesGroupOther.length > 0) {
            nodesGroups.push(nodesGroupOther);
        }

        return nodesGroups;
    };

    function PostMessage() {
        if (self.retMessage.finished) {
            self.postMessage(self.retMessage);
        } else {
            self.postMessage(self.retMessage, [self.retMessage.meshBinary]);
        }

        // GC
        self.retMessage.meshBinary = null;
        //self.retMessage.nodes;
    };

    function GetMeshInfo(meshData, attributeData) {
        var srcStride = attributeData.values[0].stride;

        if (attributeData.primitive === 4) {
            if (self.version < 408) {
                srcStride += 8; // normal has 3 float32
                if (attributeData.values.length > 2 && attributeData.values[2].index === 3) {
                    srcStride += 12;
                }
            } else if (self.version < 502) {
                srcStride += 2;
            }
        }
        
        var vertexNumber = meshData.vertices.byteLength / srcStride;
        var indexNumber = meshData.indices.byteLength / (meshData.indices.type || 2);
        var vertexBytes = vertexNumber * attributeData.values[0].stride;
        var indexBytes = meshData.indices.byteLength;
        var ref = 0; // how many nodes use this mesh, used in PopulateNodesAfterMerge()
        var seen = false; // used in PopulateNodesAfterMerge()

        return {
            vertexBytes: vertexBytes,
            indexBytes: indexBytes,
            vertexNumber: vertexNumber,
            indexNumber: indexNumber,
            ref: ref,
            seen: seen
        };
    };
        
    function MultiplyVertex(v, mat, x, y, z) {
        var m00 = mat[0];
        var m01 = mat[4];
        var m02 = mat[8];
        var m03 = mat[12];

        var m10 = mat[1];
        var m11 = mat[5];
        var m12 = mat[9];
        var m13 = mat[13];

        var m20 = mat[2];
        var m21 = mat[6];
        var m22 = mat[10];
        var m23 = mat[14];

        v[0] = m00 * x + m01 * y + m02 * z + m03;
        v[1] = m10 * x + m11 * y + m12 * z + m13;
        v[2] = m20 * x + m21 * y + m22 * z + m23;
    };

    function MultiplyNormal(v, mat, x, y, z) {
        var m00 = mat[0];
        var m01 = mat[4];
        var m02 = mat[8];

        var m10 = mat[1];
        var m11 = mat[5];
        var m12 = mat[9];

        var m20 = mat[2];
        var m21 = mat[6];
        var m22 = mat[10];

        v[0] = m00 * x + m01 * y + m02 * z;
        v[1] = m10 * x + m11 * y + m12 * z;
        v[2] = m20 * x + m21 * y + m22 * z;
    };

    function NormalizeVector3(v) {
        var inv = 1.0 / Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        v[0] *= inv;
        v[1] *= inv;
        v[2] *= inv;
    };

    function IsTranslationMatrix(mat) {
        return Math.abs(mat[0] - 1.0) < 1e-6 &&
               Math.abs(mat[1]) < 1e-6 &&
               Math.abs(mat[2]) < 1e-6 &&
               Math.abs(mat[4]) < 1e-6 &&
               Math.abs(mat[5] - 1.0) < 1e-6 &&
               Math.abs(mat[6]) < 1e-6 &&
               Math.abs(mat[8]) < 1e-6 &&
               Math.abs(mat[9]) < 1e-6 &&
               Math.abs(mat[10] - 1.0) < 1e-6;
    };

    function IsTranslationScalingMatrix(mat) {
        return Math.abs(mat[1]) < 1e-6 &&
               Math.abs(mat[2]) < 1e-6 &&
               Math.abs(mat[4]) < 1e-6 &&
               Math.abs(mat[6]) < 1e-6 &&
               Math.abs(mat[8]) < 1e-6 &&
               Math.abs(mat[9]) < 1e-6;
    };

    function UnionBBox(v, bbox) {
        if (v[0] < bbox[0]) bbox[0] = v[0];
        if (v[0] > bbox[3]) bbox[3] = v[0];
        if (v[1] < bbox[1]) bbox[1] = v[1];
        if (v[1] > bbox[4]) bbox[4] = v[1];
        if (v[2] < bbox[2]) bbox[2] = v[2];
        if (v[2] > bbox[5]) bbox[5] = v[2];
    };
    
    function TransformUncompressVertices1(vertices, encodedVertices, attributeData, translate) {
        var vertexNumber = vertices.byteLength / attributeData.values[0].stride;
        var dstOffset = 0;
        var srcOffset = 0;
        var dstStride = attributeData.values[0].stride;
        var srcStride = encodedVertices.byteLength / vertexNumber;
        var i, p0, p1, p2;
        if (attributeData.primitive === 4 && self.compressed) {
            if (self.version >= 502) {
                for (i = 0; i < vertexNumber; i++) {
                    var p0 = encodedVertices.getFloat32(srcOffset,     self.littleEndian);
                    var p1 = encodedVertices.getFloat32(srcOffset + 4, self.littleEndian);
                    var p2 = encodedVertices.getFloat32(srcOffset + 8, self.littleEndian);

                    vertices.setFloat32(dstOffset,     p0 + translate[0], self.littleEndian);
                    vertices.setFloat32(dstOffset + 4, p1 + translate[1], self.littleEndian);
                    vertices.setFloat32(dstOffset + 8, p2 + translate[2], self.littleEndian);

                    vertices.setInt32(dstOffset + 12, encodedVertices.getInt32(srcOffset + 12, self.littleEndian), self.littleEndian);

                    srcOffset += srcStride;
                    dstOffset += dstStride;
                } 
            } else {
                for (i = 0; i < vertexNumber; i++) {
                    p0 = encodedVertices.getFloat32(srcOffset,     self.littleEndian);
                    p1 = encodedVertices.getFloat32(srcOffset + 4, self.littleEndian);
                    p2 = encodedVertices.getFloat32(srcOffset + 8, self.littleEndian);

                    vertices.setFloat32(dstOffset,     p0 + translate[0], self.littleEndian);
                    vertices.setFloat32(dstOffset + 4, p1 + translate[1], self.littleEndian);
                    vertices.setFloat32(dstOffset + 8, p2 + translate[2], self.littleEndian);

                    var n0 = encodedVertices.getUint16(srcOffset + 12, self.littleEndian) / 256 - 128;
                    var n1 = encodedVertices.getUint16(srcOffset + 14, self.littleEndian) / 256 - 128;
                    var n2 = encodedVertices.getUint16(srcOffset + 16, self.littleEndian) / 256 - 128;

                    vertices.setInt8(dstOffset + 12, n0);
                    vertices.setInt8(dstOffset + 13, n1);
                    vertices.setInt8(dstOffset + 14, n2);

                    srcOffset += srcStride;
                    dstOffset += dstStride;
                } 
            }

            if (attributeData.values.length > 2) {
                dstOffset = 16;
                srcOffset = self.version >= 502? 16 : 18;
                if (attributeData.values[2].index === 2) { // texcoord 
                    for (i = 0; i < vertexNumber; i++) {
                        vertices.setFloat64(dstOffset, encodedVertices.getFloat32(srcOffset, self.littleEndian), self.littleEndian);
                        srcOffset += srcStride;
                        dstOffset += dstStride;
                    }
                } else { // vertex color
                    for (i = 0; i < vertexNumber; i++) {
                        vertices.setUint32(dstOffset, encodedVertices.getUint32(srcOffset, self.littleEndian), self.littleEndian);

                        srcOffset += srcStride;
                        dstOffset += dstStride;
                    }
                }
            }
        } else {
            for (i = 0; i < vertexNumber; i++) {
                p0 = encodedVertices.getFloat32(srcOffset,     self.littleEndian);
                p1 = encodedVertices.getFloat32(srcOffset + 4, self.littleEndian);
                p2 = encodedVertices.getFloat32(srcOffset + 8, self.littleEndian);

                vertices.setFloat32(dstOffset,     p0 + translate[0], self.littleEndian);
                vertices.setFloat32(dstOffset + 4, p1 + translate[1], self.littleEndian);
                vertices.setFloat32(dstOffset + 8, p2 + translate[2], self.littleEndian);

                dstOffset += dstStride;
                srcOffset += srcStride;
            }

            if (attributeData.primitive === 4) {
                dstOffset = 12;
                srcOffset = 12;
                for (i = 0; i < vertexNumber; i++) {
                    var p3, p4, p5;
                    p3 = encodedVertices.getFloat32(srcOffset,     self.littleEndian);
                    p4 = encodedVertices.getFloat32(srcOffset + 4, self.littleEndian);
                    p5 = encodedVertices.getFloat32(srcOffset + 8, self.littleEndian);
                        
                    vertices.setInt8(dstOffset,     p3 * 127, self.littleEndian);
                    vertices.setInt8(dstOffset + 1, p4 * 127, self.littleEndian);
                    vertices.setInt8(dstOffset + 2, p5 * 127, self.littleEndian);
                    
                    srcOffset += srcStride;
                    dstOffset += dstStride;
                }

                if (attributeData.values.length > 2) {
                    dstOffset = 16;
                    srcOffset = 24;
                    if (attributeData.values[2].index === 2) { // texcoord 
                        for (i = 0; i < vertexNumber; i++) {
                            vertices.setFloat64(dstOffset, encodedVertices.getFloat32(srcOffset, self.littleEndian), self.littleEndian);
                            srcOffset += srcStride;
                            dstOffset += dstStride;
                        }
                    } else { // vertex color
                        for (i = 0; i < vertexNumber; i++) {
                            vertices.setUint32(dstOffset, encodedVertices.getUint32(srcOffset, self.littleEndian), self.littleEndian);

                            srcOffset += srcStride;
                            dstOffset += dstStride;
                        }
                    }
                }
            }
        }
    };

    function TransformUncompressVertices2(vertices, encodedVertices, attributeData, scale, translate) {
        var vertexNumber = vertices.byteLength / attributeData.values[0].stride;
        var dstOffset = 0;
        var srcOffset = 0;
        var dstStride = attributeData.values[0].stride;
        var srcStride = encodedVertices.byteLength / vertexNumber;
        var invScale0 = 1.0 / scale[0];
        var invScale1 = 1.0 / scale[1];
        var invScale2 = 1.0 / scale[2];
        var n = [0, 0, 0];
        var i, p0, p1, p2, p3, p4, p5;
        if (attributeData.primitive === 4 && self.compressed) {
            if (self.version >= 502) {
                for (i = 0; i < vertexNumber; i++) {
                    p0 = encodedVertices.getFloat32(srcOffset,     self.littleEndian);
                    p1 = encodedVertices.getFloat32(srcOffset + 4, self.littleEndian);
                    p2 = encodedVertices.getFloat32(srcOffset + 8, self.littleEndian);

                    vertices.setFloat32(dstOffset,     p0 * scale[0] + translate[0], self.littleEndian);
                    vertices.setFloat32(dstOffset + 4, p1 * scale[1] + translate[1], self.littleEndian);
                    vertices.setFloat32(dstOffset + 8, p2 * scale[2] + translate[2], self.littleEndian);

                    p3 = encodedVertices.getInt8(srcOffset + 12, self.littleEndian);
                    p4 = encodedVertices.getInt8(srcOffset + 13, self.littleEndian);
                    p5 = encodedVertices.getInt8(srcOffset + 14, self.littleEndian);

                    n[0] = p3 * invScale0;
                    n[1] = p4 * invScale1;
                    n[2] = p5 * invScale2;
                    NormalizeVector3(n);
                        
                    vertices.setInt8(dstOffset + 12, n[0] * 127);
                    vertices.setInt8(dstOffset + 13, n[1] * 127);
                    vertices.setInt8(dstOffset + 14, n[2] * 127);

                    srcOffset += srcStride;
                    dstOffset += dstStride;
                } 
            } else {
                for (i = 0; i < vertexNumber; i++) {
                    p0 = encodedVertices.getFloat32(srcOffset,     self.littleEndian);
                    p1 = encodedVertices.getFloat32(srcOffset + 4, self.littleEndian);
                    p2 = encodedVertices.getFloat32(srcOffset + 8, self.littleEndian);

                    vertices.setFloat32(dstOffset,     p0 * scale[0] + translate[0], self.littleEndian);
                    vertices.setFloat32(dstOffset + 4, p1 * scale[1] + translate[1], self.littleEndian);
                    vertices.setFloat32(dstOffset + 8, p2 * scale[2] + translate[2], self.littleEndian);

                    p3 = encodedVertices.getUint16(srcOffset + 12, self.littleEndian) - 32768;
                    p4 = encodedVertices.getUint16(srcOffset + 14, self.littleEndian) - 32768;
                    p5 = encodedVertices.getUint16(srcOffset + 16, self.littleEndian) - 32768;

                    n[0] = p3 * invScale0;
                    n[1] = p4 * invScale1;
                    n[2] = p5 * invScale2;
                    NormalizeVector3(n);
                        
                    vertices.setInt8(dstOffset + 12, n[0] * 127);
                    vertices.setInt8(dstOffset + 13, n[1] * 127);
                    vertices.setInt8(dstOffset + 14, n[2] * 127);

                    srcOffset += srcStride;
                    dstOffset += dstStride;
                } 
            }

            if (attributeData.values.length > 2) {
                dstOffset = 16;
                srcOffset = self.version >= 502? 16 : 18;
                if (attributeData.values[2].index === 2) { // texcoord 
                    for (i = 0; i < vertexNumber; i++) {
                        vertices.setFloat64(dstOffset, encodedVertices.getFloat64(srcOffset, self.littleEndian), self.littleEndian);
                        srcOffset += srcStride;
                        dstOffset += dstStride;
                    }
                } else { // vertex color
                    for (i = 0; i < vertexNumber; i++) {
                        vertices.setUint32(dstOffset, encodedVertices.getUint32(srcOffset, self.littleEndian), self.littleEndian);

                        srcOffset += srcStride;
                        dstOffset += dstStride;
                    }
                }
            }
        } else {
            // Uncompressed
            for (i = 0; i < vertexNumber; i++) {
                p0 = encodedVertices.getFloat32(srcOffset,     self.littleEndian);
                p1 = encodedVertices.getFloat32(srcOffset + 4, self.littleEndian);
                p2 = encodedVertices.getFloat32(srcOffset + 8, self.littleEndian);

                vertices.setFloat32(dstOffset,     p0 * scale[0] + translate[0], self.littleEndian);
                vertices.setFloat32(dstOffset + 4, p1 * scale[1] + translate[1], self.littleEndian);
                vertices.setFloat32(dstOffset + 8, p2 * scale[2] + translate[2], self.littleEndian);

                dstOffset += dstStride;
                srcOffset += srcStride;
            }

            if (attributeData.primitive === 4) {
                dstOffset = 12;
                srcOffset = 12;
                for (i = 0; i < vertexNumber; i++) {
                    p3 = encodedVertices.getFloat32(srcOffset,     self.littleEndian);
                    p4 = encodedVertices.getFloat32(srcOffset + 4, self.littleEndian);
                    p5 = encodedVertices.getFloat32(srcOffset + 8, self.littleEndian);
                    
                    n[0] = p3 * invScale0;
                    n[1] = p4 * invScale1;
                    n[2] = p5 * invScale2;
                    NormalizeVector3(n);
                        
                    vertices.setInt8(dstOffset,     n[0] * 127);
                    vertices.setInt8(dstOffset + 1, n[1] * 127);
                    vertices.setInt8(dstOffset + 2, n[2] * 127);
                    
                    srcOffset += srcStride;
                    dstOffset += dstStride;
                }

                if (attributeData.values.length > 2) {
                    dstOffset = 16;
                    srcOffset = 24;
                    if (attributeData.values[2].index === 2) { // texcoord 
                        for (i = 0; i < vertexNumber; i++) {
                            vertices.setFloat64(dstOffset, encodedVertices.getFloat64(srcOffset, self.littleEndian), self.littleEndian);
                            srcOffset += srcStride;
                            dstOffset += dstStride;
                        }
                    } else { // vertex color
                        for (i = 0; i < vertexNumber; i++) {
                            vertices.setUint32(dstOffset, encodedVertices.getUint32(srcOffset, self.littleEndian), self.littleEndian);

                            srcOffset += srcStride;
                            dstOffset += dstStride;
                        }
                    }
                }
            }
        }
    };
    
    function TransformUncompressVertices3(vertices, encodedVertices, attributeData, transform, bbox) {
        var vertexNumber = vertices.byteLength / attributeData.values[0].stride;
        var dstOffset = 0;
        var srcOffset = 0;
        var dstStride = attributeData.values[0].stride;
        var srcStride = encodedVertices.byteLength / vertexNumber;
        var n = [0, 0, 0];
        var v = [0, 0, 0];
        var i, p0, p1, p2, p3, p4, p5;
        if (attributeData.primitive === 4 && self.compressed) {
            if (self.version >= 502) {
                for (i = 0; i < vertexNumber; i++) {
                    p0 = encodedVertices.getFloat32(srcOffset,     self.littleEndian);
                    p1 = encodedVertices.getFloat32(srcOffset + 4, self.littleEndian);
                    p2 = encodedVertices.getFloat32(srcOffset + 8, self.littleEndian);

                    MultiplyVertex(v, transform, p0, p1, p2);
                    vertices.setFloat32(dstOffset,     v[0], self.littleEndian);
                    vertices.setFloat32(dstOffset + 4, v[1], self.littleEndian);
                    vertices.setFloat32(dstOffset + 8, v[2], self.littleEndian);

                    UnionBBox(v, bbox);
                    
                    p3 = encodedVertices.getInt8(srcOffset + 12);
                    p4 = encodedVertices.getInt8(srcOffset + 13);
                    p5 = encodedVertices.getInt8(srcOffset + 14);

                    MultiplyNormal(n, transform, p3, p4, p5);
                    NormalizeVector3(n);
                        
                    vertices.setInt8(dstOffset + 12, n[0] * 127);
                    vertices.setInt8(dstOffset + 13, n[1] * 127);
                    vertices.setInt8(dstOffset + 14, n[2] * 127);

                    srcOffset += srcStride;
                    dstOffset += dstStride;
                } 
            } else {
                for (i = 0; i < vertexNumber; i++) {
                    p0 = encodedVertices.getFloat32(srcOffset,     self.littleEndian);
                    p1 = encodedVertices.getFloat32(srcOffset + 4, self.littleEndian);
                    p2 = encodedVertices.getFloat32(srcOffset + 8, self.littleEndian);

                    MultiplyVertex(v, transform, p0, p1, p2);
                    vertices.setFloat32(dstOffset,     v[0], self.littleEndian);
                    vertices.setFloat32(dstOffset + 4, v[1], self.littleEndian);
                    vertices.setFloat32(dstOffset + 8, v[2], self.littleEndian);

                    UnionBBox(v, bbox);
                    
                    p3 = encodedVertices.getUint16(srcOffset + 12, self.littleEndian) - 32768;
                    p4 = encodedVertices.getUint16(srcOffset + 14, self.littleEndian) - 32768;
                    p5 = encodedVertices.getUint16(srcOffset + 16, self.littleEndian) - 32768;

                    MultiplyNormal(n, transform, p3, p4, p5);
                    NormalizeVector3(n);
                        
                    vertices.setInt8(dstOffset + 12, n[0] * 127);
                    vertices.setInt8(dstOffset + 13, n[1] * 127);
                    vertices.setInt8(dstOffset + 14, n[2] * 127);

                    srcOffset += srcStride;
                    dstOffset += dstStride;
                } 
            }

            if (attributeData.values.length > 2) {
                dstOffset = 16;
                srcOffset = self.version >= 502? 16 : 18;
                if (attributeData.values[2].index === 2) { // texcoord 
                    for (i = 0; i < vertexNumber; i++) {
                        vertices.setFloat64(dstOffset, encodedVertices.getFloat64(srcOffset, self.littleEndian), self.littleEndian);
                        srcOffset += srcStride;
                        dstOffset += dstStride;
                    }
                } else { // vertex color
                    for (i = 0; i < vertexNumber; i++) {
                        vertices.setUint32(dstOffset, encodedVertices.getUint32(srcOffset, self.littleEndian), self.littleEndian);

                        srcOffset += srcStride;
                        dstOffset += dstStride;
                    }
                }
            }
        } else {
            for (i = 0; i < vertexNumber; i++) {
                p0 = encodedVertices.getFloat32(srcOffset,     self.littleEndian);
                p1 = encodedVertices.getFloat32(srcOffset + 4, self.littleEndian);
                p2 = encodedVertices.getFloat32(srcOffset + 8, self.littleEndian);
                
                MultiplyVertex(v, transform, p0, p1, p2);

                vertices.setFloat32(dstOffset,     v[0], self.littleEndian);
                vertices.setFloat32(dstOffset + 4, v[1], self.littleEndian);
                vertices.setFloat32(dstOffset + 8, v[2], self.littleEndian);

                dstOffset += dstStride;
                srcOffset += srcStride;
            }

            if (attributeData.primitive === 4) {
                dstOffset = 12;
                srcOffset = 12;
                for (i = 0; i < vertexNumber; i++) {
                    p3 = encodedVertices.getFloat32(srcOffset,     self.littleEndian);
                    p4 = encodedVertices.getFloat32(srcOffset + 4, self.littleEndian);
                    p5 = encodedVertices.getFloat32(srcOffset + 8, self.littleEndian);
                    
                    MultiplyNormal(n, transform, p3, p4, p5);
                    NormalizeVector3(n);
                        
                    vertices.setInt8(dstOffset,     n[0] * 127);
                    vertices.setInt8(dstOffset + 1, n[1] * 127);
                    vertices.setInt8(dstOffset + 2, n[2] * 127);
                    
                    srcOffset += srcStride;
                    dstOffset += dstStride;
                }

                if (attributeData.values.length > 2) {
                    dstOffset = 16;
                    srcOffset = 24;
                    if (attributeData.values[2].index === 2) { // texcoord 
                        for (i = 0; i < vertexNumber; i++) {
                            vertices.setFloat64(dstOffset, encodedVertices.getFloat64(srcOffset, self.littleEndian), self.littleEndian);
                            srcOffset += srcStride;
                            dstOffset += dstStride;
                        }
                    } else { // vertex color
                        for (i = 0; i < vertexNumber; i++) {
                            vertices.setUint32(dstOffset, encodedVertices.getUint32(srcOffset, self.littleEndian), self.littleEndian);

                            srcOffset += srcStride;
                            dstOffset += dstStride;
                        }
                    }
                }
            }
        }
    };

    function UncompressIndices(indices, indexType, encodedIndices, encodedIndexType, vertexIndexOffset) {
        if (indexType < encodedIndexType) {
            console.error("can't uncompress index.");
        }

        if (vertexIndexOffset === undefined) {
            vertexIndexOffset = 0;
        }

        var indexNumber = encodedIndices.byteLength / encodedIndexType;
        var srcOffset = 0;
        var dstOffset = 0;
        var i, len;
        if (indexType === 4) {
            if (encodedIndexType === 1) {
                for (var i = 0; i < indexNumber; i++) {
                    indices.setUint32(dstOffset, encodedIndices.getUint8(i) + vertexIndexOffset, self.littleEndian);
                    dstOffset += 4;
                }
            } else if (encodedIndexType === 2) {
                for (i = 0; i < indexNumber; i++) {
                    indices.setUint32(dstOffset, encodedIndices.getUint16(srcOffset, self.littleEndian) + vertexIndexOffset, self.littleEndian);
                    dstOffset += 4;
                    srcOffset += 2;
                }
            } else {
                for (i = 0; i < indexNumber; i++) {
                    indices.setUint32(dstOffset, encodedIndices.getUint32(srcOffset, self.littleEndian) + vertexIndexOffset, self.littleEndian);
                    dstOffset += 4;
                    srcOffset += 4;
                }
            }
        } else if (indexType === 2) {
            if (encodedIndexType === 1) {
                for (i = 0; i < indexNumber; i++) {
                    indices.setUint16(dstOffset, encodedIndices.getUint8(i) + vertexIndexOffset, self.littleEndian);
                    dstOffset += 2;
                }
            } else {
                for (i = 0; i < indexNumber; i++) {
                    indices.setUint16(dstOffset, encodedIndices.getUint16(srcOffset, self.littleEndian) + vertexIndexOffset, self.littleEndian);
                    dstOffset += 2;
                    srcOffset += 2;
                }
            }
        } else {
            for (i = 0, len = indices.byteLength; i < len; i++) {
                indices.setUint8(i, encodedIndices.getUint8(i) + vertexIndexOffset);
            }
        }
    };
            
    function UncompressVertices(vertices, encodedVertices, attributeData) {
        var dstOffset = 0;
        var srcOffset = 0;
            
        var vertexNumber = vertices.byteLength / attributeData.values[0].stride;
            
        var dstStride = attributeData.values[0].stride;
        var srcStride = encodedVertices.byteLength / vertexNumber;
        var i;
        if (attributeData.primitive === 4 && self.compressed) {

            if (self.version >= 502) {
                for (i = 0; i < vertexNumber; ++i) {
                    vertices.setFloat64(dstOffset,     encodedVertices.getFloat64(srcOffset,     self.littleEndian), self.littleEndian);
                    vertices.setFloat64(dstOffset + 8, encodedVertices.getFloat64(srcOffset + 8, self.littleEndian), self.littleEndian);

                    dstOffset += dstStride;
                    srcOffset += srcStride;
                }
            } else {
                for (i = 0; i < vertexNumber; ++i) {
                    vertices.setFloat64(dstOffset,     encodedVertices.getFloat64(srcOffset,     self.littleEndian), self.littleEndian);
                    vertices.setFloat32(dstOffset + 8, encodedVertices.getFloat32(srcOffset + 8, self.littleEndian), self.littleEndian);

                    vertices.setInt8(dstOffset + 12, encodedVertices.getUint16(srcOffset + 12, self.littleEndian) / 256 - 128);
                    vertices.setInt8(dstOffset + 13, encodedVertices.getUint16(srcOffset + 14, self.littleEndian) / 256 - 128);
                    vertices.setInt8(dstOffset + 14, encodedVertices.getUint16(srcOffset + 16, self.littleEndian) / 256 - 128);

                    dstOffset += dstStride;
                    srcOffset += srcStride;
                }
            }

            if (attributeData.values.length > 2) {
                dstOffset = 16;
                srcOffset = self.version >= 502? 16 : 18;
                if (attributeData.values[2].index === 2) { // texcoord 
                    for (i = 0; i < vertexNumber; ++i) {
                        vertices.setFloat64(dstOffset, encodedVertices.getFloat64(srcOffset, self.littleEndian), self.littleEndian);
                        srcOffset += srcStride;
                        dstOffset += dstStride;
                    }
                } else { // vertex color
                    for (i = 0; i < vertexNumber; ++i) {
                        vertices.setUint32(dstOffset, encodedVertices.getUint32(srcOffset, self.littleEndian), self.littleEndian);
                        srcOffset += srcStride;
                        dstOffset += dstStride;
                    }
                }
            }
        } else {
            for (i = 0; i < vertexNumber; i++) {
                vertices.setFloat64(dstOffset,     encodedVertices.getFloat64(srcOffset,     self.littleEndian), self.littleEndian);
                vertices.setFloat32(dstOffset + 8, encodedVertices.getFloat32(srcOffset + 8, self.littleEndian), self.littleEndian);

                dstOffset += dstStride;
                srcOffset += srcStride;
            }

            if (attributeData.primitive === 4) {
                dstOffset = 12;
                srcOffset = 12;
                for (i = 0; i < vertexNumber; i++) {
                    var p3 = encodedVertices.getFloat32(srcOffset,     self.littleEndian);
                    var p4 = encodedVertices.getFloat32(srcOffset + 4, self.littleEndian);
                    var p5 = encodedVertices.getFloat32(srcOffset + 8, self.littleEndian);
                    
                    vertices.setInt8(dstOffset,     p3 * 127, self.littleEndian);
                    vertices.setInt8(dstOffset + 1, p4 * 127, self.littleEndian);
                    vertices.setInt8(dstOffset + 2, p5 * 127, self.littleEndian);
                    
                    srcOffset += srcStride;
                    dstOffset += dstStride;
                }

                if (attributeData.values.length > 2) {
                    dstOffset = 16;
                    srcOffset = 24;
                    if (attributeData.values[2].index === 2) { // texcoord 
                        for (i = 0; i < vertexNumber; i++) {
                            vertices.setFloat64(dstOffset, encodedVertices.getFloat64(srcOffset, self.littleEndian), self.littleEndian);
                            srcOffset += srcStride;
                            dstOffset += dstStride;
                        }
                    } else { // vertex color
                        for (i = 0; i < vertexNumber; i++) {
                            vertices.setUint8(dstOffset,     encodedVertices.getFloat32(srcOffset,      self.littleEndian) * 255);
                            vertices.setUint8(dstOffset + 1, encodedVertices.getFloat32(srcOffset + 4,  self.littleEndian) * 255);
                            vertices.setUint8(dstOffset + 2, encodedVertices.getFloat32(srcOffset + 8,  self.littleEndian) * 255);
                            vertices.setUint8(dstOffset + 3, encodedVertices.getFloat32(srcOffset + 12, self.littleEndian) * 255);

                            srcOffset += srcStride;
                            dstOffset += dstStride;
                        }
                    }
                }
            }
        }
    };

    function PopulateNodes(nodes, meshesData, attributesData, meshBinary, billboard) {
        // Group nodes into meshes and find the return binary bytes
        var meshesNodes = {};
        var numMeshes = 0;
        var i, len;
        for (i = 0, len = nodes.length; i < len; ++i) {
            var nodeData = nodes[i];
            if (!meshesNodes[nodeData.mesh]) {
                var meshData = meshesData[nodeData.mesh];
                var attributeData = attributesData[meshData.attribute];
                meshesNodes[nodeData.mesh] = {
                    info: GetMeshInfo(meshData, attributeData),
                    nodes: []
                };
                numMeshes++;
            }
            meshesNodes[nodeData.mesh].nodes.push(nodeData);
        }

        // Compute the return mesh binary size 
        var verticesOffset = 0;
        var indicesOffset = 0;
        var retMeshBinaryBytes = 0;
        for (var mesh in meshesNodes) {
            indicesOffset += meshesNodes[mesh].info.vertexBytes;
            retMeshBinaryBytes += meshesNodes[mesh].info.vertexBytes + meshesNodes[mesh].info.indexBytes;
        }

        // Create the returned binary
        var nodeIndex = 0;
        var retMeshBinary = new ArrayBuffer(retMeshBinaryBytes);
        self.allocatedBytes += retMeshBinaryBytes;
        //console.log("nodes allocated KB: " + Math.round(self.allocatedBytes / 1024));

        var nodesInfo = new Array(nodes.length);
        for (var mesh in meshesNodes) {
            var meshData = meshesData[mesh];
            var meshInfo = meshesNodes[mesh].info;
            var attributeData = attributesData[meshData.attribute];

            var vertices = new DataView(retMeshBinary, verticesOffset, meshInfo.vertexBytes);
            var indices  = new DataView(retMeshBinary, indicesOffset, meshInfo.indexBytes);

            var encodedVertices = new DataView(meshBinary, meshData.vertices.byteOffset, meshData.vertices.byteLength);
            var encodedIndices  = new DataView(meshBinary, meshData.indices.byteOffset, meshData.indices.byteLength);

            UncompressVertices(vertices, encodedVertices, attributeData);
            // indices are copied directly.
            UncompressIndices(indices, meshData.indices.type, encodedIndices, meshData.indices.type);

            for (i = 0, len = meshesNodes[mesh].nodes.length; i < len; i++) {
                var nodeData = meshesNodes[mesh].nodes[i];
                nodesInfo[nodeIndex++] = {
                        "name"           : nodeData.name,
                        "layer"          : nodeData.layer,
                        "views"          : nodeData.views,
                        "mesh"           : mesh,
                        "verticesOffset" : verticesOffset,
                        "indicesOffset"  : indicesOffset,
                        "verticesBytes"  : meshInfo.vertexBytes,
                        "indicesBytes"   : meshInfo.indexBytes,
                        "material"       : nodeData.material,
                        "transform"      : nodeData.transform,
                        "billboard"      : billboard,
                        "bbox"           : nodeData.bbox,
                        "indexType"      : meshData.indices.type || 2,
                        "attribute"      : meshData.attribute

                };
            }
            
            verticesOffset += meshInfo.vertexBytes;
            indicesOffset  += meshInfo.indexBytes;
        
            // GC
            encodedIndices  = null;
            encodedVertices = null;
            indices         = null;
            vertices        = null;
        }

        self.retMessage.nodes = nodesInfo;
        self.retMessage.meshBinary = retMeshBinary;
        self.retMessage.finished = false;
        PostMessage();

        retMeshBinary = null;
    };

    function PopulateMergeNode(nodes, meshesData, attribute, attributeData, meshBinary) {
        if (nodes.length <= 1) {
            throw "can't one or zero nodes";
        }
        var nodesInfo = new Array(nodes.length);
        var vertexNumber = 0;
        var indexNumber = 0;
        var vertexOffset = 0;
        var indexOffset  = 0;
        var i, len;
        for (i = 0, len = nodes.length; i < len; i++) {
            var meshData = meshesData[nodes[i].mesh];
            nodesInfo[i] = GetMeshInfo(meshData, attributeData);
            indexOffset += nodesInfo[i].vertexBytes;
            vertexNumber += nodesInfo[i].vertexNumber;
            indexNumber += nodesInfo[i].indexNumber;
        }

        var indexType = 0;
        if (vertexNumber < 256) {
            indexType = 1;
        } else if (vertexNumber <= 65536) {
            indexType = 2;
        } else {
            indexType = 4;
        }

        // Merge all the nodes into a big node
        var vertexBytes = vertexNumber * attributeData.values[0].stride;
        var indexBytes = indexNumber * indexType;
        var bytes = vertexBytes + indexBytes;
        var retMeshBinary = new ArrayBuffer(bytes);
        self.allocatedBytes += bytes;
        //console.log("merged nodes allocated KB: " + Math.round(self.allocatedBytes / 1024));

        // As we merge the nodes, we increase the indices memory footprint.
        var extraIndexMemory = 0;
        for (i = 0, len = nodes.length; i < len; i++) {
            var meshData = meshesData[nodes[i].mesh];
            var originalIndexType = meshData.indices.type || 2;
            extraIndexMemory += Math.max(meshData.indices.byteLength * (indexType - originalIndexType) / originalIndexType, 0);
        }
        self.memoryBudget -= extraIndexMemory;
        //console.log("Extra index memory: " + extraIndexMemory);

        var bbox =  [Number.MAX_VALUE,  
                     Number.MAX_VALUE,  
                     Number.MAX_VALUE,
                    -Number.MAX_VALUE, 
                    -Number.MAX_VALUE, 
                    -Number.MAX_VALUE];
        var v0 = [0, 0, 0];
        var v1 = [0, 0, 0];
        var translate = [0, 0, 0];
        var scale = [0, 0, 0];
        
        //console.log(nodes.length + " nodes merged into one and has vertex: " + vertexNumber);
            
        for (i = 0, len = nodes.length; i < len; i++) {
            var nodeData = nodes[i];
            var meshData = meshesData[nodeData.mesh];

            var vertices = new DataView(retMeshBinary, vertexOffset, nodesInfo[i].vertexBytes);
            var indices  = new DataView(retMeshBinary, indexOffset, nodesInfo[i].indexNumber * indexType);

            var encodedVertices = new DataView(meshBinary, meshData.vertices.byteOffset, meshData.vertices.byteLength);
            var encodedIndices  = new DataView(meshBinary, meshData.indices.byteOffset, meshData.indices.byteLength);

            if (nodeData.transform) {
                if (IsTranslationMatrix(nodeData.transform)) {
                    translate[0] = nodeData.transform[12];
                    translate[1] = nodeData.transform[13];
                    translate[2] = nodeData.transform[14];
                    TransformUncompressVertices1(vertices, encodedVertices, attributeData, translate);
                    UnionBBox(nodeData.bbox, bbox);
                    v1[0] = nodeData.bbox[3];
                    v1[1] = nodeData.bbox[4];
                    v1[2] = nodeData.bbox[5];
                    UnionBBox(v1, bbox);
                } else if (IsTranslationScalingMatrix(nodeData.transform)) {
                    translate[0] = nodeData.transform[12];
                    translate[1] = nodeData.transform[13];
                    translate[2] = nodeData.transform[14];
                    scale[0] = nodeData.transform[0];
                    scale[1] = nodeData.transform[5];
                    scale[2] = nodeData.transform[10];
                    TransformUncompressVertices2(vertices, encodedVertices, attributeData, scale, translate);
                    UnionBBox(nodeData.bbox, bbox);
                    v1[0] = nodeData.bbox[3];
                    v1[1] = nodeData.bbox[4];
                    v1[2] = nodeData.bbox[5];
                    UnionBBox(v1, bbox);
                } else {
                    TransformUncompressVertices3(vertices, encodedVertices, attributeData, nodeData.transform, bbox);
                }
            } else {
                UncompressVertices(vertices, encodedVertices, attributeData);
                UnionBBox(nodeData.bbox, bbox);
                v1[0] = nodeData.bbox[3];
                v1[1] = nodeData.bbox[4];
                v1[2] = nodeData.bbox[5];
                UnionBBox(v1, bbox);
            }
            UncompressIndices(indices, indexType, encodedIndices, meshData.indices.type || 2, 
                    vertexOffset / attributeData.values[0].stride);

            vertexOffset += nodesInfo[i].vertexBytes;
            indexOffset += nodesInfo[i].indexNumber * indexType;
        
            // GC
            encodedIndices  = null;
            encodedVertices = null;
            vertices        = null;
            indices         = null;
        }

        var nodeInfo = {
            "name"           : nodes[0].name,
            "layer"          : nodes[0].layer,
            "views"          : nodes[0].views,
            "mesh"           : nodes[0].name + nodes[0].mesh,
            "verticesOffset" : 0,
            "indicesOffset"  : vertexOffset,
            "verticesBytes"  : vertexBytes,
            "indicesBytes"   : indexBytes,
            "material"       : nodes[0].material,
            "transform"      : null,
            "billboard"      : false,
            "bbox"           : bbox,
            "indexType"      : indexType,
            "attribute"      : attribute
        };

        self.retMessage.nodes = [nodeInfo];
        self.retMessage.meshBinary = retMeshBinary;
        PostMessage();

        // GC
        retMeshBinary = null;
    };
    
    function PopulateNodesAfterMerge(nodes, meshesData, attribute, attributeData, meshBinary, indexType) {
        var attributesData = {};
        attributesData[attribute] = attributeData;

        var meshesInfo = {};
        var nodesInfo = Array(nodes.length);
        var i, len;
        for (i = 0, len = nodes.length; i < len; i++) {
            var nodeData = nodes[i];
            var meshInfo = meshesInfo[nodeData.mesh];
            if (!meshInfo) {
                var meshData = meshesData[nodeData.mesh];
                meshInfo = GetMeshInfo(meshData, attributeData);
                meshesInfo[nodeData.mesh] = meshInfo;
            }

            meshInfo.ref++;
            
            nodesInfo[i] = { 
                node         : i,
                vertexNumber : meshInfo.vertexNumber,
                mergible     : false
            };
        }

        // sort the nodes with their vertex number
        nodesInfo.sort(function(a, b) {
            if (a.vertexNumber < b.vertexNumber) {
                return -1;
            } else if (a.vertexNumber === b.vertexNumber) {
                return 0;
            } else {
                return 1;
            }
        });

        // Check if the node is mergible
        for (i = 0, len = nodesInfo.length; i < len; i++) {
            var nodeInfo = nodesInfo[i];
            var nodeData = nodes[nodeInfo.node];
            var meshData = meshesData[nodeData.mesh];
            var meshInfo = meshesInfo[nodeData.mesh];

            var thisIndexType = meshData.indices.type || 2;
            if (thisIndexType > indexType) {
                nodeInfo.mergible = false;
                continue;
            }
                
            // See if we have enough memory budget to merge this mesh
            var extraIndexMemory = 0;
            var extraVertexMemory = 0;
            if (meshInfo.ref === 1) {
                // If this node does not share mesh with other nodes, the increment memory
                // is only by the extra index type upgrade.
                extraIndexMemory = meshInfo.indexNumber * (indexType - thisIndexType);
            } else {
                // If it is the first we try to merge this mesh, the increment memory
                // is only the by extra index type upgrade.
                if (!meshInfo.seen) {
                    extraIndexMemory = meshInfo.indexNumber * (indexType - thisIndexType);
                    meshInfo.seen = true;
                } else {
                    extraVertexMemory = meshInfo.vertexNumber * attributeData.values[0].stride;
                    extraIndexMemory  = meshInfo.indexNumber * indexType;
                }
            } 

            var extraMemory = extraVertexMemory + extraIndexMemory;
            // We only subtract the vertex bytes from the memory budget here. It is very coarse. But we don't know 
            // the precise index bytes at this point of time. Moreover, the node may not get merged at all when
            // its vertex number is larger than limitation.
            if (extraMemory < self.memoryBudget) {
                self.memoryBudget -= extraVertexMemory;
                //console.log("Extra vertex memory: " + extraVertexMemory);
                nodeInfo.mergible = true;
            }
        }

        // Populate non-mergibles
        var nonMergibles = [];
        for (i = 0, len = nodesInfo.length; i < len; i++) {
            var nodeInfo = nodesInfo[i];
            if (!nodeInfo.mergible) {
                nonMergibles.push(nodes[nodeInfo.node]);
            } 
        }

        
        if (nonMergibles.length === nodes.length) { // No nodes can be merged due to out of memory budget.
            PopulateNodes(nonMergibles, meshesData, attributesData, meshBinary, false);
            return;
        }

        var maxVertexNumber = [0, 256, 65536, 0, 4294967295];

        // Merge the rest nodes and populate a few large nodes.
        var totalVertexNumber = 0;
        var mergibles = [];
        nonMergibles = [];
        for (i = 0, len = nodesInfo.length; i < len; i++) {
            totalVertexNumber += nodesInfo[i].vertexNumber;
            if (totalVertexNumber > maxVertexNumber[indexType]) {
                if (mergibles.length > 1) {
                    PopulateMergeNode(mergibles, meshesData, attribute, attributeData, meshBinary);
                } else {
                    nonMergibles.push(mergibles[0]);
                }
                mergibles = [];
                totalVertexNumber = nodesInfo[i].vertexNumber;
            }
            mergibles.push(nodes[nodesInfo[i].node]);
        }
        if (mergibles.length > 1) {
            PopulateMergeNode(mergibles, meshesData, attribute, attributeData, meshBinary);
        } else {
            nonMergibles.push(mergibles[0]);
        }
        if (nonMergibles.length > 0) {
            PopulateNodes(nonMergibles, meshesData, attributesData, meshBinary, false);
        }
    };

    // Initialize the worker thread once.
    function Initialize1(data) {
        // Make sure all variables in this thread are initialized only once.
        self.littleEndian    = data.littleEndian;
        self.compressed      = data.compressed;
        self.memoryBudget    = data.memoryBudget;
        self.attributesData  = data.attributesData;
        self.sceneData       = data.sceneData;
        self.version         = data.version;
    };
            
    function ComputeMergeBenefit(nodes, meshesData, attributesData) {
        var nodeInfo = new Array(nodes.length);
        var meshData = meshesData[nodes[0].mesh];
        var attributeData = attributesData[meshData.attribute];
        var meshInfo = GetMeshInfo(meshData, attributeData);
        nodeInfo[0] = {
            "vertexBytes": meshInfo.vertexBytes,
            "indexBytes": meshInfo.indexBytes,
            "vertexNumber": meshInfo.vertexNumber,
            "indexNumber": meshInfo.indexNumber,
            index: 0,
            mesh: nodes[0].mesh
        };
        var isIndexUint = false;
        if (meshData.indexType && meshData.indexType > 2) {
            isIndexUint = true;
        }
        var i, len;
        for (i = 1, len = nodes.length; i < len; ++i) {
            meshData = meshesData[nodes[i].mesh];
            if ((isIndexUint && !(meshData.indexType && meshData.indexType > 2)) ||
                (!isIndexUint && (meshData.indexType && meshData.indexType > 2))) {
                console.error("this group contains both uint and <unit meshes.");
            }
            attributeData = attributesData[meshData.attribute];
            meshInfo = GetMeshInfo(meshData, attributeData);
            nodeInfo[i] = {
                "vertexBytes": meshInfo.vertexBytes,
                "indexBytes": meshInfo.indexBytes,
                "vertexNumber": meshInfo.vertexNumber,
                "indexNumber": meshInfo.indexNumber,
                index: i,
                mesh: nodes[i].mesh
            };
        }

        nodeInfo.sort(function(a, b) {
            return a.vertexNumber - b.vertexNumber;
        });

        // See if we can merge all nodes into one.
        var vertexNumber = 0;
        var seen = {};
        var vertexCost = 0;
        for (i = 0, len = nodeInfo.length; i < len; ++i) {
            if (seen.hasOwnProperty(nodeInfo[i].mesh)) {
                vertexCost += nodeInfo[i].vertexBytes;
            } else {
                seen[nodeInfo[i].mesh] = 1;
            }
            vertexNumber += nodeInfo[i].vertexNumber;
        }

        // If the total index number is less than 65536 or all meshes
        // are unit meshes, we can return here as it is the best merge result.
        if (vertexNumber <= 65536 || isIndexUint) {
            // index cost of merge when the index type is uint
            var indexSize;
            if (vertexNumber <= 256) {
                indexSize = 1;
            } else if (vertexNumber <= 65536) {
                indexSize = 2;
            } else {
                indexSize = 4;
            }

            var indexCost1 = 0;
            for (i = 0, len = nodeInfo.length; i < len; ++i) {
                var cost = indexSize * nodeInfo[i].indexNumber - nodeInfo[i].indexBytes;
                indexCost1 += cost;
            }
            
            var benefits1 = (nodeInfo.length - 1) / (indexCost1 + vertexCost);
            return { "benefit": benefits1, indexType: indexSize };
        }

        // Compute the merge cost if we can't merge to one node.
        var indexCost2 = 0;
        var j0 = 0;
        vertexNumber = nodeInfo[0].vertexNumber;
        var numNodes = 0;
        var j;
        for (i = 1, len = nodeInfo.length; i < len; ++i) {
            if (vertexNumber + nodeInfo[i].vertexNumber > 65536) {
                for (j = j0; j < i; j++) {
                    indexCost2 += 2 * nodeInfo[j].indexNumber - nodeInfo[j].indexBytes;
                }
                j0 = i;
                vertexNumber = nodeInfo[i].vertexNumber;
                numNodes++;
            } else {
                vertexNumber += nodeInfo[i].vertexNumber;
            }
        }
        if (j0 < nodeInfo.length) {
            for (j = j0, len = nodeInfo.length; j < len; j++) {
                indexCost2 += 2 * nodeInfo[j].indexNumber - nodeInfo[j].indexBytes;
            }
            numNodes++;
        }

        // Reorder the nodes according to their vertex number
        for (i = 0, len = nodeInfo.length; i < len; i++) {
            j = nodeInfo[i].index;
            nodes.push(nodes[j]);
        }
        for (i = 0, len = nodeInfo.length; i < len; i++) {
            nodes.shift();
        }

        // Find which merge way provides more benefits. 
        // Adding 1 is to avoid dividing by 0.
        var benefits2 = (nodeInfo.length - numNodes) / (indexCost2 + vertexCost + 1);
        return { "benefit": benefits2, indexType: 2};
    };

    // Initialize the worker thread per every mesh.bin
    function Initialize2(meshBinaryName) {
        self.nodesInfo = [];

        var nodesLayers = {};
        var i, len;
        for (var layer in self.sceneData.layers) {
            var layerData = self.sceneData.layers[layer];
            for (i = 0, len = layerData.nodes.length; i < len; ++i) {
                var nodeName = layerData.nodes[i];
                nodesLayers[nodeName] = layer;
            }
        }
        
        var meshesData = self.sceneData.meshes[meshBinaryName];
        var node, nodeData;
        for (node in self.sceneData.scene.nodes) {
            nodeData = self.sceneData.scene.nodes[node];

            if (meshesData.hasOwnProperty(nodeData.mesh)) {
                var nodeInfo = new NodeInfo();
                nodeInfo.name      = node;
                nodeInfo.layer     = nodesLayers[nodeInfo.name];
                nodeInfo.mesh      = nodeData.mesh;
                nodeInfo.material  = nodeData.material;
                nodeInfo.billboard = false;
                nodeInfo.transform = nodeData.transform? ExtendTransform(nodeData.transform) : null;
                nodeInfo.bbox      = nodeData.bbox;
                nodeInfo.views     = nodeData.views? nodeData.views.sort() : [];

                self.nodesInfo.push(nodeInfo);
            }
        }
        for (node in self.sceneData.scene.billboards) {
            nodeData = self.sceneData.scene.billboards[node];

            if (meshesData.hasOwnProperty(nodeData.mesh)) {
                var nodeInfo = new NodeInfo();
                nodeInfo.name      = node;
                nodeInfo.layer     = nodesLayers[nodeInfo.name];
                nodeInfo.mesh      = nodeData.mesh;
                nodeInfo.material  = nodeData.material;
                nodeInfo.billboard = true;
                nodeInfo.transform = nodeData.transform? ExtendTransform(nodeData.transform) : null;
                nodeInfo.bbox      = nodeData.bbox;
                nodeInfo.views     = nodeData.views? nodeData.views.sort() : [];

                self.nodesInfo.push(nodeInfo);
            }
        }

        // Cook the node and billboard information and once mesh is downloaded,
        // we can start populating the meshes.
        self.billboards = [];
        var nodes = [];
        for (i = 0, len = self.nodesInfo.length; i < len; ++i) {
            if (self.nodesInfo[i].billboard) {
                self.billboards.push(self.nodesInfo[i]);
            } else {
                nodes.push(self.nodesInfo[i]);
            }
        }
        self.billboards.sort(function(a, b) {
            return a.mesh.localeCompare(b.mesh);
        });

        self.nodes = [];
        self.nodesGroups = [];

        if (nodes.length > 0) {
            var nodesGroups = GroupNodes(nodes, meshesData);
            for (i = 0, len = nodesGroups.length; i < len; ++i) {
                if (nodesGroups[i].length > 1) {
                    self.nodesGroups.push(nodesGroups[i]);
                } else {
                    self.nodes.push(nodesGroups[i][0]);
                }
            }

            // Compute the merge cost (benefits) of each group
            if (self.nodesGroups.length > 0) {
                self.groupOrder = new Array(self.nodesGroups.length);
                for (i = 0, len = self.nodesGroups.length; i < len; i++) {
                    var cost = ComputeMergeBenefit(self.nodesGroups[i], self.sceneData.meshes[meshBinaryName], self.attributesData); 
                    self.groupOrder[i] = {
                        index: i, 
                        benefit: cost.benefit,
                        indexType: cost.indexType
                    };
                    //console.log("use index type:" + self.groupOrder[i].indexType);
                }
                
                // Sort the groups in order of benefit
                self.groupOrder.sort(function(a, b) {
                    return b.benefit - a.benefit;
                });
            }
        }

        self.retMessage.meshBinaryName = meshBinaryName;
        self.retMessage.finished = false;
    };
    
    // Start the mesh generation per mesh.bin.
    function Initialize3(nodesData, meshesData, attributesData, meshBinary) {
        var i, len;
        for (i = 0, len = self.billboards.length; i < len; i += 50) {
            PopulateNodes(self.billboards.slice(i, Math.min(i + 50, len)), meshesData, attributesData, meshBinary, true);
        }
        for (i = 0, len = self.nodes.length; i < len; i += 50) {
            PopulateNodes(self.nodes.slice(i, Math.min(i + 50, len)), meshesData, attributesData, meshBinary, false);
        }

        // Populate the rest nodes
        for (var i = 0, len = self.nodesGroups.length; i < len; ++i) {
            var nodesGroup = self.nodesGroups[self.groupOrder[i].index];
            var meshData = meshesData[nodesGroup[0].mesh];
            var attributeData = attributesData[meshData.attribute];
            PopulateNodesAfterMerge(nodesGroup, meshesData, meshData.attribute, 
                    attributeData, meshBinary, self.groupOrder[i].indexType);
        }

        // When this mesh binary is processed, send out an finished event back to main thread.
        self.retMessage.finished = true;
        self.retMessage.meshBinary = null;
        PostMessage();

        //console.log("return from " + self.retMessage.meshBinaryName);

        //console.log("Left memory budget: " + Math.round(self.memoryBudget / 1024 * 100) / 100);
    };

    self.onmessage = function(e) {

        //console.log("worker start one thread for " + e.data.meshBinaryName + " with mem: " + self.availableGpuMem);
        var data = e.data;
        //e.data = null;
        
        if (data.littleEndian) {
            Initialize1(data);
        } else if (data.meshBinaryName) {
            Initialize2(data.meshBinaryName);
        } else {
            Initialize3(self.nodesInfo, self.sceneData.meshes[self.retMessage.meshBinaryName], self.attributesData, data.meshBinary);
            delete data.meshBinary;
        }

        // GC
        data = null;
    };
})();
