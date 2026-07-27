# React + TypeScript + Vite

## Firebase setup

This app saves receiving PO check-ins to a Firestore collection named
`checkIns` when Firebase environment values are configured.

1. Create a Firebase project.
2. Add a Web App in Firebase Project Settings.
3. Create a Firestore database.
4. Copy `.env.example` to `.env`.
5. Paste the Firebase Web App config values into `.env`.
6. Restart the dev server.

For open shared access, publish the rules in `firestore.rules`.
Those rules let anyone with the app read, add, edit, and delete PO
records. Before using this for private or sensitive information, add
Firebase Authentication and tighten the rules to signed-in users.

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
