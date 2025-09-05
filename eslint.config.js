/* @ts-check */
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import vue from "eslint-plugin-vue";
import prettier from "eslint-config-prettier";

export default [
  { ignores: ["node_modules", ".nuxt", "dist"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.{ts,tsx,js,vue}"],
    rules: {
      "vue/multi-word-component-names": "off"
    }
  },
  prettier
];


