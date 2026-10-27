# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Trading data

Trades use one shared React state and are persisted in the browser's `localStorage` under `traders-journal:trades`. Data stays in that browser profile and device; it is not synchronized to other devices or a backend. Stored records are validated before they enter the application state.

Only valid trades with status `Closed` are included in realized statistics. Net PnL is `(exit - entry) × quantity × multiplier` for Long and `(entry - exit) × quantity × multiplier` for Short, minus commission once. A filled `Actual P&L` is treated as an authoritative final net value and is not reduced by commission again. Commission uses the first non-empty value in this order: `commission`, `Commission`, then `Execution fees`. Equity and Crypto use multiplier `1`; known Futures symbols use the multiplier table in `src/tradeMetrics.js`. Other contract multipliers must be entered explicitly.

Win rate is winning closed trades divided by all valid closed trades; breakeven trades stay in the denominator. Breakeven is net PnL within half a cent of zero. Equity, ROI, and Calmar are shown as unavailable until a starting account balance is recorded.
