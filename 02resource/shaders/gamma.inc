float linearTosRGB1(const in float c, const in float gamma)
{
    float v = 0.0;
    if (c < 0.0031308) 
    {
        if ( c > 0.0) 
        {
            v = c * 12.92;
        }
    } 
    else 
    {
        v = 1.055 * pow(c, 1.0 / gamma) - 0.055;
    }
    return v;
}

vec3 linearTosRGB(const in vec3 rgb, const in float gamma)
{
    vec3 ret;
    ret.r = linearTosRGB1(rgb.r, gamma);
    ret.g = linearTosRGB1(rgb.g, gamma);
    ret.b = linearTosRGB1(rgb.b, gamma);
    return ret;
}

float sRGBToLinear1(const in float c, const in float gamma)
{
    float v = 0.0;
    if (c < 0.04045)
    {
        if (c >= 0.0)
        {
            v = c * ( 1.0 / 12.92);
        }
    } 
    else 
    {
        v = pow((c + 0.055) * (1.0 / 1.055), gamma);
    }
    return v;
}

vec3 sRGBToLinear(const in vec3 srgb, const in float gamma)
{
    vec3 ret;
    ret.r = sRGBToLinear1(srgb.r, gamma);
    ret.g = sRGBToLinear1(srgb.g, gamma);
    ret.b = sRGBToLinear1(srgb.b, gamma);

    return ret;
}
