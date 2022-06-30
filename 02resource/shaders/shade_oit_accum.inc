float computeOITWeight(float z) 
{
    return max(0.0, 1.0 - z);
}

vec3 shade(in vec3 diffuse, in vec3 specular, in float roughness, inout float transparent, in vec3 P, in vec3 N, in vec3 V)
{
    // TODO: the following shading is from adhoc shading

    // Main light (environmental diffuse lighting)
    float diffuseTerm = dot(vec4(N, 1), m_uSunLight.diffuseMatrix[0] * vec4(N, 1));
    
    // Main light specular part
    float specularTerm = 0.0;

#if SPECULAR
    vec3 H = -normalize(m_uSunLight.direction + V);
    float nh = max(dot(N, H), 0.0);
    specularTerm = pow(nh, roughness);
#endif

    // Second light (head light)
    float nv = max(dot(N, -V), 0.0);
    float vl = max(dot(V, m_uSunLight.direction), 0.0);
    diffuseTerm = diffuseTerm + (nv * (1.0 - vl)) * 0.2;

    vec3 color = m_uSunLight.intensity * vec3(1.0, 0.995, 0.98) * (diffuse * diffuseTerm + vec3(specularTerm)) * 0.5 + diffuse * 0.5;

    //float w = computeOITWeight(gl_FragCoord.z);

    color *= transparent;

    //transparent *= w;

    return color;
}


