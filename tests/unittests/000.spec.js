
/**
 * Initialize the canvas
 */
function InitCanvas(canvasName, canvasWidth, canvasHeight) {
    let canvasDOM = document.createElement('canvas');
    canvasDOM.id = canvasName;
    canvasDOM.setAttribute('width', canvasWidth);
    canvasDOM.setAttribute('clientWidth', canvasWidth);
    canvasDOM.setAttribute('height', canvasHeight);
    canvasDOM.setAttribute('clientHeight', canvasHeight);
    canvasDOM.innerHTML = 'To view this web page, upgrade your browser; it does not support the HTML5 canvas element.';
    document.body.appendChild(canvasDOM);

    let canvas2dDOM = document.createElement('canvas');
    canvas2dDOM.id = "canvas_model_comments";
    canvas2dDOM.setAttribute('width', canvasWidth);
    canvas2dDOM.setAttribute('clientWidth', canvasWidth);
    canvas2dDOM.setAttribute('height', canvasHeight);
    canvas2dDOM.setAttribute('clientHeight', canvasHeight);
    canvas2dDOM.innerHTML = 'To view this web page, upgrade your browser; it does not support the HTML5 canvas element.';
    document.body.appendChild(canvas2dDOM);

    var mockSharedData = {
        mode: null,
        DO_NOTHING           : 0, // Nothing to do.
        ADD_COMMENT          : 1, // Add comment.
        CHANGE_MATERIAL      : 2, // Change the material color of certain component.
        SECTION              : 3, // Section and culling box.
        LIVESCREEN_HOST      : 4, // The host shares camera.
        LIVESCREEN_CLIENT    : 5, // The client whose camera is steered by host.
        MEASURE              : 6, // The ruler of measurement
        SKETCH               : 7, // The sketch mode,
        ADD_NAVIGATION_POINT : 8, // The in-app navigation
        MAGNIFY              : 9, // The zoom with rectangle
        LIGHT                : 10  // The light gizmo
    };
    var canvas = new modelo3d.Canvas(canvasName, canvasWidth, canvasHeight, false, mockSharedData, null, null);
    canvas._scene.layers.push(new modelo3d.Layer("default", 0, [0, 0, 0], true));
    return canvas;
};

function ResetCanvas(canvas) {
    canvas._renderer.invalidate();
    canvas._sceneCamera.reset(true);
    canvas._sceneCamera.rotateTo(0, Math.PI * -0.5);
    for (var i = 0; i < 128; ++i) {
        canvas.update();
    }
};

function UpdateCanvas(canvas) {
    for (var i = 0; i < 128; ++i) {
        canvas.update();
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    canvas._renderer.invalidate();
};

/*
 * UI event dispatcher
 */
function DispatchEvent(el, evt) {
    if (el.dispatchEvent) {
        el.dispatchEvent(evt);
    } else if (el.fireEvent) {
        el.fireEvent('on' + type, evt);
    }
    return evt;
}

/*
 * Mouse simulator
 */
function DispatchMouseEvent(type, el, sx, sy, cx, cy, deltaY, button) {
    var evt;
    var e = {
        bubbles: true,
        cancelable: (type != "mousemove"),
        view: window,
        detail: 0,
        deltaY: deltaY,
        screenX: sx, 
        screenY: sy,
        clientX: sx, 
        clientY: sy,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        button: button,
        relatedTarget:el 
    };
    
    var evt = new MouseEvent(type, e);
    DispatchEvent(el, evt);
}

function MockMouseMove(el, x0, y0, x1, y1, button) {
    var xinc = x0 < x1? 1 : -1;
    var yinc = y0 < y1? 1 : -1;
        

    var x = x0;
    var y = y0;

    // Down
    var sx = x + el.offsetLeft;
    var sy = y + el.offsetTop;
    DispatchMouseEvent("mousedown", el, sx, sy, 0, 0, null, button);

    // Move
    while (x !== x1 && y !== y1) {
        sx = x + el.offsetLeft;
        sy = y + el.offsetTop;

        DispatchMouseEvent("mousemove", el, sx, sy, 0, 0, null, button);
        x += xinc;
        y += yinc;
    }

    while (x !== x1) {
        sx = x + el.offsetLeft;
        sy = y + el.offsetTop;
        DispatchMouseEvent("mousemove", el, sx, sy, 0, 0, null, button);
        x += xinc;
    }
    while (y !== y1) {
        sx = x + el.offsetLeft;
        sy = y + el.offsetTop;
        DispatchMouseEvent("mousemove", el, sx, sy, 0, 0, null, button);
        y += yinc;
    }
    
    // Up
    sx = x + el.offsetLeft;
    sy = y + el.offsetTop;
    DispatchMouseEvent("mouseup", el, sx, sy, 0,  0, null,button);
};

function MockMouseWheel(el, delta, times) {
    for (var i = 0; i < times; i++) {
        var evt = new WheelEvent("wheel", {deltaY: delta});
        DispatchEvent(el, evt);
    }
};

function MockMouseDoubleclick(el, x, y) {
    var sx = x + el.offsetLeft;
    var sy = y + el.offsetTop;
    DispatchMouseEvent("dblclick", el, sx, sy, 0, 0);
};

function MockMouseClick(el, x, y, button) {
    var sx = x + el.offsetLeft;
    var sy = y + el.offsetTop;

    DispatchMouseEvent("mousedown", el, sx, sy, 0, 0, null, button);
    DispatchMouseEvent("mouseup", el, sx, sy, 0, 0, null, button);
};