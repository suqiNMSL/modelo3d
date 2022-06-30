struct MaterialStruct
{
    float values[6]; 
};
uniform MaterialStruct m_uMaterial;

const vec3 dielectricColor = vec3(0.04); // The specular color of water.

void parseMaterial(out vec3 diffuse, out vec3 specular, out float transparent, out float roughness)
{
    vec3 albedo = m_vColor.rgb;

    transparent = m_vColor.a * m_uMaterial.values[3];
    // FIXME: roughness is not used now.
    //roughness = m_uMaterial.values[4];
    
#if GAMMA
    albedo = sRGBToLinear(albedo, 2.2); 
#endif

    // FIXME: metallic is 0 now.
    //diffuse = albedo * (1.0 - m_uMaterial.values[5]);
    //specular = mix(dielectricColor, albedo, m_uMaterial.values[5]);
    diffuse = albedo;
    specular = dielectricColor;
}

