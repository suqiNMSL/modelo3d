#if WEBGL2
in vec3 m_vVertex;
in vec3 m_vNormal;
in vec3 m_vTexCoord;
in vec4 m_vColor;
flat in vec4 m_vId;
in float m_vDepth;

#else 

varying vec3 m_vVertex;
varying vec3 m_vNormal;
varying vec3 m_vTexCoord;
varying vec4 m_vColor;
varying float m_vDepth;

#endif

#include <uniform.inc>




