import LoginForm from "./login-form";
export const dynamic = "force-dynamic";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const params = await searchParams;
  return (
    <LoginForm initialMode={params.mode === "reset" ? "reset" : "login"} />
  );
}
