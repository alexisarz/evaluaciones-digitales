import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/firebase.js'],
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        'src/services/authService.js': { lines: 95, branches: 80 },
        'src/services/adminService.js': { lines: 85, branches: 60 },
        'src/services/examAttemptService.js': { lines: 75, branches: 60 },
        'src/services/correctionsService.js': { lines: 95, branches: 75 },
        'src/services/localExamDraft.js': { lines: 95, branches: 60 },
        'src/features/teacherExams/examRules.js': { lines: 90, branches: 85 },
        'src/features/corrections/correctionRules.js': { lines: 95, branches: 90 },
        'src/utils/examWindow.js': { lines: 95, branches: 80 },
        'src/utils/parseCsv.js': { lines: 95, branches: 90 },
      },
    },
  },
})
