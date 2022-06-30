====
// VS
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec4 aColor;

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

varying mediump vec4 vColor;

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
    vColor = aColor;
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
    vec2  shadowParameters;
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

#if CLIPPING || SHADOW || LIGHTING || DOUBLESIDED
varying mediump vec3 vVertex;
#endif

#if SHADOW || LIGHTING || DOUBLESIDED
varying mediump vec3 vNormal;
#endif

varying mediump vec4 vColor;

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

    vec3 color = uGlobal.lightIntensity * vec3(1.0, 0.995, 0.98) * (albedo * diffuseTerm + specularColor) * 0.5 + albedo * 0.5;
    
    return color;
}
#endif

#if SHADOW
float bilinear(vec2 frac2, vec4 v)
{
    vec2 cc = mix(v.xz, v.yw, frac2.x);
    return mix(cc.x, cc.y, frac2.y);
}

float pcf2x(float depth, vec2 coord)
{
    coord = coord * uGlobal.shadowParameters.x;
    // Find the nearest 2x2 quad
    vec2 p = floor(coord - vec2(0.5)) + vec2(0.5);
    vec2 f = coord - p;
    vec2 p0 = p / uGlobal.shadowParameters.x;
    float pixel = 1.0 / uGlobal.shadowParameters.x;
        
    vec4 c;
    c.x  = texture2D(uGlobalShadowTexture, p0).x;
    c.y  = texture2D(uGlobalShadowTexture, p0 + vec2(pixel, 0)).x;
    c.z  = texture2D(uGlobalShadowTexture, p0 + vec2(0,     pixel)).x;
    c.w  = texture2D(uGlobalShadowTexture, p0 + vec2(pixel, pixel)).x;
        
    if (uGlobal.shadowParameters.y > 0.5) {
        c = exp(300.0 * c + vec4(-300.0 * depth));
        return bilinear(f, c);
    } 
    
    float z = bilinear(f, c);
    return z * exp(-85.0 * depth);
}

float computeShadow(vec3 vertex, vec3 normal)
{
    vec4 v = uGlobal.shadowMatrix * vec4(vertex, 1);
    vec3 t = (v.xyz / v.w + vec3(1.0)) * 0.5;
    float fd = pcf2x(t.z, t.xy);
    
    // Turn step to a ramp to improve front/back face edge and shadow acne
    float backside = min(1.0, max(0.0, dot(normal, -uGlobal.lightDirection) * 10.0));
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

    vec3 albedo = vColor.rgb; /* * uMaterial.kd;*/

#if GAMMA
    albedo = pow(albedo, vec3(2.2));    // gamma correction
#endif

    float transparent = vColor.a * uMaterial.transparent;
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
    color = pow(color, vec3(1.0 / 2.2));    //gamma correction
#endif
    gl_FragColor = vec4(color, transparent);
}
====
