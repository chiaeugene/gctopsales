// Flat config (ESLint 9+). The project had no ESLint config file at all, so
// `npm run lint` failed outright and lint was silently catching nothing.
//
// eslint-config-next 16 exports native flat configs, so no @eslint/eslintrc
// FlatCompat shim is needed.
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      // Prisma's generated client is huge and not ours to lint.
      "src/generated/**",
      "prisma/dev.db",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Unused vars are worth failing on, but allow the deliberate
      // `void admin;` / `_unused` escape hatches already in the code.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],

      // The two React Compiler advisory rules below are warnings, not errors,
      // so that an `npm run lint` failure always means a real defect.
      //
      // set-state-in-effect: 19 hits, essentially all the same intentional
      // pattern — `useEffect(() => setX(props.x), [props.x])` to resync a card's
      // draft state when freshly loaded settings arrive. Worth revisiting (a
      // `key` prop would be cleaner) but it is a performance note, not a bug.
      "react-hooks/set-state-in-effect": "warn",
      // immutability: fires on `document.cookie = …` in the language toggle,
      // which is a legitimate external-system write, not a mutation bug.
      "react-hooks/immutability": "warn",
    },
  },
  {
    // A flat config file IS an anonymous default export.
    files: ["eslint.config.mjs"],
    rules: { "import/no-anonymous-default-export": "off" },
  },
];
