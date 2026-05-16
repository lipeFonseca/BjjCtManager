import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getHighestRole, getUserRoles } from "../_shared/roles.ts";
import { getProfileByUserId } from "../_shared/profiles.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RECEIPT_BUCKET = "payment-receipts";
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_COBRANCA_STATUSES = new Set([
  "pendente",
  "atrasado",
  "vencido",
  "rejeitado",
  "aguardando_confirmacao",
]);
const ALLOWED_PAYMENT_METHODS = new Set([
  "pix",
  "dinheiro",
  "transferencia",
  "boleto",
  "cartao",
]);

type RequestBody = {
  cobranca_id?: string;
  payment_method?: string;
  file_name?: string;
  mime_type?: string;
  file_base64?: string;
};

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeMimeType = (value: string) => String(value || "").trim().toLowerCase();

const sanitizeFileName = (value: string) => {
  const normalized = String(value || "comprovante")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

  return normalized || "comprovante";
};

const extensionForMimeType = (mimeType: string) => {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
};

const decodeBase64File = (value: string) => {
  const normalized = String(value || "").trim().replace(/^data:[^;]+;base64,/, "");
  if (!normalized) {
    throw new Error("Arquivo em base64 nao informado.");
  }

  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  if (!bytes.byteLength) {
    throw new Error("Arquivo vazio.");
  }

  return bytes;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const roles = await getUserRoles(adminClient, user.id);
    const highestRole = getHighestRole(roles);

    if (highestRole !== "aluno") {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const profile = await getProfileByUserId(adminClient, user.id, "ct_id");
    const ownCtId = String(profile?.ct_id || "");
    if (!ownCtId) {
      return jsonResponse({ error: "Usuario sem CT vinculado" }, 400);
    }

    const body = (await req.json()) as RequestBody;
    const cobrancaId = String(body.cobranca_id || "").trim();
    const paymentMethod = String(body.payment_method || "").trim().toLowerCase();
    const mimeType = normalizeMimeType(body.mime_type || "");
    const fileName = sanitizeFileName(body.file_name || "");

    if (!cobrancaId || !paymentMethod || !body.file_base64 || !mimeType) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
      return jsonResponse({ error: "Forma de pagamento invalida" }, 400);
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return jsonResponse({ error: "Tipo de arquivo invalido" }, 400);
    }

    const fileBytes = decodeBase64File(body.file_base64);
    if (fileBytes.byteLength > MAX_FILE_SIZE_BYTES) {
      return jsonResponse({ error: "Arquivo acima do limite de 2MB" }, 400);
    }

    const { data: cobranca, error: cobrancaError } = await adminClient
      .from("cobrancas")
      .select("id, ct_id, aluno_id, status")
      .eq("id", cobrancaId)
      .maybeSingle();

    if (cobrancaError) throw cobrancaError;

    if (!cobranca) {
      return jsonResponse({ error: "Cobranca nao encontrada" }, 404);
    }

    if (cobranca.aluno_id !== user.id || cobranca.ct_id !== ownCtId) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    if (!ALLOWED_COBRANCA_STATUSES.has(String(cobranca.status || ""))) {
      return jsonResponse({ error: "Cobranca nao aceita comprovante neste estado" }, 409);
    }

    const { data: existingReceipts, error: existingReceiptsError } = await adminClient
      .from("payment_receipts")
      .select("id, storage_path, mime_type, file_size_bytes, review_status, reviewed_by, reviewed_at, rejection_reason, created_at")
      .eq("cobranca_id", cobrancaId)
      .order("created_at", { ascending: false });

    if (existingReceiptsError) throw existingReceiptsError;

    const latestApprovedReceipt = (existingReceipts || []).find((receipt) => receipt.review_status === "approved");
    if (latestApprovedReceipt) {
      return jsonResponse({ error: "Esta cobranca ja possui comprovante aprovado" }, 409);
    }

    const pendingReceipt = (existingReceipts || []).find((receipt) => receipt.review_status === "pending") || null;
    const extension = extensionForMimeType(mimeType);
    const storagePath = `${ownCtId}/${user.id}/${cobrancaId}/${Date.now()}-${fileName}.${extension}`;

    const { error: uploadError } = await adminClient.storage
      .from(RECEIPT_BUCKET)
      .upload(storagePath, fileBytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message || "Erro ao enviar comprovante");
    }

    let insertedReceiptId: string | null = null;

    try {
      let receiptId = "";

      if (pendingReceipt) {
        const { data: updatedReceipt, error: updateReceiptError } = await adminClient
          .from("payment_receipts")
          .update({
            storage_path: storagePath,
            mime_type: mimeType,
            file_size_bytes: fileBytes.byteLength,
            review_status: "pending",
            reviewed_by: null,
            reviewed_at: null,
            rejection_reason: null,
          })
          .eq("id", pendingReceipt.id)
          .select("id")
          .single();

        if (updateReceiptError) throw updateReceiptError;
        receiptId = updatedReceipt.id;
      } else {
        const { data: insertedReceipt, error: insertReceiptError } = await adminClient
          .from("payment_receipts")
          .insert({
            cobranca_id: cobrancaId,
            ct_id: ownCtId,
            aluno_id: user.id,
            storage_path: storagePath,
            mime_type: mimeType,
            file_size_bytes: fileBytes.byteLength,
            review_status: "pending",
          })
          .select("id")
          .single();

        if (insertReceiptError) throw insertReceiptError;
        receiptId = insertedReceipt.id;
        insertedReceiptId = insertedReceipt.id;
      }

      const { error: updateCobrancaError } = await adminClient
        .from("cobrancas")
        .update({
          status: "aguardando_confirmacao",
          payment_method: paymentMethod,
          confirmed_by: null,
          confirmed_at: null,
          rejected_by: null,
          rejected_at: null,
          rejection_reason: null,
        })
        .eq("id", cobrancaId);

      if (updateCobrancaError) throw updateCobrancaError;

      if (pendingReceipt?.storage_path && pendingReceipt.storage_path !== storagePath) {
        await adminClient.storage.from(RECEIPT_BUCKET).remove([pendingReceipt.storage_path]);
      }

      return jsonResponse({
        success: true,
        receipt_id: receiptId,
        cobranca_id: cobrancaId,
        status: "aguardando_confirmacao",
      });
    } catch (error) {
      await adminClient.storage.from(RECEIPT_BUCKET).remove([storagePath]);

      if (pendingReceipt) {
        await adminClient
          .from("payment_receipts")
          .update({
            storage_path: pendingReceipt.storage_path,
            mime_type: pendingReceipt.mime_type,
            file_size_bytes: pendingReceipt.file_size_bytes,
            review_status: pendingReceipt.review_status,
            reviewed_by: pendingReceipt.reviewed_by,
            reviewed_at: pendingReceipt.reviewed_at,
            rejection_reason: pendingReceipt.rejection_reason,
          })
          .eq("id", pendingReceipt.id);
      } else if (insertedReceiptId) {
        await adminClient.from("payment_receipts").delete().eq("id", insertedReceiptId);
      }

      throw error;
    }
  } catch (error) {
    console.error("[submit-payment-receipt] Error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
