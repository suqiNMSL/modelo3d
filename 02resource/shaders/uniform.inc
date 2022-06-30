#if WEBGL2
vec4 sampleTexture2D(sampler2D tex, vec2 coord)
{
    return texture(tex, coord);
}
#else
vec4 sampleTexture2D(sampler2D tex, vec2 coord)
{
    return texture2D(tex, coord);
}
#endif

#if WEBGL2
vec4 sampleTexture3D(samplerCube tex, vec3 coord)
{
    return texture(tex, coord);
}
#else
vec4 sampleTexture3D(samplerCube tex, vec3 coord)
{
    return textureCube(tex, coord);
}
#endif

