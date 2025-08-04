// next.config.mjs

import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bỏ qua lỗi ESLint khi build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Bỏ qua lỗi TypeScript khi build
  typescript: {
    ignoreBuildErrors: true,
  },

  // Disable static optimization
  distDir: ".next",
  generateEtags: false,

  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // appDir: true, // bật nếu cần
  },

  exportPathMap: undefined,
  trailingSlash: false,

  // Cấu hình Webpack
  webpack: (config, { buildId, dev, isServer }) => {
    // Ignore tất cả build errors và warnings (tuỳ chọn)
    config.bail = false;
    config.ignoreWarnings = [/.*/];
    config.stats = {
      errorDetails: false,
      errors: false,
      warnings: false,
    };

    // --- Thiết lập alias @ → ./src (dùng process.cwd() thay __dirname) ---
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(process.cwd(), "src"),
    };

    return config;
  },

  // Tối ưu on-demand entries
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

export default nextConfig;
