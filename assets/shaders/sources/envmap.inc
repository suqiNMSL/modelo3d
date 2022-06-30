const float PI = 3.1415926;

float Pow5(float x)
{
    return x*x * x*x * x;
}

float DotClamped(vec3 a, vec3 b)
{
    return max(0.0, dot(a, b));
}

float GGXTerm(float NdotH, float roughness)
{
    float a = roughness * roughness;
    float a2 = a * a;
    float d = NdotH * NdotH * (a2 - 1.0) + 1.0;
    return a2 / (PI * d * d);
}

float SmithGGXVisibilityTerm(float NdotL, float NdotV, float roughness)
{
    //float k = (roughness * roughness) * 0.5; // derived by B. Karis, http://graphicrants.blogspot.se/2013/08/specular-brdf-reference.html
    float k = (roughness + 1.0) * (roughness + 1.0) * 0.125; // derived by B. Karis, http://graphicrants.blogspot.se/2013/08/specular-brdf-reference.html
    float gL = NdotL * (1.0-k) + k;
    float gV = NdotV * (1.0-k) + k;
    return 1.0 / (gL * gV + 1e-4);
}

vec3 FresnelTerm(vec3 F0, float LDotH) 
{
    float t = Pow5(1.0 - LDotH);	// ala Schlick interpoliation
    return F0 + (vec3(1.0) - F0) * t;
}

// The specular component is same as PBS.
vec3 computeEnvmap(vec3 albedo, vec3 vertex, vec3 normal)
{
    const float METALLIC = 0.1;

    float roughness = max(1.0 / (0.1 + log2(uMaterial.shininess + 1.0)), 1.0);
    // Diffuse term.
    // http://www.cs.berkeley.edu/~ravir/papers/envmap/envmap.pdf
    float diffuseTerm = dot(vec4(normal, 1), uLight.envmapMatrix * vec4(normal, 1));
    // Correct gamma of the diffuse term.
    diffuseTerm = pow(diffuseTerm, 1.0 / 2.2);

    // Specular term
    float oneMinusRoughness = 1.0 - roughness;

    vec3 lightDir = -uLight.direction;
    vec3 viewDir = normalize(uCameraPosition - vertex);
    vec3 halfDir = normalize(viewDir + lightDir);

    float nl = DotClamped(lightDir, normal);
    float nh = DotClamped(normal, halfDir);
    float nv = DotClamped(normal, viewDir);
    float lv = DotClamped(lightDir, viewDir);
    float lh = DotClamped(lightDir, halfDir);

    float V = SmithGGXVisibilityTerm(nl, nv, roughness);
    float D = GGXTerm(nh, roughness);
    vec3  F = FresnelTerm((uMaterial.ks - vec3(0.04)) * METALLIC + vec3(0.04), lh);
    float specularTerm = max(0.0, (V * D * nl) * 0.25);// Torrance-Sparrow model, Fresnel is applied later (for optimization reasons)

    vec3 color = uLight.intensity * (albedo * diffuseTerm + F * specularTerm);
    
    return color;
}


