#include <globalvars.inc>

#if ENCODE_DEPTH
vec4 encodeDepth(float depth)
{
    const vec4 bitShift = vec4(255.0*255.0*255.0, 255.0*255.0, 255.0, 1.0);
    const vec4 bitMask  = vec4(0.0, 1.0/255.0, 1.0/255.0, 1.0/255.0);
    vec4 res = fract(depth * bitShift); 
    res -= res.xxyz * bitMask; 
    return res;
}
#endif

#if WEBGL2
	out vec4 out_color;
#endif

#if ALPHATEST
    uniform sampler2D m_uDiffuseTexture;
#endif

void main()
{
#include <clipping.inc>

#if ALPHATEST
    vec4 texel = sampleTexture2D(m_uDiffuseTexture, m_vTexCoord.xy);
    if (texel.a < 0.15)
    {
        discard;
    }
#endif

#if DEPTH_ONLY

#if ENCODE_DEPTH
    
#if WEBGL2
    out_color = encodeDepth(gl_FragCoord.z); 
#else
    gl_FragColor = encodeDepth(gl_FragCoord.z); 
#endif

#else

#if WEBGL2
    out_color = gl_FragCoord.zzzz; 
#else
    gl_FragColor = gl_FragCoord.zzzz; 
#endif
#endif

#else

#if WORLDSPACE_NORMAL
    vec4 normal = vec4(m_vNormal, 0.0);
#else    
    vec4 normal = m_uPerFrame.viewMatrix * vec4(m_vNormal, 0.0);

#if DOUBLESIDED
    vec4 eyeDir = m_uPerFrame.viewMatrix * vec4(m_vVertex, 1.0);
    normal *= -sign(dot(normal.xyz, eyeDir.xyz));
#endif
#endif
#if ENCODE_NORMAL
    normal = (normal + vec4(1.0)) * 0.5;
#endif

#if ENCODE_DEPTH
#if WEBGL2
#if ENCODE_NORMAL
    out_color = vec4(normal.xyz, gl_FragCoord.z);
#else
    out_color = vec4(normalize(normal.xyz), gl_FragCoord.z);
#endif
#else
#if ENCODE_NORMAL
    gl_FragColor = vec4(normal.xyz, gl_FragCoord.z);
#else
    gl_FragColor = vec4(normalize(normal.xyz), gl_FragCoord.z);
#endif
#endif
#else
#if WEBGL2
#if ENCODE_NORMAL
    out_color = vec4(normal.xyz, m_vDepth);
#else
    out_color = vec4(normalize(normal.xyz), m_vDepth);
#endif
#else
#if ENCODE_NORMAL
    gl_FragColor = vec4(normal.xyz, m_vDepth);
#else
    gl_FragColor = vec4(normalize(normal.xyz), m_vDepth);
#endif
#endif
#endif
#endif
}
