import {
  action,
  apiError,
  snapshot,
  upload,
  getFile,
  exportData,
} from "@/lib/server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: Request, context: Context) {
  try {
    const { path } = await context.params;
    if (path[0] === "snapshot") {
      const response = Response.json(await snapshot(request));
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    if (path[0] === "files" && path[1]) return await getFile(path[1]);
    if (path[0] === "export") return await exportData(request);
    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const { path } = await context.params;
    if (path[0] === "action") return await action(request);
    if (path[0] === "upload") return await upload(request);
    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    return apiError(e);
  }
}
