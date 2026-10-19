import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: ['.next/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts'] },
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "CallExpression[callee.name='eval']", message: 'Never evaluate learner input.' },
        { selector: "NewExpression[callee.name='Function']", message: 'Never evaluate learner input.' },
        { selector: "CallExpression[callee.object.name='window'][callee.property.name='alert']", message: 'Use in-app feedback instead of alerts.' },
      ],
    },
  },
];

export default config;
