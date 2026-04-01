// @ts-nocheck
import { jsonError, jsonOk } from "@/lib/api/http";
import { deleteClient, getClientById } from "@/lib/repositories/clients";

export async function GET(_: Request, context: { params: Promise<{ clientId: string }> }) {
  try {
    const { clientId } = await context.params;
    return jsonOk(await getClientById(clientId));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ clientId: string }> }) {
  try {
    const { clientId } = await context.params;
    const deleted = await deleteClient(clientId);
    if (!deleted) return jsonOk({ deleted: false, clientId });
    return jsonOk({ deleted: true, clientId, client: deleted });
  } catch (error) {
    return jsonError(error);
  }
}
