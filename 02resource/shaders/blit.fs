uniform sampler2D m_uBlitTexture;
#if MOBILE
uniform sampler2D m_uBlitDepthTexture;
#endif
uniform vec2      m_uInvResolution;

#if WEBGL2

in vec2 m_vTexCoord;
out vec4 out_color;

#else 

varying vec2 m_vTexCoord;

#endif

#include <uniform.inc>

#if MOBILE
vec4 shade(in sampler2D tex, in sampler2D tex2, in vec2 uv, in vec2 invResolution);
#else
vec4 shade(in sampler2D tex, in vec2 uv, in vec2 invResolution);
#endif
void main() 
{ 
#if WEBGL2

#if MOBILE
    out_color = shade(m_uBlitTexture, m_uBlitDepthTexture, m_vTexCoord, m_uInvResolution);
#else
    out_color = shade(m_uBlitTexture, m_vTexCoord, m_uInvResolution);
#endif

#else

#if MOBILE
    gl_FragColor = shade(m_uBlitTexture, m_uBlitDepthTexture, m_vTexCoord, m_uInvResolution);
#else
    gl_FragColor = shade(m_uBlitTexture, m_vTexCoord, m_uInvResolution);
#endif

#endif
}
