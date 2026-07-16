// Keeps the optional, unused D1 helper type-checkable in a Vercel/Next build.
// Sites/Vinext supplies the real Cloudflare binding at runtime when D1 is used.
declare module "cloudflare:workers" {
  export const env: { DB?: any };
}
