// Augmentation dos tipos do Auth.js (ADR-0024): expõe `user.id` na Session e no JWT,
// que o seam getCurrentUserId() consome. Sem isto, `session.user.id` não tipa.
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
