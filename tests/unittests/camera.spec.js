//
// state.spec.js
// Unit test the state changes in modelo3d.
//
//  


// An example
//describe("CameraManipulator", () => {
    //describe("onMouseUp", () => {
    //    let mockMouse;

    //    beforeEach(() => {

    //        mockMouse = {
    //            event: {
    //                buttonDown: 0
    //            }
    //        };
    //    });


    //    it("should restoreFPV", () => {
    //        const FPVStub = Helpers.stubGlobal(modelo3d.CameraManipulator, "_restoreFPV");

    //        modelo3d.CameraManipulator.onMouseUp();

    //        expect(FPVStub).toHaveBeenCalled();
    //    });


    //    it("should set pressed state to false if button is down", () => {
    //        mockMouse.event.buttonDown = 1;
    //        modelo3d.CameraManipulator._pressed = false;

    //        modelo3d.CameraManipulator.onMouseUp();

    //        expect(modelo3d.CameraManipulator._pressed).toBe(true);
    //    });


    //    it("should not set pressed state to false if button is not down", () => {
    //        mockMouse.event.buttonDown = 0;
    //        modelo3d.CameraManipulator._pressed = false;

    //        modelo3d.CameraManipulator.onMouseUp();

    //        expect(modelo3d.CameraManipulator._pressed).toBe(false);
    //    });
    //});
//});


// describe state changes
describe("TestCamera", () => {
    let canvas;
    let loader;
    let canvasName = "TestCanvas";
    let canvasWidth = 512;
    let canvasHeight = 512;

    beforeAll(() => {
        canvas = InitCanvas(canvasName, canvasWidth, canvasHeight);
        canvas.setShadowEnabled(false);
        canvas.setAOEnabled(false);

        loader = new modelo3d.LoadManual(canvas._scene, canvas._sceneCamera, canvas._renderScene);

        var drawable;

        drawable = modelo3d.NodeLibraries.createSolidSphere(canvas._resourceManager);

        loader.addDrawable(drawable);
        // TODO: more drawables

        loader.load();
    });

    it("rotate", () => {
        ResetCanvas(canvas);
        var canvasDOM = document.getElementById(canvasName);
        var buf = new Uint8Array(4);
        MockMouseMove(canvasDOM, 0, 0, canvasWidth / 4, canvasHeight / 4, 0);
        UpdateCanvas(canvas);
        
        gl.readPixels(canvasWidth / 2, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        var arr = [buf[0], buf[1], buf[2], buf[3]]; 
        expect(arr).toEqual([255, 255, 255, 255]);
    });
    
    it("wheel", () => {
        ResetCanvas(canvas);
        var canvasDOM = document.getElementById(canvasName);
        var buf = new Uint8Array(4);

        MockMouseWheel(canvasDOM, -1, 250);
        UpdateCanvas(canvas);
            
        gl.readPixels(canvasWidth / 2, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        var arr = [buf[0], buf[1], buf[2], buf[3]]; 
        expect(arr).toEqual([255, 0, 0, 255]);
    });
    
    it("doubleclick", () => {
        ResetCanvas(canvas);
        var canvasDOM = document.getElementById(canvasName);
        var buf = new Uint8Array(4);

        MockMouseDoubleclick(canvasDOM, canvasWidth / 2, canvasHeight / 2);
        UpdateCanvas(canvas);
            
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        var arr = [buf[0], buf[1], buf[2], buf[3]]; 
        expect(arr).toEqual([255, 0, 0, 255]);
    });

    it("pan", () => {
        ResetCanvas(canvas);
        var canvasDOM = document.getElementById(canvasName);
        var buf = new Uint8Array(4);
        MockMouseMove(canvasDOM, 0, 0, canvasWidth / 4, canvasHeight / 4, 2);
        UpdateCanvas(canvas);
        
        gl.readPixels(canvasWidth / 2, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        var arr = [buf[0], buf[1], buf[2], buf[3]]; 
        expect(arr).toEqual([255, 255, 255, 255]);
    });

    it("magnify", () => {
    });
});
