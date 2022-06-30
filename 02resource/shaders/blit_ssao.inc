uniform vec3 uNearAxis;
uniform vec2 uTexTransform;
uniform vec2 SAMPLES[16];
uniform float uRadius;
uniform bool uIsPerspective;

vec4 getNormalAndDepth(sampler2D tex, vec2 fragCoord)
{
    vec2 texcoord = fragCoord * 0.5 + vec2(0.5);
    texcoord.x = texcoord.x * uTexTransform.x + uTexTransform.y;
    return sampleTexture2D(tex, texcoord);
}

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

vec4 shade(in sampler2D tex, in vec2 uv, in vec2 invResolution)
{
    float ao = 0.0;
    float radius = uRadius;
    float radius2 = radius * radius;
    const float bias = 0.0001;
    const float epsilon = 0.0001;
    vec2 vFragCoord = uv * 2.0 - vec2(1.0);
    vec4 p = getNormalAndDepth(tex, vFragCoord);
    vec3 eyePosition = getEyePosition(vFragCoord, p.w);
    vec3 normal = p.xyz;
    for (int i = 0; i < 16; i++)
    {
        vec2 d = SAMPLES[i] - vec2(0.5);
        vec2 sample = vec2(vFragCoord + d * radius / eyePosition.z);
        float depth = getNormalAndDepth(tex, sample).w;
        vec3 samplePosition = getEyePosition(sample, depth);
        vec3 v_i = samplePosition - eyePosition;
        float v_v = dot(v_i, v_i);
        float f = max(radius2 - v_v, 0.0) / radius2;
        ao += f * f * f * max(0.0,(dot(v_i, normal) +  eyePosition.z * bias)/(v_v + epsilon));
    }
    float occ = 1.0 - ao / (4.0 * 16.0);
    occ = clamp(pow(occ, 2.04), 0.0, 1.0);
    return vec4(occ);
}

