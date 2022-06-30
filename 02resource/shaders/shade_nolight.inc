

vec3 shade(in vec3 diffuse, in vec3 specular, in float roughness, inout float transparent, in vec3 P, in vec3 N, in vec3 V)
{
    vec3 result = diffuse * m_uSunLight.intensity; 

#if SHADOW
    result *= shadow(P, N, m_uSunLight.direction, m_uSunLight.shadowMatrix);
#endif

    return result;
}


