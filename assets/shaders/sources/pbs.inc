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

// Main Physically Based BRDF
// Derived from Disney work and based on Torrance-Sparrow micro-facet model
//
//   BRDF = kD / pi + kS * (D * V * F) / 4
//   I = BRDF * NdotL
//
// * NDF 
// * GGX
// * Smith for Visiblity term
// * Schlick approximation for Fresnel
vec3 computePBS(vec3 albedo, vec3 vertex, vec3 normal)
{
    float oneMinusRoughness = 1.0 - uMaterial.roughness;

    vec3 lightDir = -uLight.direction;
    vec3 viewDir = normalize(uCameraPosition - vertex);
    vec3 halfDir = normalize(viewDir + lightDir);

    float nl = DotClamped(lightDir, normal);
    float nh = DotClamped(normal, halfDir);
    float nv = DotClamped(normal, viewDir);
    float lv = DotClamped(lightDir, viewDir);
    float lh = DotClamped(lightDir, halfDir);

    float V = SmithGGXVisibilityTerm(nl, nv, uMaterial.roughness);
    float D = GGXTerm(nh, uMaterial.roughness);
    vec3  F = FresnelTerm((uMaterial.specular - vec3(0.04)) * uMaterial.metallic + vec3(0.04), lh);
    float specularTerm = max(0.0, (V * D * nl) * 0.25 * PI);// Torrance-Sparrow model, Fresnel is applied later (for optimization reasons)

    float nlPow5 = Pow5(1.0-nl);
    float nvPow5 = Pow5(1.0-nv);
    float Fd90 = 0.5 + 2.0 * lh * lh * uMaterial.roughness;
    float disneyDiffuse = (1.0 + (Fd90 - 1.0) * nlPow5) * (1.0 + (Fd90 - 1.0) * nvPow5);
    // We don't divide diffuseTerm by PI as it will make diffuse a lot darker.
    float diffuseTerm = disneyDiffuse * nl * (1.0 - metallic); // Metal has no diffuse term.

    vec3 color = uLight.intesity * (albedo * diffuseTerm + F * specularTerm);
    
    // Light 1 is a head light so it is always align with the camera
    // and has the same direction as the camera's lookat.
    // Light 1's intensit is always 1/4 of light 0's. The scaling is 
    // multiplied with 1/pi to become around 0.07.
    float nDotL = DotClamped(viewDir, normal);
    color += nDotL * (uLight.intensity * 0.25) * albedo;

    return color;
}

