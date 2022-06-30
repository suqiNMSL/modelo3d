uniform float uThreshold; 
uniform float uContrast; 
uniform vec3 uNearAxis; 
uniform bool uIsPerspective; 

#if MOBILE
uniform vec2 uNearFar;

void getNormalPosition(in sampler2D tex, in sampler2D tex2, vec2 coord, out vec3 position, out vec3 normal)  
{
    vec2 uv = coord * 0.5 + vec2(0.5); 
    vec4 n = sampleTexture2D(tex, uv); 

    normal = normalize(n.xyz * 2.0 - 1.0); 
    vec4 p = sampleTexture2D(tex2, uv);
    float depth = p.x * 2.0 -1.0;
    
    if (uIsPerspective) 
    {
        position.z = -2.0 * uNearFar.x * uNearFar.y / (uNearFar.x + uNearFar.y - depth * (uNearFar.y - uNearFar.x));
        position.xy = uNearAxis.xy * coord.xy * position.z / uNearAxis.z; 
    } 
    else 
    {
        position.xy = uNearAxis.xy * coord.xy;
        position.z  = 0.5 * (depth * (uNearFar.y - uNearFar.x) + uNearFar.x + uNearFar.y);
    }
} 
#else
void getNormalPosition(in sampler2D tex, vec2 coord, out vec3 position, out vec3 normal)  
{
    vec2 uv = coord * 0.5 + vec2(0.5); 
    vec4 p = sampleTexture2D(tex, uv); 

    normal = normalize(p.xyz); 
    position.z = p.w; 
    if (uIsPerspective) 
    { 
        position.xy = uNearAxis.xy * coord.xy * p.w / uNearAxis.z; 
    } 
    else 
    {
        position.xy = uNearAxis.xy * coord.xy;
    }
}
#endif

float planeDistance(vec3 posA, vec3 norA, vec3 posB, vec3 norB) 
{ 
    vec3 posDelta = normalize(posB - posA); 
    float planeDist = max(abs(dot(posDelta, norA)), abs(dot(posDelta, norB))); 
    float normalDist = max(1.0 - dot(norA, norB), 0.0); 
    
    return max(planeDist, normalDist);
} 

#if MOBILE
vec4 shade(in sampler2D tex, in sampler2D tex2, in vec2 uv, in vec2 invResolution)
#else 
vec4 shade(in sampler2D tex, in vec2 uv, in vec2 invResolution)
#endif
{
    vec2 vFragCoord = uv * 2.0 - vec2(1.0);
    vec2 coordCenter    = vFragCoord.xy ; 
    vec2 coordUp        = vFragCoord - vec2(0.0,  2.0 * invResolution.y); 
    vec2 coordDown      = vFragCoord + vec2(0.0,  2.0 * invResolution.y); 
    vec2 coordLeft      = vFragCoord - vec2(2.0 * invResolution.x, 0.0); 
    vec2 coordRight     = vFragCoord + vec2(2.0 * invResolution.x, 0.0); 
    vec3 posUp, norUp; 
    vec3 posDown, norDown; 
    vec3 posLeft, norLeft; 
    vec3 posRight, norRight; 
#if MOBILE
    getNormalPosition(tex, tex2, coordUp, posUp, norUp); 
    getNormalPosition(tex, tex2, coordDown, posDown, norDown); 
    getNormalPosition(tex, tex2, coordLeft, posLeft, norLeft); 
    getNormalPosition(tex, tex2, coordRight, posRight, norRight); 
#else 
    getNormalPosition(tex, coordUp, posUp, norUp); 
    getNormalPosition(tex, coordDown, posDown, norDown); 
    getNormalPosition(tex, coordLeft, posLeft, norLeft); 
    getNormalPosition(tex, coordRight, posRight, norRight);
#endif
    vec2 planeDist = vec2(planeDistance(posLeft, norLeft, posRight, norRight), 
                          planeDistance(posUp, norUp, posDown, norDown)); 
    float edge = length(planeDist); 
    float sketch = step(edge, uThreshold); 
    sketch = clamp(uContrast * (1.0 - sketch), 0.0, 1.0); 
    
    return vec4(0, 0, 0, sketch); 
}