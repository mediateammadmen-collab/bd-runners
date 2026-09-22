import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["legacy/**"],
  },
];

export default eslintConfig;
