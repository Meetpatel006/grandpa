import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

type RolePreference = "send" | "receive";
type ConnectionState = "connecting" | "connected" | "background";

async function upsertInstallationRecord(
  ctx: MutationCtx,
  args: {
    deviceId: string;
    displayName?: string;
    platform: string;
    rolePreference?: RolePreference;
  },
) {
  const existing = await ctx.db
    .query("installations")
    .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
    .unique();

  const payload = {
    deviceId: args.deviceId,
    displayName: args.displayName,
    platform: args.platform,
    rolePreference: args.rolePreference,
    updatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return existing._id;
  }

  return await ctx.db.insert("installations", payload);
}

async function getMember(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"groups">,
  deviceId: string,
) {
  return await ctx.db
    .query("groupMembers")
    .withIndex("by_groupId_and_deviceId", (q) =>
      q.eq("groupId", groupId).eq("deviceId", deviceId),
    )
    .unique();
}

async function upsertPresenceRecord(
  ctx: MutationCtx,
  args: {
    groupId: Id<"groups">;
    deviceId: string;
    role: "sender" | "receiver";
    connectionState: ConnectionState;
  },
) {
  const existing = await ctx.db
    .query("presence")
    .withIndex("by_groupId_and_deviceId", (q) =>
      q.eq("groupId", args.groupId).eq("deviceId", args.deviceId),
    )
    .unique();

  const payload = {
    groupId: args.groupId,
    deviceId: args.deviceId,
    role: args.role,
    connectionState: args.connectionState,
    lastHeartbeatAt: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return;
  }

  await ctx.db.insert("presence", payload);
}

async function generateUniqueInviteCode(ctx: MutationCtx) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const existing = await ctx.db
      .query("groups")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", inviteCode))
      .unique();

    if (!existing) {
      return inviteCode;
    }
  }

  throw new Error("Failed to create a unique invite code.");
}

async function getLatestRelevantCommand(
  ctx: QueryCtx,
  groupId: Id<"groups">,
  deviceId: string,
) {
  const commands = await ctx.db
    .query("commands")
    .withIndex("by_groupId_and_createdAt", (q) => q.eq("groupId", groupId))
    .order("desc")
    .take(10);

  return (
    commands.find(
      (command) =>
        command.targetMode === "all" ||
        command.targetDeviceIds.includes(deviceId),
    ) ?? null
  );
}

export const upsertInstallation = mutation({
  args: {
    deviceId: v.string(),
    displayName: v.optional(v.string()),
    platform: v.string(),
    rolePreference: v.optional(v.union(v.literal("send"), v.literal("receive"))),
  },
  handler: async (ctx, args) => {
    await upsertInstallationRecord(ctx, args);
    return { ok: true };
  },
});

export const createGroup = mutation({
  args: {
    adminDeviceId: v.string(),
    adminLabel: v.string(),
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await upsertInstallationRecord(ctx, {
      deviceId: args.adminDeviceId,
      displayName: args.adminLabel,
      platform: args.platform,
      rolePreference: "send",
    });

    const existingSenderMembership = await ctx.db
      .query("groupMembers")
      .withIndex("by_deviceId_and_role", (q) =>
        q.eq("deviceId", args.adminDeviceId).eq("role", "sender"),
      )
      .unique();

    if (existingSenderMembership) {
      const existingGroup = await ctx.db.get(existingSenderMembership.groupId);
      if (existingGroup && existingGroup.status === "active") {
        await ctx.db.patch(existingGroup._id, {
          adminLabel: args.adminLabel,
          updatedAt: now,
        });
        await ctx.db.patch(existingSenderMembership._id, {
          label: args.adminLabel,
          updatedAt: now,
        });
        return {
          groupId: existingGroup._id,
          inviteCode: existingGroup.inviteCode,
        };
      }
    }

    const inviteCode = await generateUniqueInviteCode(ctx);
    const groupId = await ctx.db.insert("groups", {
      inviteCode,
      adminDeviceId: args.adminDeviceId,
      adminLabel: args.adminLabel,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("groupMembers", {
      groupId,
      deviceId: args.adminDeviceId,
      role: "sender",
      label: args.adminLabel,
      joinedAt: now,
      updatedAt: now,
    });

    return { groupId, inviteCode };
  },
});

export const joinGroup = mutation({
  args: {
    inviteCode: v.string(),
    deviceId: v.string(),
    receiverLabel: v.string(),
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedInviteCode = args.inviteCode.trim().toUpperCase();
    const group = await ctx.db
      .query("groups")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", normalizedInviteCode))
      .unique();

    if (!group || group.status !== "active") {
      throw new Error(
        `No active sender session found for code ${normalizedInviteCode}. Open Send on the other device and create a group first.`,
      );
    }

    const now = Date.now();

    await upsertInstallationRecord(ctx, {
      deviceId: args.deviceId,
      displayName: args.receiverLabel,
      platform: args.platform,
      rolePreference: "receive",
    });

    const existing = await getMember(ctx, group._id, args.deviceId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        label: args.receiverLabel,
        updatedAt: now,
      });
      return { groupId: group._id, inviteCode: group.inviteCode };
    }

    await ctx.db.insert("groupMembers", {
      groupId: group._id,
      deviceId: args.deviceId,
      role: "receiver",
      label: args.receiverLabel,
      joinedAt: now,
      updatedAt: now,
    });

    return { groupId: group._id, inviteCode: group.inviteCode };
  },
});

export const leaveGroup = mutation({
  args: {
    groupId: v.id("groups"),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const member = await getMember(ctx, args.groupId, args.deviceId);
    if (!member) {
      return { ok: true };
    }

    const presence = await ctx.db
      .query("presence")
      .withIndex("by_groupId_and_deviceId", (q) =>
        q.eq("groupId", args.groupId).eq("deviceId", args.deviceId),
      )
      .unique();

    if (presence) {
      await ctx.db.delete(presence._id);
    }

    await ctx.db.delete(member._id);
    return { ok: true };
  },
});

export const heartbeat = mutation({
  args: {
    groupId: v.id("groups"),
    deviceId: v.string(),
    role: v.union(v.literal("sender"), v.literal("receiver")),
    connectionState: v.union(
      v.literal("connecting"),
      v.literal("connected"),
      v.literal("background"),
    ),
  },
  handler: async (ctx, args) => {
    const member = await getMember(ctx, args.groupId, args.deviceId);
    if (!member || member.role !== args.role) {
      throw new Error("Membership not found.");
    }

    await upsertPresenceRecord(ctx, args);
    return { ok: true };
  },
});

export const sendUnmute = mutation({
  args: {
    groupId: v.id("groups"),
    adminDeviceId: v.string(),
    targetMode: v.union(v.literal("all"), v.literal("specific")),
    targetDeviceIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group || group.status !== "active") {
      throw new Error("Group not found.");
    }

    if (group.adminDeviceId !== args.adminDeviceId) {
      throw new Error("Only the group admin can send commands.");
    }

    if (args.targetMode === "specific" && args.targetDeviceIds.length === 0) {
      throw new Error("Select at least one receiver.");
    }

    const token = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const createdAt = Date.now();

    await ctx.db.insert("commands", {
      groupId: args.groupId,
      token,
      issuedByDeviceId: args.adminDeviceId,
      targetMode: args.targetMode,
      targetDeviceIds:
        args.targetMode === "all" ? [] : Array.from(new Set(args.targetDeviceIds)),
      createdAt,
      source: "convex",
    });

    await ctx.db.patch(group._id, {
      lastCommandToken: token,
      lastCommandAt: createdAt,
      updatedAt: createdAt,
    });

    return { token, createdAt };
  },
});

export const acknowledgeCommand = mutation({
  args: {
    groupId: v.id("groups"),
    deviceId: v.string(),
    token: v.string(),
    source: v.union(v.literal("convex"), v.literal("sms"), v.literal("vip_call")),
  },
  handler: async (ctx, args) => {
    const member = await getMember(ctx, args.groupId, args.deviceId);
    if (!member || member.role !== "receiver") {
      throw new Error("Receiver membership not found.");
    }

    const command = await ctx.db
      .query("commands")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!command) {
      throw new Error("Command not found.");
    }

    const now = Date.now();

    await ctx.db.patch(member._id, {
      lastHandledCommandToken: args.token,
      lastHandledAt: now,
      updatedAt: now,
    });

    if (command.source !== args.source) {
      await ctx.db.patch(command._id, {
        source: args.source,
      });
    }

    return { ok: true };
  },
});

export const senderDashboard = query({
  args: {
    adminDeviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const senderMembership = await ctx.db
      .query("groupMembers")
      .withIndex("by_deviceId_and_role", (q) =>
        q.eq("deviceId", args.adminDeviceId).eq("role", "sender"),
      )
      .unique();

    if (!senderMembership) {
      return null;
    }

    const group = await ctx.db.get(senderMembership.groupId);
    if (!group || group.status !== "active") {
      return null;
    }

    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId", (q) => q.eq("groupId", group._id))
      .take(50);
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_groupId", (q) => q.eq("groupId", group._id))
      .take(50);
    const presenceByDeviceId = new Map(
      presence.map((entry) => [entry.deviceId, entry]),
    );

    const receivers = members
      .filter((member) => member.role === "receiver")
      .map((member) => {
        const livePresence = presenceByDeviceId.get(member.deviceId);
        return {
          deviceId: member.deviceId,
          label: member.label,
          joinedAt: member.joinedAt,
          lastHandledCommandToken: member.lastHandledCommandToken ?? null,
          lastHandledAt: member.lastHandledAt ?? null,
          connectionState: livePresence?.connectionState ?? "connecting",
          lastHeartbeatAt: livePresence?.lastHeartbeatAt ?? null,
        };
      });

    return {
      groupId: group._id,
      inviteCode: group.inviteCode,
      adminLabel: group.adminLabel,
      lastCommandToken: group.lastCommandToken ?? null,
      lastCommandAt: group.lastCommandAt ?? null,
      receivers,
    };
  },
});

export const receiverSession = query({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const receiverMembership = await ctx.db
      .query("groupMembers")
      .withIndex("by_deviceId_and_role", (q) =>
        q.eq("deviceId", args.deviceId).eq("role", "receiver"),
      )
      .unique();

    if (!receiverMembership) {
      return null;
    }

    const group = await ctx.db.get(receiverMembership.groupId);
    if (!group || group.status !== "active") {
      return null;
    }

    const adminMembership = await getMember(ctx, group._id, group.adminDeviceId);
    const latestCommand = await getLatestRelevantCommand(
      ctx,
      group._id,
      args.deviceId,
    );

    return {
      groupId: group._id,
      inviteCode: group.inviteCode,
      adminLabel: adminMembership?.label ?? group.adminLabel,
      receiverLabel: receiverMembership.label,
      lastHandledCommandToken: receiverMembership.lastHandledCommandToken ?? null,
      latestCommand: latestCommand
        ? {
            token: latestCommand.token,
            createdAt: latestCommand.createdAt,
            source: latestCommand.source,
            alreadyHandled:
              latestCommand.token ===
              (receiverMembership.lastHandledCommandToken ?? null),
          }
        : null,
    };
  },
});
