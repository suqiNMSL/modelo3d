
struct ShadowStruct 
{
    bool      enabled;
    mat4      matrix;
};

uniform sampler2D uShadowTexture;
uniform ShadowStruct uShadow;

float computeShadow(vec3 vertex, vec3 normal)
{
    float backside = step(0.0, dot(normal, -uLight.direction)); // Don't make it absolute dark

    vec4 v = uShadow.matrix * vec4(vertex, 1);
    vec3 t = (v.xyz / v.w + vec3(1.0)) * 0.5;

    // e^c(d - t) where d <= t
    vec2 coord = t.xy;
    float fz = texture2D(uShadowTexture, coord).x;
    float fd = exp(fz - 300.0 * t.z);
    float lit = min(fd, 1.0) * backside;// times with nDotL to shadow the backside
    return max(lit, 0.8);
}
