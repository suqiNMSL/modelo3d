# Change Logs of modelo3d

Copyright Modelo XX - 2017. All Rights Reserved. 

# Ver 2.5.0 ()), 30/5/2018
## Features
- The .mx3 loader (big mesh, binary node data structure)
- Improve the canvas.destroy()

# Ver 2.4.3 ()), 24/4/2018
## Features
- Compress normals
## Bugs
- Bugs brought by normal compression

# Ver 2.4.2 ()), 19/2/2018
## Features
- VR in navigation
- API to set element color
- API to change fov
## Bugs
- WebGL2 uniform block
- line depth error

# Ver 2.4.1 (Aragak(i) Yu(i)), 8/2/2018
## Features
- refine bim structure
- allow multi-selection in bim mode
- allow rendering elements in different color
## Bugs
- fix loading bug
- fix the memory leaking problem while loading

# Ver 2.4.1 (No good found), 11/1/2018
## Features
- Instance drawing
## Bugs

# Ver 2.4.0 (Yur(a) Onn(o)), 6/12/2017
## Features
- Integrate BIM prototype (VISE) into modelo3d
- Optimize the loading for big models
## Bugs
- Fix the BIM culling bugs


# Ver 2.3.0 (May(u) Suzuk(i)), 3/11/2017
## Features
- Enable BIM culling and fix many integration bugs
- Improve vertex shader perf and refactor material
## Bugs
- Fix the crash on Chrome 62 which is caused by careless gl.enableVertexAttribArray() usage and VAO

# Ver 2.2.0 (Ao(i) Mari(a)), 22/09/2017
## Features
- Improved panorama editing
- Integration BIM foundation (disabled for now)
   * element picking
   * element rendering
   * element BIM information presentation
   * improved culling at element level

# Ver 2.1.0 (Miyak(o) Son(o)), 17/08/2017
## Features:
- The panorama navigation (load multiple panoramas)
- Improve the loading of transparent objects
- Fixed a few bugs, e.g., ortho-persp switch, etc
- Restructure the 08ui layer


# Ver 2.0.0 (Ayan(e) Kano(n)), 17/07/2017
## Features:
- WebVR integration (model and panorama)
- Improved loading about memory footprint; upgraded to .mx version to 2.0.0
- Introduce the alpha testing rendering
- Added m3d_renderpass.js for more clear rendering core structure.


# Ver 1.1.0 (Kirar(a) Asuk(a)), 16/06/2017
## Features:
- Snapping ruler
- Rotatable section box
- Render more types of panorama images
- Support skp layer visibility
## Bugs:
- Improved PR, much faster
- Correct WebGL2 bugs


# Ver 1.0.0 (A(i) sol(a)), 30/04/2017
## Features:
- Enhanced transparent rendering algorithm (MOD-4325)
- Transform between orthogonal and perspective view (MOD-5140)
- WebGL 2 uniform block support (MOD-4945)
- Tint textures with diffuse color (MOD-5166)
- Enhanced ruler (MOD-5038)
## Bugs:
- Fixed errors in VR, e.g, initial angle, culling and etc
- Fixed transparents missing in architect effect (MOD-5157)
- Fixed gray screen when switching tabs (MOD-5136)
## Infrastructure:
- Use rollup to manage JS modules 


