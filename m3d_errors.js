//
// m3d_errors.js
// The error code of Error. Referred by frontend
//
//  


export default (function() {
    "use strict";

    Error.ERROR_NO                              = 0;
    Error.ERROR_INCOMPATIBLE_MODEL_FILE_VERSION = 10001;
    Error.ERROR_INSUFFICIENT_RESOURCE           = 10002;
    Error.ERROR_ARRAY_BUFFER_WRONG_LENGTH       = 10003;


    Error.error = Error.ERROR_NO;

    Error.getErrorMessage = function(err) {
        switch (err) {
            case Error.ERROR_NO:
                return "no error";
            case Error.ERROR_INCOMPATIBLE_MODEL_FILE_VERSION:
                return "Incompatible model file version.";
            case Error.ERROR_INSUFFICIENT_RESOURCE:
                return "Insufficient resources";
            case Error.ERROR_ARRAY_BUFFER_WRONG_LENGTH:
                return "Invalid/courrpted model data";
        }
    };

    return Error;
})();
    
