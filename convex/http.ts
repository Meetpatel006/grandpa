import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/native/receiver-command",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const deviceId = url.searchParams.get("deviceId")?.trim();
    const lastHandledCommandToken =
      url.searchParams.get("lastHandledCommandToken")?.trim() || undefined;

    if (!deviceId) {
      return Response.json({ error: "Missing deviceId." }, { status: 400 });
    }

    const result = await ctx.runQuery(api.emergency.nativePendingCommand, {
      deviceId,
      lastHandledCommandToken,
    });

    return Response.json(result);
  }),
});

http.route({
  path: "/native/ack-command",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { groupId, deviceId, token } = body as Record<string, unknown>;
    if (
      typeof groupId !== "string" ||
      typeof deviceId !== "string" ||
      typeof token !== "string"
    ) {
      return Response.json({ error: "Missing command fields." }, { status: 400 });
    }

    await ctx.runMutation(api.emergency.acknowledgeCommand, {
      groupId: groupId as Id<"groups">,
      deviceId,
      token,
      source: "convex",
    });

    return Response.json({ ok: true });
  }),
});

export default http;
