====
// VS
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord0;


struct PerFrameStruct
{
    mat4 vpMatrix;
#if LIGHTING || DOUBLESIDED
    vec4 cameraPosition;
#endif
};
uniform PerFrameStruct uPerFrame;

#if MODEL_TRANSFORM
struct PerNodeStruct
{
    mat4 modelMatrix;
};
uniform PerNodeStruct uPerNode;
#endif

#if LIGHTING || SHADOW || CLIPPING || DOUBLESIDED
varying mediump vec3 vVertex;
#endif

#if LIGHTING || SHADOW || DOUBLESIDED 
varying mediump vec3 vNormal;
#endif

varying mediump vec2 vTexCoord0;

void main()
{
    vec4 pos = vec4(aPosition, 1.0);
    vec3 normal = aNormal;

#if MODEL_TRANSFORM
    pos = uPerNode.modelMatrix * pos;
    gl_Position = uPerFrame.vpMatrix * pos;
    normal = (uPerNode.modelMatrix * vec4(normal, 0)).xyz;
#else
    gl_Position = uPerFrame.vpMatrix * pos;
#endif

#if LIGHTING || SHADOW || CLIPPING || DOUBLESIDED
    vVertex = pos.xyz;
#endif

#if LIGHTING || SHADOW || DOUBLESIDED
    vNormal = normal;
#endif
    vTexCoord0 = aTexCoord0;
}

====
// FS
precision highp float;
precision highp sampler2D;

struct GlobalStruct
{
    float lightIntensity;
    float shinness;
#if LIGHTING
    vec3  lightDirection;
    mat4  lightEnvmapMatrix;
#endif
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

struct PerFrameStruct
{
    mat4 vpMatrix;
#if LIGHTING || DOUBLESIDED
    vec4 cameraPosition;
#endif
};
uniform PerFrameStruct uPerFrame;

struct MaterialStruct
{
    vec3 kd;          // diffuse color
    float transparent; // transparent 
};
uniform MaterialStruct uMaterial;
uniform sampler2D uMaterialDiffuseTexture;

#if CLIPPING || SHADOW || LIGHTING || DOUBLESIDED
varying mediump vec3 vVertex;
#endif

varying mediump vec2 vTexCoord0;

#if SHADOW || LIGHTING || DOUBLESIDED
varying mediump vec3 vNormal;
#endif

#if LIGHTING && SPECULAR
vec3 computeSpecular(vec3 normal, vec3 eyeDir){
    vec3 halfV  = -normalize(uGlobal.lightDirection + eyeDir);
    float nDotHV = max(dot(normal, halfV), 0.0);
    return vec3(pow(nDotHV, uGlobal.shinness));
}
#endif

#if LIGHTING
vec3 computeLighting(vec3 albedo, vec3 vertex, vec3 normal, vec3 eyeDir, vec3 specularColor)
{
    // Main light (environmental diffuse lighting)
    float diffuseTerm = dot(vec4(normal, 1), uGlobal.lightEnvmapMatrix * vec4(normal, 1));
    
    // second light (head light)
    float ndotv = max(dot(normal, -eyeDir), 0.0);
    float vdotl = max(dot(eyeDir, uGlobal.lightDirection), 0.0);
    diffuseTerm += (ndotv * (1.0 - vdotl)) * 0.1;
    
    // Correct gamma of the diffuse term.
    // diffuseTerm = pow(diffuseTerm, 1.0 / 2.2);

    vec3 color = uGlobal.lightIntensity * vec3(1.0, 0.995, 0.98) * (albedo * diffuseTerm + specularColor) * 0.5 + albedo * 0.5;
    
    return color;
}
#endif

#if SHADOW
float computeShadow(vec3 vertex, vec3 normal)
{
    float nDotL = dot(normal, -uGlobal.lightDirection);
    float backside = step(0.0, nDotL);
    
    vec4 v = uGlobal.shadowMatrix * vec4(vertex, 1);
    vec3 t = (v.xyz / v.w + vec3(1.0)) * 0.5;

    // e^c(d - t) where d <= t
    vec2 coord = t.xy;
    float fz = texture2D(uGlobalShadowTexture, coord).x;
    float fd = exp(85.0 * (fz - t.z));
    float lit = min(fd, 1.0) * backside;// times with nDotL to shadow the backside
    return lit * 0.2 + 0.8; // linearized version of max(lit, 0.8);
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

#if LIGHTING || SHADOW || DOUBLESIDED
    vec3 normal = vNormal;
    normal = normalize(normal);
#endif

#if LIGHTING || DOUBLESIDED
    vec3 eyeDir = normalize(vVertex * uPerFrame.cameraPosition.w - uPerFrame.cameraPosition.xyz);
#endif

#if DOUBLESIDED 
    normal *= -sign(dot(normal, eyeDir));
#endif

    vec4 texel = texture2D(uMaterialDiffuseTexture, vTexCoord0.xy);
    vec3 albedo = texel.rgb; /* * uMaterial.kd;*/
#if GAMMA
    albedo = pow(albedo, vec3(2.2));    // gamma correction
#endif
    float transparent =  texel.a * uMaterial.transparent;
    
    vec3 specularColor = vec3(0.0, 0.0, 0.0);
     
#if LIGHTING && SPECULAR
    specularColor = computeSpecular(normal, eyeDir);
#endif

#if LIGHTING
    vec3 color = computeLighting(albedo, vVertex, normal, eyeDir, specularColor);
#else
    vec3 color = albedo * uGlobal.lightIntensity;
#endif

#if GLASS
    // make glass window a little blueish
    color += (vec3(0.35, 0.63, 0.92) - color) * 0.1;
#endif

#if SHADOW
    color *= computeShadow(vVertex, normal);
#endif
#if GAMMA
    color = pow(color, vec3(1.0 / 2.2)); // gamma correction
#endif
    gl_FragColor = vec4(color, transparent);
}
====
