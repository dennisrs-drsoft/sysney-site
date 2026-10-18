import type { NextConfig } from "next";
import { headersNavegador } from "./admin-api/src/services/seguranca-http.mjs";

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "64kb" } },
  async headers() {
    return [{source:"/:path*",headers:headersNavegador(process.env.NODE_ENV === "production")},
      {source:"/admin/:path*",headers:[{key:"X-Robots-Tag",value:"noindex, nofollow, noarchive"}]},
      {source:"/api/admin/:path*",headers:[{key:"Cache-Control",value:"no-store"},{key:"Referrer-Policy",value:"no-referrer"}]}];
  },
};

export default nextConfig;
