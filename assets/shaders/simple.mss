====
// VS
attribute vec3 aPosition;

struct PerFrameStruct
{
    mat4 vpMatrix;
};
uniform PerFrameStruct uPerFrame;

#if MODEL_TRANSFORM
struct PerNodeStruct
{
    mat4 modelMatrix;
};
uniform PerNodeStruct uPerNode;
#endif

#if CLIPPING
varying mediump vec3 vVertex;
#endif

void main()
{
    vec4 pos = vec4(aPosition, 1.0);

#if MODEL_TRANSFORM
    pos = uPerNode.modelMatrix * pos;
    gl_Position = uPerFrame.vpMatrix * pos;
#else
    gl_Position = uPerFrame.vpMatrix * pos;
#endif

#if CLIPPING
    vVertex = pos.xyz;
#endif
}


====
// FS
precision highp float;
precision highp sampler2D;

struct GlobalStruct
{
    vec3  clipPoints[2];
};
#if CLIPPING
uniform GlobalStruct uGlobal;
#endif

struct MaterialStruct
{
    vec3 kd;          // diffuse color
    float transparent; // transparent 
};
uniform MaterialStruct uMaterial;

#if CLIPPING
varying mediump vec3 vVertex;
#endif

void main()
{
#if CLIPPING
    if (any(lessThan(vVertex.xyz, uGlobal.clipPoints[0].xyz)) || 
        any(greaterThan(vVertex.xyz, uGlobal.clipPoints[1].xyz)))
    {
        discard;
    }
#endif
    // no need for gamma correction here 
    gl_FragColor = vec4(uMaterial.kd, uMaterial.transparent);
}
====
