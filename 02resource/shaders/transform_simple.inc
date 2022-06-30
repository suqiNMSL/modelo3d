
void transform(inout vec4 position, inout vec4 normal, inout vec3 uv, out vec4 worldPosition)
{
#if MODEL_TRANSFORM
#if INSTANCING
    position = m_aModelMatrix * position;
    normal = m_aModelMatrix * normal;
#else
    position = m_uPerNode.modelMatrix * position;
    normal = m_uPerNode.modelMatrix * normal;
#endif
#endif

    worldPosition = position;
    position = m_uPerFrame.vpMatrix * position;
}
