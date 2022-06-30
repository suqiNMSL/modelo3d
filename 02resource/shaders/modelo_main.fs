#include <globalvars.inc>
#include <shadow.inc>
#include <gamma.inc>
#include <lights.inc>

void parseMaterial(out vec3 diffuse, out vec3 specular, out float transparent, out float roughness);
vec3 shade(in vec3 diffuse, in vec3 specular, in float roughness, inout float transparent, in vec3 P, in vec3 N, in vec3 V);

#if WEBGL2
    out vec4 out_color;
#endif
void main()
{
#include <clipping.inc>

    vec3 N = normalize(m_vNormal);
    vec3 V = normalize(m_vVertex * m_uPerFrame.cameraPosition.w - m_uPerFrame.cameraPosition.xyz);
    vec3 P = m_vVertex;

#if DOUBLESIDED 
    N *= -sign(dot(N, V));
#endif

    vec3  diffuse; 
    float transparent;
    vec3  specular;
    float roughness;
    parseMaterial(diffuse, specular, transparent, roughness);

    vec3 color = shade(diffuse, specular, roughness, transparent, P, N, V);
#if GAMMA
    color = linearTosRGB(color, 2.2);
#endif

#if WEBGL2
    out_color = vec4(color, transparent);
#else
    gl_FragColor = vec4(color, transparent); 
#endif
    
}
