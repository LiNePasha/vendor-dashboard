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
};

export default withPWA(nextConfig);
