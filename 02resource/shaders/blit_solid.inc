uniform vec3 uColor;

vec4 shade(in sampler2D tex, in vec2 uv, in vec2 invResolution)
{
    return vec4(uColor, 1);
}
