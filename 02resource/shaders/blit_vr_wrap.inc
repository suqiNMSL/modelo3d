uniform vec2 uLeftCenterOffset; 
uniform vec2 uRightCenterOffset; 
uniform vec4 uWarpScaleParam; 
uniform vec3 uHmdWarpParam; 
uniform bool uCalibration;

vec4 shade(in sampler2D tex, in vec2 uv, in vec2 invResolution)
{
    vec4 res;
    if(m_vTexCoord.x <= 0.5){ 
        vec2 coord = vec2(m_vTexCoord.x * 2.0, m_vTexCoord.y); 
        vec2 offset = (coord.xy - uLeftCenterOffset) * uWarpScaleParam.xy;
        float dist2 = offset.x * offset.x + offset.y * offset.y;
        
        vec2 offsetWarp = offset * (uHmdWarpParam.x +  uHmdWarpParam.y * dist2 + uHmdWarpParam.z * dist2 * dist2);
        vec2 sampLoc = uLeftCenterOffset + offsetWarp * uWarpScaleParam.zw;
        
        if(all(equal(clamp(sampLoc, 0.0, 1.0), sampLoc)))
            res = sampleTexture2D(tex, vec2(sampLoc.x * 0.5, sampLoc.y)); 
        else
            res = vec4(0.0);
        
        if (uCalibration) {
            if(res.w > 0.0 && (mod(sampLoc.x - uLeftCenterOffset.x, 0.1) < 0.002 || mod(sampLoc.y, 0.1) < 0.002))
                res = vec4(0.0,0.0,1.0,1.0);
        
            if(length(coord.xy - uLeftCenterOffset) < 0.01) 
                res = vec4(0.0, 0.0, 0.0, 1.0);
        }
    } else { 
        vec2 coord = vec2((m_vTexCoord.x - 0.5) * 2.0, m_vTexCoord.y); 
        vec2 offset = (coord.xy - uRightCenterOffset) * uWarpScaleParam.xy;
        float dist2 = offset.x * offset.x + offset.y * offset.y;
        vec2 offsetWarp = offset * (uHmdWarpParam.x + 
        uHmdWarpParam.y * dist2 + uHmdWarpParam.z * dist2 * dist2);
        vec2 sampLoc = uRightCenterOffset + offsetWarp * uWarpScaleParam.zw;
        if(all(equal(clamp(sampLoc, 0.0, 1.0), sampLoc)))
            res = sampleTexture2D(tex, vec2(sampLoc.x* 0.5 + 0.5, sampLoc.y));
        else
            res = vec4(0.0, 0.0, 0.0, 1.0);

        if (uCalibration) {
            if(res.w > 0.0 && (mod(sampLoc.x - uRightCenterOffset.x, 0.1) < 0.002 || mod(sampLoc.y, 0.1) < 0.002))
                res = vec4(0.0,0.0,1.0,1.0);
            if(length(coord.xy - uRightCenterOffset) < 0.01)
                res = vec4(1.0,0.0,0.0,1.0);
        }

    }
    return res;
}
