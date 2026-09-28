import type { NextConfig } from "next";

// Статический экспорт для GitHub Pages. BASE_PATH задаётся в workflow деплоя
// (сайт живёт по адресу https://<user>.github.io/<repo>/).
const basePath = process.env.BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
