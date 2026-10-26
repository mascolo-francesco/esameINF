import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // icone Phosphor con lo stesso tratto reale, circa 1,5 px: bold fino a 20 px, regular da 24 px in su
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name=/^([A-Z]\\w*Icon|Icona)$/]:not(:has(JSXAttribute[name.name='weight']))",
          message: "Indica il peso dell'icona: weight=\"bold\" fino a 20 px, weight=\"regular\" da 24 px in su.",
        },
        {
          selector: "JSXAttribute[name.name='weight']:not([value.value=/^(bold|regular)$/])",
          message: "Solo weight=\"bold\" (fino a 20 px) o weight=\"regular\" (da 24 px), scritto come stringa.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // worker di MapLibre già minificato, copiato da scripts/copia-worker-mappa.mjs
    "public/maplibre/**",
  ]),
]);

export default eslintConfig;
