====
// VS
attribute vec3 aPosition;
attribute vec3 aNormal;


struct PerFrameStruct
{
    mat4 vpMatrix;
    vec4 cameraPosition;
};
uniform PerFrameStruct uPerFrame;

#if MODEL_TRANSFORM
struct PerNodeStruct
{
    mat4 modelMatrix;
};
uniform PerNodeStruct uPerNode;
#endif

varying mediump vec3 vVertex;

varying mediump vec3 vNormal;

varying mediump vec2 vTexCoord0;

void main()
{
    vec4 pos = vec4(aPosition, 1.0);
    vec3 normal;

#if MODEL_TRANSFORM
    pos = uPerNode.modelMatrix * pos;
    gl_Position = uPerFrame.vpMatrix * pos;
    normal = (uPerNode.modelMatrix * vec4(aNormal, 0)).xyz;
#else
    gl_Position = uPerFrame.vpMatrix * pos;
    normal = aNormal;
#endif

    vVertex = pos.xyz;
    vNormal = normal;
}

====
// FS
precision highp float;
precision highp sampler2D;

struct GlobalStruct
{
    float lightIntensity;
    vec3  lightDirection;
    mat4  lightEnvmapMatrix;
#if SHADOW
    mat4  shadowMatrix;
#endif
#if CLIPPING
    vec3  clipPoints[2];
#endif
};
uniform GlobalStruct uGlobal;
#if SHADOW
uniform sampler2D uGlobalShadowTexture;
#endif

uniform sampler2D uTexture0;
uniform vec3      uPlaneOrigins[4];
uniform vec4      uPlanes[4];
uniform vec3      uBoxSize; // width, depth, height      

struct PerFrameStruct
{
    mat4 vpMatrix;
    vec4 cameraPosition;
};
uniform PerFrameStruct uPerFrame;

struct MaterialStruct
{
    vec3 kd;          // diffuse color
    float transparent; // transparent 
};
uniform MaterialStruct uMaterial;
uniform sampler2D uMaterialDiffuseTexture;

varying mediump vec3 vVertex;
varying mediump vec3 vNormal;

vec3 computeLighting(vec3 albedo, vec3 vertex, vec3 normal, vec3 eyeDir)
{
    vec3 color = vec3(0, 0, 0);

    // The intensity of hatching is determined by the diffuse lighting
    float intensity = 1.0 - max(dot(normal, -uGlobal.lightDirection), 0.0); 
        
    float u;
    float v;

    // Project the vertex to the scene bbox in its normal direction. For 
    // three planes that intersect with this point, we compute the UVs from
    // the intersections and blend the texture color to the resultant lighting.
    if (abs(normal.z) > 0.99) 
    {
        u = (vertex.x - uPlaneOrigins[0].x) / uBoxSize.x;
        v = (vertex.y - uPlaneOrigins[0].y) / uBoxSize.y;
    }
    else
    {
        //           
        //   3 +------------+ 2        ^ +y
        //     |            |          |
        //     |            |          +---->  +x
        //     |            |            
        //     |            |           
        //     |            |
        //   0 +------------+ 1
        //            
        float invL = 1.0 / (2.0 * (uBoxSize.x + uBoxSize.y));
        float tmin = 10000.0;
        float nDotN;
        float t;
        
        nDotN = dot(normal, uPlanes[0].xyz);
        if (nDotN > 0.0) 
        {
            t = -(dot(uPlanes[0].xyz, vertex) + uPlanes[0].w) / nDotN;
            u = ((vertex + normal * t).x - uPlaneOrigins[0].x) * invL;
            tmin = t;
        }

        nDotN = dot(normal, uPlanes[1].xyz);
        if (nDotN > 0.0)
        {
            t = -(dot(uPlanes[1].xyz, vertex) + uPlanes[1].w) / nDotN;
            if (t < tmin)
            {
                u = ((vertex + normal * t).y - uPlaneOrigins[1].y + uBoxSize.x) * invL;
                tmin = t;
            }
        }

        nDotN = dot(normal, uPlanes[2].xyz);
        if (nDotN > 0.0)
        {
            t = -(dot(uPlanes[2].xyz, vertex) + uPlanes[2].w) / nDotN;
            if (t < tmin)
            {
                u = (-(vertex + normal * t).x + uPlaneOrigins[2].x + uBoxSize.x + uBoxSize.y) * invL;
                tmin = t;
            }
        }
        
        nDotN = dot(normal, uPlanes[3].xyz);
        if (nDotN > 0.0)
        {
            t = -(dot(uPlanes[3].xyz, vertex) + uPlanes[3].w) / nDotN;
            if (t < tmin)
            {
                u = (-(vertex + normal * t).y + uPlaneOrigins[3].y + 2.0 * uBoxSize.x + uBoxSize.y) * invL;
                tmin = t;
            }
        }
        
        v = vertex.z - uPlaneOrigins[0].z; // dot(V - O, vec3(0, 0, 1));
        v = v / uBoxSize.z;
    }

    float l = intensity * 4.99;
    float l0 = floor(l);
    float f = l - l0;
    float u0 = (u + l0) / 6.0;
    float u1 = (u + l0 + 1.0) / 6.0;

    vec3 c0 = texture2D(uTexture0, vec2(u0, v)).xyz;
    vec3 c1 = texture2D(uTexture0, vec2(u1, v)).xyz;
    
    vec3 c = texture2D(uTexture0, vec2(u, v)).xyz;

    return c;
    //return c1 * 0.0001 + vec3(u, 0, 0);
    //return c0 * (1.0 - l + l0) + c1 * (l - l0);
    
    //color += c * 0.00001 + vec3(u, 0.0, 0.0);
    //color = c * 0.0001 + vec3(uv, 0.0);

    //return color;
}

#if SHADOW
float computeShadow(vec3 vertex, vec3 normal)
{
    float backside = step(0.0, dot(normal, -uGlobal.lightDirection)); // Don't make it absolute dark

    vec4 v = uGlobal.shadowMatrix * vec4(vertex, 1);
    vec3 t = (v.xyz / v.w + vec3(1.0)) * 0.5;

    // e^c(d - t) where d <= t
    vec2 coord = t.xy;
    float fz = texture2D(uGlobalShadowTexture, coord).x;
    float fd = exp(fz - 300.0 * t.z);
    float lit = min(fd, 1.0) * backside;// times with nDotL to shadow the backside
    return max(lit, 0.8);
}
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

    vec3 normal = vNormal;
    normal = normalize(normal);

    vec3 eyeDir = normalize(vVertex * uPerFrame.cameraPosition.w - uPerFrame.cameraPosition.xyz);

#if DOUBLESIDED 
    //normal *= -sign(dot(normal, eyeDir));
#endif

    //vec4 texel = texture2D(uMaterialDiffuseTexture, vTexCoord0.xy);
    //vec3 albedo = texel.rgb; /* * uMaterial.kd;*/
    //float transparent =  texel.a * uMaterial.transparent;
    vec3 albedo = vec3(1, 0, 0);

    vec3 color = computeLighting(albedo, vVertex, normal, eyeDir);

#if SHADOW
    //color *= computeShadow(vVertex, normal);
#endif
    
    gl_FragColor = vec4(color, 1.0) ;
}
====
