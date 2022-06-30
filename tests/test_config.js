//
// test_config.js
// which test gets enabled
//
//  


export default (function() {
    "use strict";

    var tests = {
       "ClipCulling":     false,
       "ZeroAreaCulling": false,
       "FrustumCulling":  false,
       "Panorama":        false,
       "ContextLost":     false,
       "BenchmarkCPU":    false,
       "Transparent":     false,
       "IndexedDB":       false,
       "TestUBO":         false,
    };

    // Sanity check. Only one test will be enabled.
    (function CheckTests() {
        var found = false;
        for (var test in tests) {
            if (tests[test] && !found) {
                found = true;
                continue;
            }

            if (found) {
                tests[test] = false;
            }
        }

        if (!found) {
            tests["default"] = true;
        }
    })();

    return tests;
})();


