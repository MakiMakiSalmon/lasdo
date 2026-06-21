/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // ドメイン/集計ロジックの単体テストはDOM不要なので node 環境で実行
    environment: 'node',
  },
})
