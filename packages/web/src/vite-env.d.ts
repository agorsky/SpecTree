/// <reference types="vite/client" />

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
