

vec3 shade(in vec3 diffuse, in vec3 specular, in float roughness, inout float transparent, in vec3 P, in vec3 N, in vec3 V)
{
    // Main light (environmental diffuse lighting)
    float diffuseTerm = dot(vec4(N, 1), m_uSunLight.diffuseMatrix[0] * vec4(N, 1));
    
    // Second light (head light)
    float nv = max(dot(N, -V), 0.0);
    float vl = max(dot(V, m_uSunLight.direction), 0.0);
    diffuseTerm = diffuseTerm + (nv * (1.0 - vl)) * 0.8;
    
#if SPECULAR
    // Main light specular part
    float specularTerm = 0.0;
    vec3 H = -normalize(m_uSunLight.direction + V);
    float nh = max(dot(N, H), 0.0);
    specularTerm = pow(nh, 100.0); // FIXME: Currently we use constant roughness.
    
    vec3 color = m_uSunLight.intensity * vec3(0.5, 0.497, 0.49) * (diffuse * diffuseTerm + vec3(specularTerm)) + diffuse * 0.5;
#else 
    vec3 color = m_uSunLight.intensity * vec3(0.5, 0.497, 0.49) * (diffuse * diffuseTerm) + diffuse * 0.5;
#endif

    
#if SHADOW
    //color *= shadow(P, N, m_uSunLight.direction, m_uSunLight.shadowMatrix);
    color *= (shadow(P, N, m_uSunLight.direction, m_uSunLight.shadowMatrix));
#endif
    
    //color = color * 0.0001 + N * 0.5 + vec3(0.5);

    return color;
}


