import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "dist/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 화면 검토용으로 보관한 정적 프로토타입은 현재 앱 번들에 포함되지 않습니다.
    "public/scratch-moyeobap/**",
  ]),
]);

export default eslintConfig;
