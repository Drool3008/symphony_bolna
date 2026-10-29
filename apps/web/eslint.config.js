import reactHooks from 'eslint-plugin-react-hooks'
import base from '../../eslint.config.js'

/** The repository's rules, plus the rules of hooks for React code. */
export default [
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
]
