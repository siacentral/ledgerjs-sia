import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: ['lib/', 'coverage/', 'node_modules/']
	},
	eslint.configs.recommended,
	tseslint.configs.recommended,
	{
		rules: {
			'no-console': 'off',
			'no-unused-vars': 'off',
			'linebreak-style': ['error', 'unix'],
			'semi': ['error', 'always'],
			'@typescript-eslint/no-use-before-define': 'error',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-empty-function': 'error'
		}
	}
);
