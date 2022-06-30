#if WEBGL2
out vec3 m_vVertex;
out vec3 m_vNormal;
out vec3 m_vTexCoord;
out vec4 m_vColor;
flat out vec4 m_vId;
out float m_vDepth;
#else
varying vec3 m_vVertex;
varying vec3 m_vNormal;
varying vec3 m_vTexCoord;
varying vec4 m_vColor;
varying float m_vDepth;
#endif

void transform(inout vec4 position, inout vec4 normal, inout vec3 uv, out vec4 worldPosition);

void main()
{
    vec4 position = vec4(m_aPosition, 1.0);
#if COMPRESSION
vec4 normal = vec4(m_aNormal0, m_aNormal1, m_aNormal2, 0.0);
#else
vec4 normal = vec4(m_aNormal0, 0.0);
#endif
    vec3 uv = vec3(m_aTexCoord, 1.0);

    vec4 worldPosition;

    transform(position, normal, uv, worldPosition);

#if VISIBLITY
    position.z -= step(0.995, m_aMaterial) * position.w * 10000.0;
#endif

#include <varying.inc>

    gl_Position = position;
}

