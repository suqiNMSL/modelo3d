//
// m3d_bim.js
// The aggregation of BIM information
//
//  
import MyMath  from "../../00utility/m3d_math.js";
import MaterialAdhoc from "../materials/m3d_material_adhoc.js"
import Room          from "./m3d_room.js";
import Family        from "./m3d_family.js";

export default (function() {
    "use strict";
    
    function Document(name) {
        this.name            = name;
        this.rooms           = {}; // The room information index by room name
        this.families        = {}; // The bim information of family
        this.levelElements   = {}; // The bim information of level and its elements
        this.units           = {};
    };
    
    Document.prototype._createFamilies = function(families) {
        for (var family in families) {
            var f = new Family(family);
            f.bim = families[family];
            this.families[family] = f;
        }
    };
    
    Document.prototype._createLevelsElements = function(levels, levelElements) {
        for (var level in levelElements) {
            this.levelElements[level] = {
                height : level === "Untitled" ? -1e5 : levels[level],
                elements : {}
            };
            var elements = levelElements[level];
            
            for (var element in elements) {
                var e = elements[element];
                if (e.F !== "") {
                    this.families[e.F].elements.push(e);
                }
                this.levelElements[level].elements[element] = e;
            }
        }
    };
    
    Document.prototype._getElementPath = function(elementName) {
        for (var level in this.levelElements) {
            var elements = this.levelElements[level].elements;
            var bim = elements[elementName];
            if (bim) {
                var path = {
                    fileName : this.name,
                    family : bim["F"] === "" ? "Undefined" : bim["F"],
                    level : level,
                    element : elementName
                };
                return path
            }
        }
    }
    
    // https://stackoverflow.com/questions/43044/algorithm-to-randomly-generate-an-aesthetically-pleasing-color-palette
    function randomColor() {
        var red   = Math.floor(Math.random() * 255);
        var green = Math.floor(Math.random() * 255);
        var blue  = Math.floor(Math.random() * 255);

        // Mix the pure white
        red = (red + 255) / 2;
        green = (green + 255) / 2;
        blue = (blue + 255) / 2;

        return [red / 255.0, green / 255.0, blue / 255.0];
    };

    Document.prototype._createRooms = function(rooms, shader, mesh) {
        for (var room in rooms) {
            var roomData =rooms[room];

            // Generate a unique color for each room.
            var material = new MaterialAdhoc("solid-cube-material");
            material.attachShader(shader);
            material.setDiffuse(randomColor());
            material.setTransparent(0.5);

            var r = new Room(room, roomData.number, 
                    roomData.position, roomData.bbox, 
                    roomData.area, mesh, shader, material);

            this.rooms[room] = r;
        }
    };
    
    Document.prototype._createUnits = function(units) {
        for (var unit in units) {
            this.units[unit] = units[unit];
        }
    };
    
    Document.prototype.destroy = function() {
        delete this.rooms;
        delete this.families;
        delete this.levelElements;
        delete this.units;
    };
 
    function BIM(scene) {
        this._scene = scene;   // the assocated scene
        this.elements = {}; // The bim information of each element indexed by element name
        
        this.documents = {};
    };

    BIM.prototype.destroy = function() {
        delete this.elements;
        for (var file in this.documents) {
            this.documents[file].destroy();
        }
        delete this.documents;
    };

    BIM.prototype.create = function(bimJson, shader, mesh) {
        for (var file in bimJson) {
            this.elements[file] = {};
            for (var level in bimJson[file].elements) {
                this.elements[file][level] = {};
                
                var elements = bimJson[file].elements[level];
                
                for (var element in elements) {
                    this.elements[file][level][element] = elements[element];
                }
            }
            var doc = new Document(file);
            doc._createFamilies(bimJson[file].families);
            doc._createLevelsElements(bimJson[file].levels, bimJson[file].elements);
            doc._createRooms(bimJson[file].rooms, shader, mesh);
            doc._createUnits(bimJson[file].units);
            this.documents[file] = doc;
        }
    };
    
    BIM.prototype.print = function(elementName) {
        var html = "";
        /*
        var bim = this.elements[elementName];
        html += "<b>Family</b>:  " + bim["Family"] + "<br>";
        html += "<b>Level</b>:  " + bim["Level"] + "<br>";

        // element properties
        var properties = JSON.parse(bim["Properties"]);
        for (var b in properties) {
            html += "<b>" + b + "</b>:  " + properties[b] + "<br>";
        }
        
        // family properties
        bim = this.families[bim["Family"]].bim || "";
        bim = JSON.parse(bim);
        for (var b in bim) {
            html += "<b>" + b + "</b>:  " + bim[b] + "<br>";
        }
        */
        return html;
    };

    BIM.prototype.getElementLeaves= function(elements) {
        var fileLevelElements = this.elements;
        var graphElements = this._scene.graph.leaves;
        var elementLeaves = [];
        for (var i = 0, len = elements.length; i < len; i++) {
            var elementName = elements[i];
            for (var file in fileLevelElements) {
                var levelElements = fileLevelElements[file];
                for (var level in levelElements) {
                    var element = levelElements[level][elementName];
                    if (element) {
                        for (var j = 0, len1 = element.N.length; j < len1; j++) { 
                            var drawable = graphElements[element.N[j]];
                            elementLeaves.push(drawable);
                        }
                    }
                }
            }
        }
        return elementLeaves;
    };
    
    BIM.prototype.getElementPaths= function(elements) {
        if (elements === null) {
            return null;
        }
        var paths = [];
        
        for (var elementName in elements) {
            for (var doc in this.documents) {
                var path = this.documents[doc]._getElementPath(elementName);
                if (path) {
                    paths.push(path);
                    break;
                }
            }
        }
        
        return paths;
    };
    return BIM;
})();
    

