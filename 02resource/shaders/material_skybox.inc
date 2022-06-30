#if EQUIRECTANGLE || WALLPAPER
uniform sampler2D m_uSkyTexture;
#else 
uniform samplerCube m_uSkyTexture;
#endif 

uniform float m_uTransparency;

void parseMaterial(out vec3 diffuse, out vec3 specular, out float transparent, out float roughness)
{
#if EQUIRECTANGLE || WALLPAPER 
    diffuse = sampleTexture2D(m_uSkyTexture, m_vTexCoord.xy).xyz; 
#endif
#if CUBEMAP
    diffuse = sampleTexture3D(m_uSkyTexture, normalize(m_vTexCoord.xyz)).xyz; 
#endif 

#if GAMMA
    diffuse = sRGBToLinear(diffuse, 2.2); 
#endif

    transparent = m_uTransparency;
}

