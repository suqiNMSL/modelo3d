uniform vec3 uColor;

#if WEBGL2
out vec4 out_color;
#endif

void main() 
{ 
#if WEBGL2
    out_color = vec4(uColor, 1);
#else
    gl_FragColor = vec4(uColor, 1);
#endif
}
