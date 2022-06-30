uniform sampler2D uTexture0;
uniform float uFrameCount;

float random( vec2 p )
{
   return fract(sin(dot(p.xy, vec2(12.9898, 78.233))) * (43758.5453 + uFrameCount * 1231.3));
}
            
vec4 shade(in sampler2D tex, in vec2 uv, in vec2 invResolution)
{
    vec4 accum  = sampleTexture2D(tex, uv);
    vec4 sampleColor = sampleTexture2D(uTexture0, uv); 
    vec4 result = (sampleColor + (uFrameCount - 1.0) * accum) / uFrameCount;
    float dither = 1.0/255.0 * (random(uv - 0.5) - 0.5);
    result += vec4(dither,dither, dither, 0.0);

    return result;
}

