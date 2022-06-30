uniform sampler2D uTexture1;

vec4 shade(in sampler2D tex, in vec2 uv, in vec2 invResolution)
{
    vec4 accum = sampleTexture2D(tex, uv.xy); 
    float reveal = sampleTexture2D(uTexture1, uv).r;
    
    return vec4(accum.rgb / max(accum.a, 0.00001), max(0.0, 1.0 - reveal)); 
}


