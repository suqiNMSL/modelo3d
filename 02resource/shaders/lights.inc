struct SunLightStruct
{
    mat4  diffuseMatrix[3];
    float intensity;
    vec3  direction;
    mat4  shadowMatrix;
};
uniform SunLightStruct m_uSunLight;
uniform sampler2D m_uSunLightProbe;

struct PointLightStruct
{
    vec3  color;
    vec3  position;
    float radius;
};

struct DirectionalLightStruct
{
    vec3  color;
    vec3  direction;
};

struct SpotLightStruct
{
    vec3  color;
    vec3  position;
    vec3  direction;
    float cutoff;
    float radius;
};

#if POINT_LIGHT0
uniform PointLightStruct m_uPointLight0;
#endif
#if POINT_LIGHT1
uniform PointLightStruct m_uPointLight1;
#endif
#if POINT_LIGHT2
uniform PointLightStruct m_uPointLight2;
#endif

#if DIRECTIONAL_LIGHT0
uniform DirectionalLightStruct m_uDirectionalLight0;
#endif
#if DIRECTIONAL_LIGHT1
uniform DirectionalLightStruct m_uDirectionalLight1;
#endif
#if DIRECTIONAL_LIGHT2
uniform DirectionalLightStruct m_uDirectionalLight2;
#endif

#if SPOT_LIGHT0
uniform SpotLightStruct m_uSpotLight0;
#endif
#if SPOT_LIGHT1
uniform SpotLightStruct m_uSpotLight1;
#endif
#if SPOT_LIGHT2
uniform SpotLightStruct m_uSpotLight2;
#endif
