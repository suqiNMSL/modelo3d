#if WEBGL2

in vec3 m_aPosition;
in vec2 m_aTexCoord;
out vec2 m_vTexCoord;

#else

attribute vec3 m_aPosition;
attribute vec2 m_aTexCoord;
varying vec2 m_vTexCoord;

#endif

void main() 
{ 
    gl_Position = vec4(m_aPosition.xy, 0.999999, 1.0); 
    m_vTexCoord = m_aTexCoord;
}

