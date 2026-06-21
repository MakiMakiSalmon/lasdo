import { defineConfig, devices } from '@playwright/test';

/**
 * 経過時間スクショ専用の Playwright 設定（このブランチ専用・main 非マージ）。
 *
 * - testDir は e2e/。webServer で `npm run dev`(Vite:5173) を自動起動。
 * - 成果物(PNG / コンタクトシート)は screenshots/ に出す。
 * - デスクトップ視点で撮る。モバイルを足す場合は projects に viewport 違いを追加する。
 */
export default defineConfig({
  testDir: './e2e',
  // Vitest の include(**/*.spec.ts) と衝突しないよう *.e2e.ts だけを対象にする。
  testMatch: '**/*.e2e.ts',
  // チャート描画があるので過剰並列は避ける（決定的・安定優先）。
  workers: 2,
  fullyParallel: true,
  reporter: 'list',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:5173',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 2, // くっきりした PNG にする
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
