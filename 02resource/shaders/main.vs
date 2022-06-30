#if WEBGL2
layout (location = 0) in vec3 m_aPosition;

#if COMPRESSION
layout (location = 1) in float m_aNormal0;
#else
layout (location = 1) in vec3 m_aNormal0;
#endif

layout (location = 2) in float m_aNormal1;
layout (location = 3) in float m_aNormal2;
layout (location = 4) in vec2 m_aTexCoord;
layout (location = 5) in vec4 m_aColor;
layout (location = 6) in float m_aMaterial;

#if INSTANCING
layout (location = 7) in mat4 m_aModelMatrix;
#endif

#else
attribute vec3 m_aPosition;

#if COMPRESSION
attribute float m_aNormal0;
#else
attribute vec3 m_aNormal0;
#endif

attribute float m_aNormal1;
attribute float m_aNormal2;
attribute vec2 m_aTexCoord;
attribute vec4 m_aColor;
attribute float m_aMaterial;

#if INSTANCING
attribute mat4 m_aModelMatrix;
#endif

#endif

