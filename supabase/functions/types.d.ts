// Types for Deno Edge Functions
declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined;
    };
  };
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export function createClient(url: string, key: string, options?: any): any;
}

declare module "https://esm.sh/stripe@14.21.0" {
  export default class Stripe {
    constructor(key: string, options?: any);
    webhooks: {
      constructEvent(body: string, signature: string, secret: string): any;
    };
    checkout: {
      sessions: {
        create(params: any): Promise<any>;
      };
    };
  }
}

export {};