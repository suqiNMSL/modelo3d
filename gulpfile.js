/* 
 * Unit test of modelo3d
 */


var gulp = require('gulp');
var gulpPlugins = require("gulp-load-plugins")({ lazy: true });
var rename = require("gulp-rename");
var jasmineBrowser = require('gulp-jasmine-browser');
var fs = require("fs");
var path = require("path");
var print = require("gulp-print");
var sort = require("gulp-sort");
var watch = require("gulp-watch");

// Handles gulp-plumber error callbacks
const onError = {
    errorHandler: error => {
        gulpPlugins.util.beep();
        console.log(error.message);
    }
};

/**
 * Compile external JS
 */

/**
 * Compile modelo3d shaders
 */
gulp.task("modelo3dShaders", function () {
    var buffer = "";
    buffer += "var modelo3d = modelo3d || {};\n\n";
    buffer += "(function() {\n \"use strict\";\n\n";
    buffer += "modelo3d.ShaderChunks = {};\n\n";

    let shaders = fs.readdirSync("02resource/shaders");
    shaders.forEach(function(shader) {
        var extname = path.extname(shader);
        if (extname === ".inc" || extname === ".vs" || extname === ".fs") {
            // read the shader
            let filepath = path.join("02resource/shaders", shader);
            let contents = fs.readFileSync(filepath, "utf8");
            // remove comment and additional spaces
            contents = contents.replace(/(\/\/.*\r\n)/g, "");
            contents = contents.replace(/ +(?= )/g, "");

            buffer += "modelo3d.ShaderChunks[\"" + path.basename(shader) + "\"] =" +
                                            JSON.stringify(contents) + ";\n\n";
        }
    });
    buffer += "})();";
    
    fs.writeFileSync("02resource/m3d_shader_chunks.js", buffer);
});
//
///**
// * Modelo 3D web worker javascript
// */
gulp.task("modelo3dJsWorker", () => {
    return gulp.src("07loadsave/m3d_load_mesh.worker.js")
        .pipe(rename({ dirname: "" }))
        .pipe(gulp.dest("tests/"));
});
    
const modelo3dSource = [
    "*.js",
    "03scene/**/*.js",
    "**/**/*.js",

    // Not debug code
    "!node_modules/**/*.js",
    "!./tests/**/*.js",
    "!./**/*.worker.js",
    "!./**/*.debug.js",
    "!./*.debug.js",
    "!./gulpfile.js",
    "!./assets/js/*.js"
];

/**
 * Modelo 3D javascript
 */
gulp.task("modelo3dJs", () => {
    gulp.src(modelo3dSource)
        .pipe(sort())
        //.pipe(print())
        .pipe(gulpPlugins.plumber(onError))
        .pipe(gulpPlugins.concat("modelo3d.js"))
        .pipe(gulp.dest("tests/unittests"));
});

/**
 * External javascript libraries
 */
const externalSource = [
    "../../assets/external-libraries/ua-parser.js",
    "../../assets/external-libraries/loddash.custom.js"
];

gulp.task("externalJs", () => {
    gulp.src(externalSource)
        .pipe(gulpPlugins.plumber(onError))
        .pipe(gulpPlugins.concat("external-libraries.js"))
        .pipe(gulp.dest("tests/unitests"));
});

gulp.task("watch", () => {
    gulp.watch(modelo3dSource, ["modelo3dJs"]);
});

gulp.task('jasmine', ["externalJs", "modelo3dJs", "modelo3dShaders"], function() {
    return gulp.src(['tests/unittests/external-libraries.js', 'tests/unittests/modelo3d.js', 'tests/unittests/*.spec.js'])
                    .pipe(watch(["tests/unittests/modelo3d.js", "tests/unittests/*.spec.js"]))
                    .pipe(jasmineBrowser.specRunner())
                    .pipe(jasmineBrowser.server({port: 8888}));
});

gulp.task("default", [
    "externalJs",
    "modelo3dShaders",
    "modelo3dJsWorker",
    "modelo3dJs",
    "jasmine"
]);
