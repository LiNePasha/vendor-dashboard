import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  // Allow disabling PWA with env var during build if needed
  disable: process.env.NODE_ENV === "development" || process.env.NEXT_DISABLE_PWA === "1",
});

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.spare2app.com',
        pathname: '/wp-content/uploads/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Ignore electron and fs modules in browser bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        electron: false,
      };
    }
    return config;
  },
};

export default withPWA(nextConfig);
