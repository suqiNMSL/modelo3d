vec4 shade(in sampler2D tex, in vec2 uv, in vec2 invResolution)
{ 
    vec2 coordCenter    = uv; 
    vec2 coordUp        = uv + vec2(0.0, -invResolution.y); 
    vec2 coordDown      = uv + vec2(0.0, invResolution.y); 
    vec2 coordLeft      = uv + vec2(-invResolution.x, 0.0); 
    vec2 coordRight     = uv + vec2(invResolution.x, 0.0); 
    vec2 coordUpLeft    = uv + vec2(-invResolution.x, -invResolution.y); 
    vec2 coordDownLeft  = uv + vec2(-invResolution.x, invResolution.y); 
    vec2 coordUpRight   = uv + vec2(-invResolution.x, invResolution.y); 
    vec2 coordDownRight = uv + vec2(invResolution.x, invResolution.y); 
    float contour = 0.0; 

    float d = sampleTexture2D(tex, coordCenter).r;
    if(d < 1.0 &&
       (sampleTexture2D(tex, coordUp).r        > 0.5 || 
        sampleTexture2D(tex, coordDown).r      > 0.5 || 
        sampleTexture2D(tex, coordLeft).r      > 0.5 || 
        sampleTexture2D(tex, coordRight).r     > 0.5 || 
        sampleTexture2D(tex, coordUpLeft).r    > 0.5 || 
        sampleTexture2D(tex, coordDownLeft).r  > 0.5 || 
        sampleTexture2D(tex, coordUpRight).r   > 0.5 || 
        sampleTexture2D(tex, coordDownRight).r > 0.5)) 
    {
        contour = 1.0; 
    }
    return vec4(contour); 
} 
