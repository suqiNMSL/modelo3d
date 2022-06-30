#if CLIPPING
    if (dot(m_vVertex.xyz, m_uGlobal.clipPlanes[0].xyz) > m_uGlobal.clipPlanes[0].w ||
        dot(m_vVertex.xyz, m_uGlobal.clipPlanes[1].xyz) > m_uGlobal.clipPlanes[1].w ||
        dot(m_vVertex.xyz, m_uGlobal.clipPlanes[2].xyz) > m_uGlobal.clipPlanes[2].w ||
        dot(m_vVertex.xyz, m_uGlobal.clipPlanes[3].xyz) > m_uGlobal.clipPlanes[3].w ||
        dot(m_vVertex.xyz, m_uGlobal.clipPlanes[4].xyz) > m_uGlobal.clipPlanes[4].w ||
        dot(m_vVertex.xyz, m_uGlobal.clipPlanes[5].xyz) > m_uGlobal.clipPlanes[5].w) {
        discard;
    }
#endif