//
// test_indexeddb.js
// Test the read/write indexeddb(local cache)
//
//  


import Globals        from "../m3d_globals.js"
import Utils          from "../00utility/m3d_utils.js"
import IndexedDB      from "../00utility/m3d_indexeddb.js"
import MeshAttributes from "../02resource/m3d_mesh_attribute.js";
import DrawableLibrary    from "../03scene/drawables/m3d_drawable_library.js";
import LoadManual     from "../07loadsave/m3d_load_manual.js";
import Empty          from "./test_empty.js"

export default (function() {

    "use strict";

    function TestIndexedDB(canvas) {
        Empty.apply(this, arguments);
        
        this._indexedDB   = new IndexedDB();
        this._fileNames   = [];
        this._fileSizes   = []; // 4MB
        this._ready       = false;
        this._totalMBytes = 0;

        this._createScene();
    };

    TestIndexedDB.prototype = Object.create(Empty.prototype);
    TestIndexedDB.prototype.constructor = TestIndexedDB;

    TestIndexedDB.prototype._createScene = function() {
        var that = this;
                
        var fileSize = 1024 * 1024;
        for (var i = 0; i < 16; i++) {
            that._fileSizes.push(fileSize);
            that._totalMBytes += fileSize;
                    
            var fileName = "data" + i + ".bin";
            that._fileNames.push(fileName);
            that._fileNames.push(fileName);

            fileSize *= 2;
            if (fileSize > 32 * 1024 * 1024) {
                fileSize = 32 * 1024 * 1024;
            }
        }

        that._totalMBytes = Math.round(that._totalMBytes / (1024 * 1024) * 100) / 100;

        var timeLabel = "Save " + this._totalMBytes + "MB to cache";

        // Generate a large mesh and write to indexed DB
        this._indexedDB.initialize("modelo3dtest")
            .then(function() {
                // Save a few files into indexedDB.
                var promises = [];

                console.time(timeLabel);
                for (var i = 0; i < 32; i++) {
                    var fileData = new Uint8Array(that._fileSizes[i]);
                    promises.push(that._indexedDB.save(that._fileNames[i], fileData));
                }

                return Globals.frontendCallbacks.$q.all(promises);
            })
            .then(function() {
                console.timeEnd(timeLabel);
                that._ready = true;
                alert("saving done");
            })
            .catch(function(err) {
                console.log(err);
            });
    };

    TestIndexedDB.prototype.update = function() {
        this._canvas._lazyRendering = false;
        this._print();
    };

    TestIndexedDB.prototype._loadFromCache = function() {
        if (!this._ready) {
            return ;
        }

        var that = this;
        var promises = [];

        var timeLabel = "Load " + this._totalMBytes + "MB from cache";

        console.time(timeLabel);
        for (var i = 0, len = this._fileNames.length; i < len; i++) {
            promises.push(that._indexedDB.load(this._fileNames[i]));
        }
                
        Globals.frontendCallbacks.$q.all(promises)
            .then(function(dataArray) {
                console.timeEnd(timeLabel);

                for (var i = 0, len = that._fileSizes.length; i < len; i++) {
                    if (dataArray[i].byteLength !== that._fileSizes[i]) {
                        console.warn(that._fileName[i] + " data are corrupted");
                    }
                }
                
                alert("loading done");
            });
    };

    TestIndexedDB.prototype._keyboard = function(key) {
        var enabled = true;
        switch (key) {
            case 70: // 'f'
                this._loadFromCache();
                return true;
        }
        return false;
    };

    TestIndexedDB.prototype._print = function(culled) {
        this._text.innerHTML = 
            "<p>Press 'f' to the benchmark 'loading " + this._totalMBytes + "MB' from indexedDB' .</p>";
    };

    return TestIndexedDB;
})();

