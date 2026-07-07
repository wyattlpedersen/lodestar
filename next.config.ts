import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // @libsql/client ships platform-native bindings for its local-file engine —
  // keep it out of the server bundle rather than have webpack try to inline it.
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
