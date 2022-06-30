vec3 shade(in vec3 diffuse, in vec3 specular, in float roughness, inout float transparent, in vec3 P, in vec3 N, in vec3 V)
{
    return vec3(1.0 - transparent);
}


