import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  installations: defineTable({
    deviceId: v.string(),
    displayName: v.optional(v.string()),
    platform: v.string(),
    rolePreference: v.optional(v.union(v.literal("send"), v.literal("receive"))),
    updatedAt: v.number(),
  }).index("by_deviceId", ["deviceId"]),

  groups: defineTable({
    inviteCode: v.string(),
    adminDeviceId: v.string(),
    adminLabel: v.string(),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastCommandToken: v.optional(v.string()),
    lastCommandAt: v.optional(v.number()),
  }).index("by_inviteCode", ["inviteCode"]),

  groupMembers: defineTable({
    groupId: v.id("groups"),
    deviceId: v.string(),
    role: v.union(v.literal("sender"), v.literal("receiver")),
    label: v.string(),
    joinedAt: v.number(),
    updatedAt: v.number(),
    lastHandledCommandToken: v.optional(v.string()),
    lastHandledAt: v.optional(v.number()),
  })
    .index("by_groupId", ["groupId"])
    .index("by_groupId_and_deviceId", ["groupId", "deviceId"])
    .index("by_deviceId_and_role", ["deviceId", "role"]),

  presence: defineTable({
    groupId: v.id("groups"),
    deviceId: v.string(),
    role: v.union(v.literal("sender"), v.literal("receiver")),
    connectionState: v.union(
      v.literal("connecting"),
      v.literal("connected"),
      v.literal("background"),
    ),
    lastHeartbeatAt: v.number(),
  })
    .index("by_groupId", ["groupId"])
    .index("by_groupId_and_deviceId", ["groupId", "deviceId"]),

  commands: defineTable({
    groupId: v.id("groups"),
    token: v.string(),
    issuedByDeviceId: v.string(),
    targetMode: v.union(v.literal("all"), v.literal("specific")),
    targetDeviceIds: v.array(v.string()),
    createdAt: v.number(),
    source: v.union(v.literal("convex"), v.literal("sms"), v.literal("vip_call")),
  })
    .index("by_groupId_and_createdAt", ["groupId", "createdAt"])
    .index("by_token", ["token"]),
});
