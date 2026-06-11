// Déclarations de types pour les imports URL Deno — permet au LSP TypeScript
// de VS Code de résoudre les types sans l'extension denoland.vscode-deno

// Deno global — @deno/types v0.0.1 exporte un namespace modulaire (pas global),
// donc on le redéclare ici en ambient global pour que le LSP TypeScript le trouve.
declare namespace Deno {
    function serve(handler: (req: Request) => Response | Promise<Response>): void
    const env: {
        get(key: string): string | undefined
        set(key: string, value: string): void
        delete(key: string): void
        has(key: string): boolean
        toObject(): Record<string, string>
    }
}

declare module 'https://esm.sh/stripe@14?target=deno' {
  export { default } from 'stripe'
  export * from 'stripe'
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js'
}
