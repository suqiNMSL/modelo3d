uniform vec4 uColor;

vec4 shade(in sampler2D tex, in vec2 uv, in vec2 invResolution)
{
    vec4 scene   = sampleTexture2D(tex, uv);
    vec2 coord00 = uv + vec2(-invResolution.x * 2.0, -invResolution.y * 2.0);
    vec2 coord01 = uv + vec2(-invResolution.x * 2.0, -invResolution.y);
    vec2 coord02 = uv + vec2(-invResolution.x * 2.0, 0.0);
    vec2 coord03 = uv + vec2(-invResolution.x * 2.0, invResolution.y);
    vec2 coord04 = uv + vec2(-invResolution.x * 2.0, invResolution.y * 2.0);

    vec2 coord10 = uv + vec2(-invResolution.x, -invResolution.y * 2.0);
    vec2 coord11 = uv + vec2(-invResolution.x, -invResolution.y);
    vec2 coord12 = uv + vec2(-invResolution.x, 0.0);
    vec2 coord13 = uv + vec2(-invResolution.x, invResolution.y);
    vec2 coord14 = uv + vec2(-invResolution.x, invResolution.y * 2.0);

    vec2 coord20 = uv + vec2(0.0, -invResolution.y * 2.0);
    vec2 coord21 = uv + vec2(0.0, -invResolution.y);
    vec2 coord22 = uv + vec2(0.0, 0.0);
    vec2 coord23 = uv + vec2(0.0, invResolution.y);
    vec2 coord24 = uv + vec2(0.0, invResolution.y * 2.0);
    vec2 coord30 = uv + vec2(invResolution.x, -invResolution.y * 2.0);
    vec2 coord31 = uv + vec2(invResolution.x, -invResolution.y);
    vec2 coord32 = uv + vec2(invResolution.x, 0.0);
    vec2 coord33 = uv + vec2(invResolution.x, invResolution.y);
    vec2 coord34 = uv + vec2(invResolution.x, invResolution.y * 2.0);
    vec2 coord40 = uv + vec2(invResolution.x * 2.0, -invResolution.y * 2.0);
    vec2 coord41 = uv + vec2(invResolution.x * 2.0, -invResolution.y);
    vec2 coord42 = uv + vec2(invResolution.x * 2.0, 0.0);
    vec2 coord43 = uv + vec2(invResolution.x * 2.0, invResolution.y);
    vec2 coord44 = uv + vec2(invResolution.x * 2.0, invResolution.y * 2.0);

    vec4 contour = sampleTexture2D(tex, coord00) * 0.0090 +
                   sampleTexture2D(tex, coord01) * 0.0399 +
                   sampleTexture2D(tex, coord02) * 0.0657 +
                   sampleTexture2D(tex, coord03) * 0.0399 +
                   sampleTexture2D(tex, coord04) * 0.0090 +
                   sampleTexture2D(tex, coord10) * 0.0399 +
                   sampleTexture2D(tex, coord11) * 0.1788 +
                   sampleTexture2D(tex, coord12) * 0.2949 +
                   sampleTexture2D(tex, coord13) * 0.1788 +
                   sampleTexture2D(tex, coord14) * 0.0399 +
                   sampleTexture2D(tex, coord20) * 0.0657 +
                   sampleTexture2D(tex, coord21) * 0.2949 +
                   sampleTexture2D(tex, coord22) * 0.4863 +
                   sampleTexture2D(tex, coord23) * 0.2949 +
                   sampleTexture2D(tex, coord24) * 0.0657 +
                   sampleTexture2D(tex, coord30) * 0.0399 +
                   sampleTexture2D(tex, coord31) * 0.1788 +
                   sampleTexture2D(tex, coord32) * 0.2949 +
                   sampleTexture2D(tex, coord33) * 0.1788 +
                   sampleTexture2D(tex, coord34) * 0.0399 +
                   sampleTexture2D(tex, coord40) * 0.0090 +
                   sampleTexture2D(tex, coord41) * 0.0399 +
                   sampleTexture2D(tex, coord42) * 0.0657 +
                   sampleTexture2D(tex, coord43) * 0.0399 +
                   sampleTexture2D(tex, coord44) * 0.0090;
    float a = min(1.0, contour.a);
    return uColor * a + scene * (1.0 - a);
} 

