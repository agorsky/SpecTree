/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHOW_CREATION_FORMS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Enable importing markdown files as raw strings
declare module "*.md" {
  const content: string;
  export default content;
}

// Support ?raw suffix for explicit raw imports
declare module "*?raw" {
  const content: string;
  export default content;
}
