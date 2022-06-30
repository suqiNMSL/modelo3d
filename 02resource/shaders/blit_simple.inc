vec4 shade(in sampler2D tex, in vec2 uv, in vec2 invResolution)
{
    return sampleTexture2D(tex, uv);
}
