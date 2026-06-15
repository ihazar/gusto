import tseslint from 'typescript-eslint';

// Minimal config: only the unused-vars rule, with a leading-underscore escape
// hatch (e.g. `_unused`, `_channel`) so intentionally-unused names aren't flagged.
export default tseslint.config(
    {
        ignores: ['**/dist/**', '**/node_modules/**', '**/.angular/**', '**/.nx/**', '**/coverage/**'],
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: { parser: tseslint.parser },
        plugins: { '@typescript-eslint': tseslint.plugin },
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
        },
    },
);
