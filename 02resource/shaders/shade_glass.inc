
vec3 shade(in vec3 diffuse, in vec3 specular, in float roughness, inout float transparent, in vec3 P, in vec3 N, in vec3 V)
{
    vec3 color = diffuse * m_uSunLight.intensity;
    
#if SPECULAR
    vec3 H = -normalize(m_uSunLight.direction + V);
    float nh = max(dot(N, H), 0.0);
    color += vec3(pow(nh, roughness));
#endif
    
    // Add a bluish to the glass.
    //color += (vec3(0.35, 0.63, 0.92) - color) * 0.1;

    return color;
}
