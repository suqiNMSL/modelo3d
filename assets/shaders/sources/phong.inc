vec3 computePhong(vec3 albedo, vec3 vertex, vec3 normal)
{
    vec3 normal = normalize(vNormal);
    vec3 eyeDir = normalize(uCameraPosition - vVertex);
    
    // Light 0 is in world space
    nDotL = max(dot(normal, -uLight.direction), 0.0); // Don't make it absolute dark
    vec3 H = normalize(eyeDir - uLight.direction);
    float nDotHV = max(0.0, dot(normal, H)); 
    
    float specular = min(pow(nDotHV, uMaterial.shininess), 0.2); // Not too much specular
    
    // Light 1 is in eye space. Think of it as a head light but this light gets dimmer
    // when it aligns with the major light.
    vec3 light2Dir = normalize(uCameraPosition); 
    float nDotL2 = max(dot(normal, light2Dir), 0.0) * max(1.0 - light2Dir.z, 1.0); 
    
    // Light 1 is only 1/4 bright than light 0.
    // Limit diffuse under 1.0 so that it won't make things too bright and hurt
    // the chroma.
    float diffuse = min(nDotL + nDotL2 * 0.25, 1.0);
    
    color = (diffuse * albedo + specular * uMaterial.ks) * uLight.intensity;
}
