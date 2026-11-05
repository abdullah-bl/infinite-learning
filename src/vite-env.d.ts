/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_ONEBASE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
