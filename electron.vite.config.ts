import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "@unocss/vite";
import { presetIcons } from "unocss/preset-icons";
import AutoImport from "unplugin-auto-import/vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      sourcemap: true,
      rollupOptions: {
        external: ["better-sqlite3"]
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      sourcemap: true,
      rollupOptions: {
        external: ["better-sqlite3"]
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        "@": resolve("src/renderer/src"),
        "@/resources": resolve("resources")
      }
    },
    plugins: [
      AutoImport({
        // targets to transform
        include: [
          /\.[tj]sx?$/, // .ts, .tsx, .js, .jsx
          /\.vue$/,
          /\.vue\?vue/, // .vue
          /\.vue\.[tj]sx?\?vue/, // .vue (vue-loader with experimentalInlineMatchResource enabled)
          /\.md$/ // .md
        ],

        // global imports to register
        imports: [
          // presets
          "vue",
          "vue-router",
          // custom
          {
            "@vueuse/core": [
              // named imports
              "useMouse", // import { useMouse } from '@vueuse/core',
              // alias
              ["useFetch", "useMyFetch"] // import { useFetch as useMyFetch } from '@vueuse/core',
            ],
            "axios": [
              // default imports
              ["default", "axios"] // import { default as axios } from 'axios',
            ]
          },
          // example type import
          {
            from: "vue-router",
            imports: ["RouteLocationRaw"],
            type: true
          }
        ],

        // Array of strings of regexes that contains imports meant to be filtered out.
        ignore: [
          "useMouse",
          "useFetch"
        ],

        // Enable auto import by filename for default module exports under directories
        defaultExportByFilename: false,

        // Options for scanning directories for auto import
        dirsScanOptions: {
          types: true // Enable auto import the types under the directories
        },

        // Auto import for module exports under directories
        // by default it only scan one level of modules under the directory
        dirs: [
          "./hooks",
          "./composables", // only root modules
          "./composables/**", // all nested modules
          // ...

          {
            glob: "./hooks",
            types: true // enable import the types
          },
          {
            glob: "./composables",
            types: false // If top level dirsScanOptions.types importing enabled, just only disable this directory
          }
          // ...
        ],

        // Filepath to generate corresponding .d.ts file.
        // Defaults to './auto-imports.d.ts' when `typescript` is installed locally.
        // Set `false` to disable.
        dts: "./auto-imports.d.ts",

        // Array of strings of regexes that contains imports meant to be ignored during
        // the declaration file generation. You may find this useful when you need to provide
        // a custom signature for a function.
        ignoreDts: [
          "ignoredFunction",
          /^ignore_/
        ],

        // Auto import inside Vue template
        // see https://github.com/unjs/unimport/pull/15 and https://github.com/unjs/unimport/pull/72
        vueTemplate: false,

        // Auto import directives inside Vue template
        // see https://github.com/unjs/unimport/pull/374
        vueDirectives: undefined,

        // Custom resolvers, compatible with `unplugin-vue-components`
        // see https://github.com/antfu/unplugin-auto-import/pull/23/
        resolvers: [
          /* ... */
        ],

        // Include auto-imported packages in Vite's `optimizeDeps` options
        // Recommend to enable
        viteOptimizeDeps: true,

        // Inject the imports at the end of other imports
        injectAtEnd: true,

        // Generate corresponding .eslintrc-auto-import.json file.
        // eslint globals Docs - https://eslint.org/docs/user-guide/configuring/language-options#specifying-globals
        eslintrc: {
          enabled: false, // Default `false`
          // provide path ending with `.mjs` or `.cjs` to generate the file with the respective format
          filepath: "./.eslintrc-auto-import.json", // Default `./.eslintrc-auto-import.json`
          globalsPropValue: true // Default `true`, (true | false | 'readonly' | 'readable' | 'writable' | 'writeable')
        },

        // Generate corresponding .biomelintrc-auto-import.json file.
        // biomejs extends Docs - https://biomejs.dev/guides/how-biome-works/#the-extends-option
        biomelintrc: {
          enabled: false, // Default `false`
          filepath: "./.biomelintrc-auto-import.json" // Default `./.biomelintrc-auto-import.json`
        },

        // Save unimport items into a JSON file for other tools to consume
        dumpUnimportItems: "./auto-imports.json" // Default `false`
      }),
      vue(),
      UnoCSS({
        shortcuts: [
          // Custom shortcuts here
        ],
        theme: {
          colors: {
            // Custom colors here
          }
        },
        safelist: [
          // 添加所有可能用到的图标安全列表
          "i-fa-solid:code",
          "i-fa-solid:server",
          "i-fa-solid:database",
          "i-fa-solid:mobile-alt",
          "i-fa-solid:info-circle",
          "i-fa-solid:exchange",
          "i-fa-solid:sliders-h",
          "i-fa-solid:file-alt",
          "i-fa-solid:folder-plus",
          "i-fa-solid:folder-open",
          "i-fa-solid:plus",
          "i-fa-solid:external-link-alt",
          "i-fa-solid:edit",
          "i-fa-solid:trash-alt",
          "i-fa-solid:code-branch",
          "i-fa-solid:clock",
          "i-fa-solid:folder",
          "i-fa-solid:ellipsis-v",
          "i-fa-solid:star",
          "i-fa-solid:boxes",
          "i-fa-solid:search",
          "i-fa-solid:star"
        ],
        presets: [
          presetIcons({
            scale: 1.2,
            extraProperties: {
              "display": "inline-block",
              "vertical-align": "middle"
            }
          })
        ]
      })
    ]
  }
});
