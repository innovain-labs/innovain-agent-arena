import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';

export default ts.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'work/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    plugins: { 'react-hooks': hooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error' },
  },
);
