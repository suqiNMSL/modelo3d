
import BenchmarkCPU    from "./test_benchmark_cpu.js";
import ClipCulling     from "./test_clip_culling.js";
import ContextLost     from "./test_context_lost.js";
import FrustumCulling  from "./test_frustum_culling.js";
import Panorama        from "./test_panorama.js";
import ZeroAreaCulling from "./test_zeroarea_culling.js";
import Transparent     from "./test_transparent.js";
import IndexedDB       from "./test_indexeddb.js";
import TestUBO         from "./test_ubo.js";
import tests           from "./test_config.js";

export default {
    BenchmarkCPU: BenchmarkCPU,
    ContextLost: ContextLost,
    ClipCulling: ClipCulling,
    Panorama: Panorama,
    FrustumCulling: FrustumCulling,
    ZeroAreaCulling: ZeroAreaCulling,
    Transparent: Transparent,
    IndexedDB: IndexedDB,
    TestUBO: TestUBO,
    configs: tests 
};

