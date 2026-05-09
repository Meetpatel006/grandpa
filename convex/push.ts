"use node";

import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";
import { createSign } from "node:crypto";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

type SendUnmuteCommand = {
  token: string;
  createdAt: number;
};

type PushTarget = {
  deviceId: string;
  fcmToken: string;
};

type SendUnmuteWithPushResult = SendUnmuteCommand & {
  push:
    | {
        attempted: false;
        sent: 0;
        reason: string;
      }
    | {
        attempted: true;
        sent: number;
        targetCount: number;
      };
};

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getServiceAccount(): ServiceAccount | null {
  const serialized = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serialized) {
    return null;
  }

  const parsed = JSON.parse(serialized) as {
    client_email?: string;
    private_key?: string;
    project_id?: string;
  };

  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing required fields.");
  }

  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key,
    project_id: parsed.project_id,
  };
}

async function getAccessToken() {
  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: FCM_SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const unsignedJwt = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();
  const signature = base64Url(signer.sign(serviceAccount.private_key));

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedJwt}.${signature}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Firebase token request failed: ${response.status}`);
  }

  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error("Firebase token response did not include access_token.");
  }

  return {
    accessToken: body.access_token,
    projectId: serviceAccount.project_id,
  };
}

async function sendFcmMessage(args: {
  accessToken: string;
  projectId: string;
  fcmToken: string;
  groupId: string;
  commandToken: string;
}) {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${args.projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: args.fcmToken,
          data: {
            type: "unmute",
            groupId: args.groupId,
            token: args.commandToken,
          },
          android: {
            priority: "high",
          },
        },
      }),
    },
  );

  return response.ok;
}

export const sendUnmuteWithPush = action({
  args: {
    groupId: v.id("groups"),
    adminDeviceId: v.string(),
    targetMode: v.union(v.literal("all"), v.literal("specific")),
    targetDeviceIds: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<SendUnmuteWithPushResult> => {
    const command: SendUnmuteCommand = await ctx.runMutation(
      api.emergency.sendUnmute,
      args,
    );
    const pushTargets: PushTarget[] = await ctx.runQuery(api.emergency.receiverPushTargets, {
      groupId: args.groupId,
      targetMode: args.targetMode,
      targetDeviceIds: args.targetDeviceIds,
    });
    const firebaseAuth = await getAccessToken();

    if (!firebaseAuth) {
      return {
        ...command,
        push: {
          attempted: false,
          sent: 0,
          reason: "FIREBASE_SERVICE_ACCOUNT_JSON is not configured.",
        },
      };
    }

    let sent = 0;
    for (const target of pushTargets) {
      const ok = await sendFcmMessage({
        accessToken: firebaseAuth.accessToken,
        projectId: firebaseAuth.projectId,
        fcmToken: target.fcmToken,
        groupId: args.groupId,
        commandToken: command.token,
      });
      if (ok) {
        sent += 1;
      }
    }

    return {
      ...command,
      push: {
        attempted: true,
        sent,
        targetCount: pushTargets.length,
      },
    };
  },
});
