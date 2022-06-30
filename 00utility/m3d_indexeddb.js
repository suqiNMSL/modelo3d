//
// m3d_indexdb.js
// Read/save files into index DB 
//
//  

import Globals from "../m3d_globals.js";

export default (function() {
    "use strict";
        
    var indexedDB      = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    var IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction || {READ_WRITE: "readwrite"}; 
    var IDBKeyRange    = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

    function IndexedDB($q) {
        if (!indexedDB) {
            modelo3d.debug("The browser doesn't support IndexedDB.");
            return ;
        }

        // private:
        this._dbName          = null;
        this._request         = null;
        this._objectStoreName = "discard-restore-files";
        this._objectStore     = null;
        this._$q              = $q;

        // public:
        this.ready = false;
    };

    /**
     * @description initialize the IndexedDB.
     * @param {string} dbName - the name of database. Usually it is a combination of model ID plus the timestamp.
     * @param {object} frontendCallbacks - frontend callbacks that include promise library.
     * @return {boolean} - false if fails
     */
    IndexedDB.prototype.initialize = function(dbName) {
        if (this.ready) {
            return ;
        }

        this._$q     = Globals.frontendCallbacks.$q;
        this._dbName = dbName;
        this._db     = null;
        this.ready   = false;

        var that = this;
        return this._$q(function(resolve, reject) {
            var request = indexedDB.open(that._dbName, 1);

            request.onsuccess = function(event) {
                that._db = event.target.result;
                resolve(that._dbName);
                that.ready = true;
            };
            
            request.onerror = function(error) {
                reject("can't open DB '" + that._dbName + "'");
                that.ready = false;
            };

            request.onupgradeneeded = function(event) {
                that._db = this.result; // this refers to caller IDBOpenDBRequest
                if (that._db.objectStoreNames.contains(that._objectStoreName)) {
                    that._db.deleteObjectStore(that._objectStoreName);
                }
                    
                that._db.createObjectStore(that._objectStoreName, { keyPath: "name"});
                that.ready = true;
            };

            request.onblocked = function(error) {
                console.warn("block DB '" + that._dbName + "'");
            };
        });
    };

    /**
     * @description uninitialize 
     * @return {undefined} 
     */
    IndexedDB.prototype.uninitialize = function() {
    };
    
    /**
     * @description save a file into the database
     * @param {string} fileName - the name of file to save
     * @param {blob}  blob - the file content to save
     * @return {promise} - return when done, the callback is function(fileName)
     */
    IndexedDB.prototype.save = function(fileName, blob) {
        if (!this.ready) {
            return this._$q.reject(this._dbName + " is not ready");
        }

        var that = this;

        return new this._$q(function(resolve, reject) {
            var transaction = that._db.transaction(that._objectStoreName, "readwrite");
            var objectStore = transaction.objectStore(that._objectStoreName);
            var request = objectStore.put({
                "name": fileName,
                "data": blob,
                "date": new Date()
            });
            request.onsuccess = function(event) {
                resolve(fileName);
            };

            request.onerror = function(error) {
                reject(error);
            };
        });
    };
    
    /**
     * @description read a file from the database
     * @param {string} fileName - the name of file to load
     * @return {promise} - return when done, the callback is function(fileName, blob) 
     */
    IndexedDB.prototype.load = function(fileName) {
        if (!this.ready) {
            return this._$q.reject(this._dbName + " is not ready");
        }

        var that = this;

        return new this._$q(function(resolve, reject) {
            var transaction = that._db.transaction(that._objectStoreName, "readonly");
            var objectStore = transaction.objectStore(that._objectStoreName);
            var request = objectStore.get(fileName);
            request.onsuccess = function(event) {
                if (event.target && event.target.result) {
                    resolve(event.target.result.data);
                } else {
                    reject(fileName + " not found in db!");
                }
            };

            request.onerror = function(err) {
                reject(error);
            };
        });
    };
    
    
    return IndexedDB;
})();
