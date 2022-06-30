// 0-2: diffuse
// 3: transparent
// 4: roughness
// 5: metallic
struct MaterialStruct
{
    float values[6]; 
};
uniform MaterialStruct m_uMaterial;

uniform sampler2D m_uDiffuseTexture;

const vec3 dielectricColor = vec3(0.04); // The specular color of water.

void parseMaterial(out vec3 diffuse, out vec3 specular, out float transparent, out float roughness)
{
    vec4 texel = sampleTexture2D(m_uDiffuseTexture, m_vTexCoord.xy);

    transparent = texel.a * m_uMaterial.values[3];

#if ALPHATEST
    if (transparent < 0.15) 
    {
        discard;
    }
#endif

    // FIXME: roughness is not used now.
    //roughness = m_uMaterial.values[4];
    vec3 albedo = texel.rgb * vec3(m_uMaterial.values[0], m_uMaterial.values[1], m_uMaterial.values[2]);

#if GAMMA
    albedo = sRGBToLinear(albedo, 2.2); 
#endif

    // FIXME: metallic is 0 now.
    //diffuse = albedo * (1.0 - m_uMaterial.values[5]);
    //specular = mix(dielectricColor, albedo, m_uMaterial.values[5]);
    diffuse = albedo;
    specular = dielectricColor;

}

