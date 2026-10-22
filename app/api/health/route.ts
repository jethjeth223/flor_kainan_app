export function GET() {
  return Response.json(
    { status: "ok", service: "flors-kainan" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
