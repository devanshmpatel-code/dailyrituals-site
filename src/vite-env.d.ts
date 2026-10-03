/// <reference types="vite/client" />
interface ImportMetaEnv { readonly VITE_WIX_CLIENT_ID?: string; readonly VITE_ENABLE_WRITES?: string }
interface ImportMeta { readonly env: ImportMetaEnv }
declare module '*.html?raw' { const s: string; export default s; }
