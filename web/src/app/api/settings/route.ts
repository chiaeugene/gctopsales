import { z } from "zod";
import { handle, ApiError } from "@/lib/api";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { parseJson, toJson } from "@/lib/json";
import {
  IdentityBrainSchema,
  SalesBrainSchema,
  FulfillmentBrainSchema,
  CatalogRulesSchema,
} from "@/lib/ai/schemas";

// GET returns the parsed brains plus scalar settings. Never returns secrets —
// channel access tokens are reduced to connection-status display objects.
export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    const channels = await prisma.channelConnection.findMany({
      where: { profileId: profile.id },
      select: { id: true, channel: true, externalId: true, displayName: true, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    return {
      storeName: profile.storeName,
      agentName: profile.agentName,
      city: profile.city,
      state: profile.state,
      homeMarket: profile.homeMarket,
      marketsServed: parseJson<string[]>(profile.marketsServed, ["MY"]),
      identityBrain: IdentityBrainSchema.parse(parseJson(profile.identityBrain, {})),
      salesBrain: SalesBrainSchema.parse(parseJson(profile.salesBrain, {})),
      fulfillmentBrain: FulfillmentBrainSchema.parse(parseJson(profile.fulfillmentBrain, {})),
      catalogRules: CatalogRulesSchema.parse(parseJson(profile.catalogRules, {})),
      tone: profile.tone,
      autoConfirmPayments: profile.autoConfirmPayments,
      followUpAfterHours: profile.followUpAfterHours,
      maxFollowUps: profile.maxFollowUps,
      channels,
    };
  });
}

const PutSchema = z.object({
  storeName: z.string().max(200).optional(),
  agentName: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  homeMarket: z.enum(["MY", "SG", "BN"]).optional(),
  marketsServed: z.array(z.enum(["MY", "SG", "BN"])).min(1).optional(),
  identityBrain: IdentityBrainSchema.optional(),
  salesBrain: SalesBrainSchema.optional(),
  fulfillmentBrain: FulfillmentBrainSchema.optional(),
  catalogRules: CatalogRulesSchema.optional(),
  tone: z.enum(["professional", "balanced", "local"]).optional(),
  autoConfirmPayments: z.boolean().optional(),
  followUpAfterHours: z.number().int().min(1).max(72).nullable().optional(),
  maxFollowUps: z.number().int().min(0).max(10).optional(),
});

// PUT: partial update — fields not sent are left untouched (never reset), so
// a settings card can save independently without wiping other cards' data.
export async function PUT(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = PutSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid settings payload");

    const data: Record<string, unknown> = {};
    if (body.data.storeName !== undefined) data.storeName = body.data.storeName;
    if (body.data.agentName !== undefined) data.agentName = body.data.agentName;
    if (body.data.city !== undefined) data.city = body.data.city;
    if (body.data.state !== undefined) data.state = body.data.state;
    if (body.data.homeMarket !== undefined) data.homeMarket = body.data.homeMarket;
    if (body.data.marketsServed !== undefined) data.marketsServed = toJson(body.data.marketsServed);
    if (body.data.identityBrain !== undefined) data.identityBrain = toJson(body.data.identityBrain);
    if (body.data.salesBrain !== undefined) data.salesBrain = toJson(body.data.salesBrain);
    if (body.data.fulfillmentBrain !== undefined) data.fulfillmentBrain = toJson(body.data.fulfillmentBrain);
    if (body.data.catalogRules !== undefined) data.catalogRules = toJson(body.data.catalogRules);
    if (body.data.tone !== undefined) data.tone = body.data.tone;
    if (body.data.autoConfirmPayments !== undefined) data.autoConfirmPayments = body.data.autoConfirmPayments;
    if (body.data.followUpAfterHours !== undefined) data.followUpAfterHours = body.data.followUpAfterHours;
    if (body.data.maxFollowUps !== undefined) data.maxFollowUps = body.data.maxFollowUps;

    await prisma.storeProfile.update({ where: { id: profile.id }, data });
    return { ok: true };
  });
}
