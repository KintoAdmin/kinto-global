import { jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { clientUpsertSchema } from "@/lib/api/schemas";
import { listClients, upsertClient } from "@/lib/repositories/clients";

export async function GET() {
  try {
    return jsonOk(await listClients());
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = clientUpsertSchema.parse(await parseJson(request));
    const client = await upsertClient(payload);
    return jsonOk(client, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
