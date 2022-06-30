
void transform(inout vec4 position, inout vec4 normal, inout vec3 uv, out vec4 worldPosition)
{
#if MODEL_TRANSFORM
#if INSTANCING
    position = m_aModelMatrix * position;
#else
    position = m_uPerNode.modelMatrix * position;
#endif
#endif

    worldPosition = position;
    position = m_uPerFrame.vpMatrix * position;
}
