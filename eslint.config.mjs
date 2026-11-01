import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";
export default [
  { ignores: ["dist", "node_modules", "functions/node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["src/**/*.{ts,tsx}"], languageOptions: { parser: tseslint.parser, parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } }, globals: { ...globals.browser } }, plugins: { "react-hooks": reactHooks }, rules: { ...reactHooks.configs.recommended.rules, "no-unused-vars": "off", "@typescript-eslint/no-unused-vars": "off" } }
];
