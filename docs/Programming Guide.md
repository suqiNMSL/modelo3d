# Programming Guide

1. Create a DIV with id
This is the canvas where 3D model displays. div id is used as div name when loading modelo API. 
```
<div id="model-api" ></div>
```

2. Import API
Link modelo3d.js to HTML page. The recommended practice is put on the right before </body>.
```
<script src="modelo3d.js"></script>
```

3. Create a modelo engine object with 512 pixel width and 512 pixel height.
```
const modeloApi = new modelo3d("model-api", 512, 512, false);
```

4. Load model.
```
modeloApi.loadModel(modelId);
```

5. Update model element data.
```
modeloApi.updateElementProperty(elementID, "status", 3)
    .then(function() { 
        console.log("ok"); 
    });
```

6. Destroy the modelo3d engine object.
```
modeloApi.destroy();
```

