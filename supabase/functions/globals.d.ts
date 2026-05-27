// Déclarations de types pour les imports URL Deno — permet au LSP TypeScript
// de VS Code de résoudre les types sans l'extension denoland.vscode-deno

declare module 'https://esm.sh/stripe@14?target=deno' {
  export { default } from 'stripe'
  export * from 'stripe'
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js'
}
