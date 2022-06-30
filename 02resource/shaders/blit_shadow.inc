const float g0 = 0.0751; const float g1 = 0.1238; const float g2 = 0.0751; 
const float g3 = 0.1238; const float g4 = 0.2042; const float g5 = 0.1238; 
const float g6 = 0.0751; const float g7 = 0.1238; const float g8 = 0.0751; 
const float C = 85.0;

vec4 shade(in sampler2D tex, in vec2 uv, in vec2 invResolution)
{ 
    float tmp = 0.0;
    vec2 coord; 

    float pixelSize = invResolution.x;

    coord = uv + vec2(-pixelSize, -pixelSize); 

    tmp += exp(C * sampleTexture2D(tex, coord).x) * g0;

    coord = uv + vec2(0.0,        -pixelSize); 
    
    tmp += exp(C * sampleTexture2D(tex, coord).x) * g1;
    
    coord = uv + vec2(pixelSize,  -pixelSize); 

    tmp += exp(C * sampleTexture2D(tex, coord).x) * g2;

    coord = uv + vec2(-pixelSize, 0.0); 

    tmp += exp(C * sampleTexture2D(tex, coord).x) * g3;      

    coord = uv; 

    tmp += exp(C * sampleTexture2D(tex, coord).x) * g4;
    
    coord = uv + vec2(pixelSize, 0.0 ); 
 
    tmp += exp(C * sampleTexture2D(tex, coord).x) * g5;

    coord = uv + vec2(-pixelSize, pixelSize); 

    tmp += exp(C * sampleTexture2D(tex, coord).x) * g6;
    
    coord = uv + vec2(0.0,        pixelSize); 

    tmp += exp(C * sampleTexture2D(tex, coord).x) * g7;
    
    coord = uv + vec2(pixelSize,  pixelSize); 

    tmp += exp(C * sampleTexture2D(tex, coord).x) * g8;

    return vec4(tmp); 
} 

