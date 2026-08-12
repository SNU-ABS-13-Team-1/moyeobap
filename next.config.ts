import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AGENTS.md는 제품 정책의 단일 기준이므로 Next.js 안내문을 자동 삽입하지 않습니다.
  agentRules: false,
};

export default nextConfig;
