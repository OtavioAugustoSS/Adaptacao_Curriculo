// Página de login (ADR-0024) — fora do grupo (dashboard), sem sidebar. Entrar com
// Google ou GitHub via server actions do Auth.js (signIn). Após o login, vai para "/".
import { signIn } from "@/auth";

export const metadata = { title: "Entrar — Forja de Currículo" };

export default function LoginPage() {
  return (
    <main className="login">
      <div className="login__card">
        <span className="logo logo--lg">fc</span>
        <h1 className="login__title">Forja de Currículo</h1>
        <p className="login__sub">
          Entre para montar sua base e gerar currículos adaptados — sem inventar nada.
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="login__btn login__btn--google">
            Entrar com Google
          </button>
        </form>

        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="login__btn login__btn--github">
            Entrar com GitHub
          </button>
        </form>
      </div>
    </main>
  );
}
