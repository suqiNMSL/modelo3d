#if SHADOW

uniform sampler2D m_uShadowTexture;

#if MOBILE

float shadow(vec3 P, vec3 N, vec3 L, mat4 matrix)
{
    float backside = min(1.0, max(0.0, dot(N, -L) * 10.0));
    vec4 v = matrix * vec4(P, 1);
    vec3 t = (v.xyz / v.w + vec3(1.0)) * 0.5;

    // e^c(d - t) where d <= t
    vec2 coord = t.xy;
    float fz = sampleTexture2D(m_uShadowTexture, coord).x;
    float fd = exp(85.0 * (fz - t.z));
    float lit = min(fd, 1.0) * backside;// times with nDotL to shadow the backside
    return lit * 0.2 + 0.8; // linearized version of max(lit, 0.8);
}

#else

uniform float   m_uShadowFine;
const   float   SHADOW_MAP_SIZE = 2048.0;

float bilinear(vec2 frac2, vec4 v)
{
    vec2 cc = mix(v.xz, v.yw, frac2.x);
    return mix(cc.x, cc.y, frac2.y);
}

float pcf2x(float depth, vec2 coord, in float shadowMapSize, in sampler2D shadowTexture, in float isFineShadow)
{
    coord = coord * shadowMapSize;
    // Find the nearest 2x2 quad
    vec2 p = floor(coord - vec2(0.5)) + vec2(0.5);
    vec2 f = coord - p;
    vec2 p0 = p / shadowMapSize;
    float pixel = 1.0 / shadowMapSize;
        
    vec4 c;
    c.x  = sampleTexture2D(shadowTexture, p0).x;
    c.y  = sampleTexture2D(shadowTexture, p0 + vec2(pixel, 0)).x;
    c.z  = sampleTexture2D(shadowTexture, p0 + vec2(0,     pixel)).x;
    c.w  = sampleTexture2D(shadowTexture, p0 + vec2(pixel, pixel)).x;
        
    if (isFineShadow > 0.5) {
        c = exp(300.0 * c + vec4(-300.0 * depth));
        return bilinear(f, c);
    } 
    
    float z = bilinear(f, c);
    return z * exp(-85.0 * depth);
}

float shadow(vec3 P, vec3 N, vec3 L, mat4 matrix)
{
    vec4 v = matrix * vec4(P, 1);
    vec3 t = (v.xyz / v.w + vec3(1.0)) * 0.5;
    float fd = pcf2x(t.z, t.xy, SHADOW_MAP_SIZE, m_uShadowTexture, m_uShadowFine);
    
    // Turn step to a ramp to improve front/back face edge and shadow acne
    float backside = min(1.0, max(0.0, dot(N, -L) * 10.0));
    float lit = min(fd, 1.0) * backside;// times with nDotL to shadow the backside
    return lit * 0.2 + 0.8; // linearized version of max(lit, 0.8);
}

#endif

#endif
