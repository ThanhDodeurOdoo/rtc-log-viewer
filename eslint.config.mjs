import globals from "globals";
import pluginJs from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import prettierPlugin from "eslint-plugin-prettier";

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        files: ["**/*.{js,mjs,cjs,ts}"],

        ignores: ["dist/*", "lib/owl.iife.js"],

        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2022,
                owl: "readonly",
            },
        },

        plugins: {
            import: importPlugin,
            prettier: prettierPlugin,
        },

        rules: {
            "no-console": "error",
            "no-undef": "error",
            "no-restricted-globals": ["error", "event", "self"],
            "no-const-assign": "error",
            "no-debugger": "error",
            "no-dupe-class-members": "error",
            "no-dupe-keys": "error",
            "no-dupe-args": "error",
            "no-dupe-else-if": "error",
            "no-unsafe-negation": "error",
            "no-duplicate-imports": "error",
            "valid-typeof": "error",
            "no-unused-vars": [
                "error",
                {
                    vars: "all",
                    args: "none",
                    ignoreRestSiblings: false,
                    caughtErrors: "all",
                },
            ],
            curly: ["error", "all"],
            "no-restricted-syntax": ["error", "PrivateIdentifier"],
            "prefer-const": [
                "error",
                {
                    destructuring: "all",
                    ignoreReadBeforeAssign: true,
                },
            ],

            // Prettier rules
            "prettier/prettier": [
                "error",
                {
                    tabWidth: 4,
                    semi: true,
                    singleQuote: false,
                    printWidth: 100,
                    endOfLine: "auto",
                },
            ],

            // Disabled rules
            "node/no-unsupported-features/es-syntax": "off",
            "node/no-missing-import": "off",
        },
    },

    pluginJs.configs.recommended,
];
