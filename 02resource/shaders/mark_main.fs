#include <globalvars.inc>

out vec4 out_color;

void main()
{
#include <clipping.inc>
    
    out_color = m_vId;
}