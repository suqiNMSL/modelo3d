
void transform(inout vec4 position, inout vec4 normal, inout vec3 uv, out vec4 worldPosition)
{
#if EQUIRECTANGLE
    uv = vec3(1.0 - uv.x, uv.y, 1.0);
#endif
#if WALLPAPER
    uv = vec3(uv.x, 1.0 - uv.y, 1.0);
#endif
#if CUBEMAP
#if FLIP
    uv = vec3(position.x, -position.z, -position.y);
#else
    uv = vec3(position.x, position.z, -position.y);
#endif
#endif

#if MODEL_TRANSFORM
    position = m_uPerNode.modelMatrix * position;
#endif
#if EQUIRECTANGLE || CUBEMAP
    position = m_uPerFrame.vpMatrix * vec4(position.xyz, 0.0);
#endif

    position = position.xyww; 
}


