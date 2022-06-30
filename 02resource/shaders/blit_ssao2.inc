uniform vec3 uNearAxis; 
uniform vec2 uTexTransform; 
uniform float uRadius; 
uniform bool uIsPerspective; 
uniform float uFrameCount; 
uniform vec4 uTexSizeAndInv;     
uniform vec2 SAMPLES[8];                        

#if MOBILE
uniform vec2 uNearFar;

vec4 getNormalAndDepth(in sampler2D tex, in sampler2D tex2, vec2 fragCoord)  
{
    vec2 texcoord = fragCoord * 0.5 + vec2(0.5);
    texcoord.x = texcoord.x * uTexTransform.x + uTexTransform.y;
    
    vec4 ret = sampleTexture2D(tex, texcoord); 
    ret.xyz = normalize(ret.xyz * 2.0 - 1.0); 
    
    vec4 p = sampleTexture2D(tex2, texcoord);
    float depth = p.x * 2.0 -1.0;
    if (uIsPerspective) 
    {
        ret.w = -2.0 * uNearFar.x * uNearFar.y / (uNearFar.x + uNearFar.y - depth * (uNearFar.y - uNearFar.x));
    } 
    else 
    {
        ret.w = 0.5 * (depth * (uNearFar.y - uNearFar.x) + uNearFar.x + uNearFar.y);
    }
    return ret;
} 
#else
vec4 getNormalAndDepth(in sampler2D tex, vec2 fragCoord) 
{
    vec2 texcoord = fragCoord * 0.5 + vec2(0.5);
    texcoord.x = texcoord.x * uTexTransform.x + uTexTransform.y;
    
    return sampleTexture2D(tex, texcoord); 
} 
#endif


vec3 getEyePosition(vec2 fragCoord, float depth) 
{
    vec3 eyeDirection = uNearAxis * vec3(fragCoord, 1.0); 
    vec3 eyePosition; 
    eyePosition.z = depth; 
    if (uIsPerspective) 
    { 
        eyePosition.xy = eyeDirection.xy * depth / eyeDirection.z; 
    } 
    else 
    {
        eyePosition.xy = eyeDirection.xy; 
    } 
    return eyePosition;                            
} 

vec3 getScreenPosition(vec3 eyePos) 
{ 
    if (uIsPerspective)
    {
        return vec3(eyePos.xy * uNearAxis.z / uNearAxis.xy / eyePos.z, eyePos.z); 
    }
    else
    {
        return vec3(eyePos.xy / uNearAxis.xy, eyePos.z); 
    }
} 

#if MOBILE
vec3 getOffsetEyePosition(in sampler2D tex, in sampler2D tex2, vec3 viewPos, vec2 offset) 
#else
vec3 getOffsetEyePosition(in sampler2D tex, vec3 viewPos, vec2 offset) 
#endif
{ 
    vec2 scnPos = getScreenPosition(viewPos).xy; 
    vec2 scnOffset = getScreenPosition(vec3(offset, viewPos.z)).xy; 
    vec2 pixOffset = scnOffset * uTexSizeAndInv.xy * 0.5;
    // snap to pixel grid for large offsets, to avoid fake occlusion 
    //    caused by bilinear depth fetch (bilinear is still needed for 
    //    ensuring depth accuracy at small offset)
    if(length(pixOffset) > 2.0) 
    {
        scnOffset = (floor(pixOffset + 0.5) ) * uTexSizeAndInv.zw * 2.0;
    }
#if MOBILE
float sampDepth = getNormalAndDepth(tex, tex2, scnPos + scnOffset).w; 
#else
float sampDepth = getNormalAndDepth(tex, scnPos + scnOffset).w; 
#endif
    return getEyePosition(scnPos + scnOffset, sampDepth); 
} 

vec3 computeMultiBounceColor(float x, vec3 albedo) 
{ 
    vec3 a =  2.0404 * albedo - 0.3324; 
    vec3 b = -4.7951 * albedo + 0.6417; 
    vec3 c =  2.7552 * albedo + 0.6903; 
    return max( vec3(x,x,x), ( ( x * a + b ) * x + c ) * x ); 
} 

float random(vec2 p) 
{ 
    return fract(sin(dot(p.xy, vec2(12.9898, 78.233))) * (43758.5453 + (uFrameCount) * 1231.3));
} 

#if MOBILE
vec4 shade(in sampler2D tex, in sampler2D tex2, in vec2 uv, in vec2 invResolution)
#else 
vec4 shade(in sampler2D tex, in vec2 uv, in vec2 invResolution)
#endif
{ 
    // constants
    float maxScreenRadius = 0.4;  // maximum sample radius in screen percentage
    float falloffDist = 0.0;  // distance fall off starting point [0, 1], small is earlier falloff
    float randScale = 0.4;    // scale of per-pixel random jitter in searching radius
    const float aoStrength = 1.1;   // strength of AO, default is 1.0
    const float PI = 3.1415926535898; 
    const float HalfPI = 1.570796326794895;                         

    // center pixel data
    vec2 vFragCoord = uv * 2.0 - vec2(1.0);
#if MOBILE
    vec4 p = getNormalAndDepth(tex, tex2, vFragCoord); 
#else
    vec4 p = getNormalAndDepth(tex, vFragCoord); 
#endif
    vec3 eyePosition = getEyePosition(vFragCoord, p.w); 
    vec3 normal = p.xyz;  
    float xx = p.w;
    //this fix is especially for line mesh since they don't have normal info
    //use 0.95 instead of 1.0 to prevent float precision problem
    if (length(normal) < 0.95) {
        return vec4(1.0);
    }

    vec2 projScrRadius = getEyePosition(vec2(1.0, 1.0) * maxScreenRadius, p.w).xy; 
    vec3 viewDir = vec3(0.0, 0.0, 1.0);

    float radiusScale = 1.0 + randScale * (random(vFragCoord * 0.5 - 0.5) - 0.5);                            
    float radius = radiusScale * min(uRadius, min(projScrRadius.x, projScrRadius.y));  

    if (uIsPerspective) {
        viewDir = normalize(-uNearAxis * vec3(vFragCoord, 1.0)); 
    } 

    vec3 sliceTan = normalize(vec3(SAMPLES[7], 0.0));
    vec3 sliceNorm = normalize(cross(viewDir, sliceTan)); 
    vec3 normalSliceProj = normal - dot(normal, sliceNorm) * sliceNorm; 
    vec3 normalSliceDir = normalize(normalSliceProj); 
    float thetaN = acos(dot(normalSliceDir, viewDir)) * sign(dot(cross(sliceNorm, viewDir), normalSliceDir)); 

    // clockwise horizon marching
    float horizon1 = thetaN + HalfPI;
    for (int i = 0; i < 8; ++i) 
    {  
        vec2 p = SAMPLES[i];
#if MOBILE
vec3 offsetPosition = getOffsetEyePosition(tex, tex2, eyePosition, p * radius); 
#else
vec3 offsetPosition = getOffsetEyePosition(tex, eyePosition, p * radius); 
#endif
        vec3 v_i = offsetPosition - eyePosition;     
        float h1 =  min(acos(dot(normalize(v_i), viewDir)), HalfPI + thetaN); 
        float weight = 1.0 - clamp((length(v_i) / radius - falloffDist), 0.0, 1.0); 
        horizon1 = mix(horizon1, min(horizon1, h1), weight); 
    } 

    // counter clockwise horizon marching
    float horizon2 = -thetaN + HalfPI;
    for(int i = 0; i < 8; ++i) 
    { 
        vec2 p = -SAMPLES[i]; 
#if MOBILE
vec3 offsetPosition = getOffsetEyePosition(tex, tex2, eyePosition, p * radius); 
#else
vec3 offsetPosition = getOffsetEyePosition(tex, eyePosition, p * radius); 
#endif
        vec3 v_i = offsetPosition - eyePosition; 
        float h2 = min(acos(dot(normalize(v_i), viewDir)), HalfPI - thetaN); 
        float weight = 1.0 - clamp((length(v_i) / radius - falloffDist), 0.0, 1.0); 
        horizon2 = mix(horizon2, min(horizon2, h2), weight); 
    } 

    // Use cosine weighted integral
    //   "    float occ = length(normalSliceProj) * \n
    //   "          (-cos(2.0*horizon1 - thetaN) + cos(thetaN) + 2.0 * horizon1 * sin(thetaN) \n
    //   "           -cos(-2.0*horizon2 - thetaN) + cos(thetaN) - 2.0 * horizon2 * sin(thetaN)) * 0.25; \n

    // Use uniform weighted integral (preferred, since distance falloff adds additional weighting)
    float occ = 1.0 - (cos(horizon1) + cos(horizon2)) * 0.5 * aoStrength; 
    // vec3 ao = vec3(occ); 
    vec3 ao = computeMultiBounceColor(occ, vec3(1.0,1.0,1.0));

    return vec4(ao, 1.0);                            
}
