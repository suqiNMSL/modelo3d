
void transform(inout vec4 position, inout vec4 normal, inout vec3 uv, out vec4 worldPosition)
{
    position = m_uPerFrame.vpMatrix * position;
}
