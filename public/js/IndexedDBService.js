app.service('IndexedDBService', function($timeout) {
    this.db = null;

    window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB;
    if ('webkitIndexedDB' in window) {
        window.IDBTransaction = window.webkitIDBTransaction;
        window.IDBKeyRange = window.webkitIDBKeyRange;
    }
    window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction;

    this.onerror = function(e) {
        console.log('Oooooops, something went wrong in IndexedDB........');
        console.log(e);
    };

    this.open = function(fn) {
        var version = 3;

        if(window.indexedDB) {
            var request = window.indexedDB.open('LMNapp', version);
            // We can only create Object stores in a versionchange transaction.
            request.onupgradeneeded = function(e) {
                db = e.target.result;
                // A versionchange transaction is started automatically.
                e.target.transaction.onerror = this.onerror;
                if(db.objectStoreNames.contains('user')) {
                    db.deleteObjectStore("user");
                }
                db.createObjectStore('user', {keyPath: "email"});
//                if(! db.objectStoreNames.contains('images')) {
//                    var imageStore = db.createObjectStore('images', {keyPath: "imageFile"});     //createObjectStore is a synchronous method
//                }
//                if(! db.objectStoreNames.contains('course')) {
//                    var courseStore = db.createObjectStore('course', {keyPath: "timeStamp"});
//                    courseStore.createIndex("category", "category", { unique: false });
//                }
            };

            request.onsuccess = function(e) {
                db = e.target.result;
                fn();
            };
            request.onerror = this.onerror;
        }
        else{
            console.log('ERROR: Error occured while accessing indexedDB.')
        }
    };

    this.getAllItems = function(table, iterateCB, finalCB) {
        var trans = db.transaction(table, "readonly");
        var store = trans.objectStore(table);
        // Get everything in the tabs;
        var request = store.openCursor();
        request.onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                // Called for each matching record.
                iterateCB(cursor.value);
                cursor.continue();
            }
            else{
                finalCB();
            }
        };
        request.onerror = this.onerror;
    };

    this.deleteRecord = function(table, id, fn) {
        var trans = db.transaction(table, "readwrite");
        var store = trans.objectStore(table);
        var request = store.delete(id);

        request.onsuccess = function(e) {
            fn();
        };

        request.onerror = function(e) {
            console.log(e);
        };
    };
    //because there is a extra image store now, type parameter is necessary to identify the store wanted
    this.addRecord = function(table, record, fn) {
        var trans = db.transaction(table, "readwrite");
        var store = trans.objectStore(table);
        var request = store.put(record);

        request.onsuccess = function(e) {
            fn();
        };

        request.onerror = function(e) {
            console.log(e.value);
        };
    };

    this.getItem = function(table, keyPath, fn) {    //get one record according to the keyPath parameter
        var trans = db.transaction(table, "readonly");
        var store = trans.objectStore(table);
        var request = store.get(keyPath);

        request.onsuccess = function(e) {
            fn(e.target.result);
        };
        request.onerror = this.onerror;
    };
});

