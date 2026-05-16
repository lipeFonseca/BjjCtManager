import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getHighestRole, getUserRoles } from "../_shared/roles.ts";
import { getProfileByUserId } from "../_shared/profiles.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_PAYMENT_METHODS = new Set([
  "pix",
  "dinheiro",
  "transferencia",
  "boleto",
  "cartao",
]);

type RequestBody = {
  receipt_id?: string;
  action?: "approve" | "reject";
  rejection_reason?: string;
  payment_method?: string;
};

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ensureCtOwnership = async (
  adminClient: ReturnType<typeof createClient>,
  ctId: string,
  userId: string,
) => {
  const { data: ctData, error } = await adminClient
    .from("centros_treinamento")
    .select("id")
    .eq("id", ctId)
    .eq("mestre_lider_id", userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(ctData?.id);
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

    if (!highestRole || (highestRole !== "admin" && highestRole !== "mestre")) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const profile = await getProfileByUserId(adminClient, user.id, "ct_id");
    const ownCtId = String(profile?.ct_id || "");
    const body = (await req.json()) as RequestBody;
    const receiptId = String(body.receipt_id || "").trim();
    const action = String(body.action || "").trim().toLowerCase();
    const rejectionReason = String(body.rejection_reason || "").trim();
    const paymentMethod = String(body.payment_method || "").trim().toLowerCase();

    if (!receiptId || (action !== "approve" && action !== "reject")) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    if (paymentMethod && !ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
      return jsonResponse({ error: "Forma de pagamento invalida" }, 400);
    }

    if (action === "reject" && rejectionReason.length < 3) {
      return jsonResponse({ error: "Informe o motivo da rejeicao" }, 400);
    }

    const { data: receipt, error: receiptError } = await adminClient
      .from("payment_receipts")
      .select("id, cobranca_id, ct_id, review_status")
      .eq("id", receiptId)
      .maybeSingle();

    if (receiptError) throw receiptError;

    if (!receipt) {
      return jsonResponse({ error: "Comprovante nao encontrado" }, 404);
    }

    if (highestRole === "mestre") {
      if (!ownCtId || receipt.ct_id !== ownCtId) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }

      const isCtOwner = await ensureCtOwnership(adminClient, receipt.ct_id, user.id);
      if (!isCtOwner) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }
    }

    const { data: cobranca, error: cobrancaError } = await adminClient
      .from("cobrancas")
      .select("id, ct_id, aluno_id, valor, status, payment_method")
      .eq("id", receipt.cobranca_id)
      .maybeSingle();

    if (cobrancaError) throw cobrancaError;

    if (!cobranca || cobranca.ct_id !== receipt.ct_id) {
      return jsonResponse({ error: "Cobranca vinculada nao encontrada" }, 404);
    }

    if (receipt.review_status !== "pending") {
      return jsonResponse({ error: "Somente comprovantes pendentes podem ser revisados" }, 409);
    }

    if (action === "approve" && ["pago", "confirmado"].includes(String(cobranca.status || ""))) {
      return jsonResponse({ error: "Esta cobranca ja foi confirmada anteriormente" }, 409);
    }

    const now = new Date().toISOString();

    if (action === "reject") {
      const { error: updateReceiptError } = await adminClient
        .from("payment_receipts")
        .update({
          review_status: "rejected",
          reviewed_by: user.id,
          reviewed_at: now,
          rejection_reason: rejectionReason,
        })
        .eq("id", receiptId);

      if (updateReceiptError) throw updateReceiptError;

      const { error: updateCobrancaError } = await adminClient
        .from("cobrancas")
        .update({
          status: "rejeitado",
          rejected_by: user.id,
          rejected_at: now,
          rejection_reason: rejectionReason,
          confirmed_by: null,
          confirmed_at: null,
        })
        .eq("id", cobranca.id);

      if (updateCobrancaError) {
        await adminClient
          .from("payment_receipts")
          .update({
            review_status: "pending",
            reviewed_by: null,
            reviewed_at: null,
            rejection_reason: null,
          })
          .eq("id", receiptId);

        throw updateCobrancaError;
      }

      return jsonResponse({
        success: true,
        receipt_id: receiptId,
        cobranca_id: cobranca.id,
        status: "rejeitado",
      });
    }

    const { error: approveReceiptError } = await adminClient
      .from("payment_receipts")
      .update({
        review_status: "approved",
        reviewed_by: user.id,
        reviewed_at: now,
        rejection_reason: null,
      })
      .eq("id", receiptId);

    if (approveReceiptError) throw approveReceiptError;

    const resolvedPaymentMethod = paymentMethod || String(cobranca.payment_method || "").trim().toLowerCase() || null;
    const { error: approveCobrancaError } = await adminClient
      .from("cobrancas")
      .update({
        status: "pago",
        pago_em: now,
        payment_method: resolvedPaymentMethod,
        confirmed_by: user.id,
        confirmed_at: now,
        rejected_by: null,
        rejected_at: null,
        rejection_reason: null,
        })
        .eq("id", cobranca.id);

    if (approveCobrancaError) {
      await adminClient
        .from("payment_receipts")
        .update({
          review_status: "pending",
          reviewed_by: null,
          reviewed_at: null,
          rejection_reason: null,
        })
        .eq("id", receiptId);

      throw approveCobrancaError;
    }

    const { data: financeiro, error: financeiroError } = await adminClient
      .from("financeiro")
      .select("id, saldo")
      .eq("ct_id", cobranca.ct_id)
      .maybeSingle();

    if (financeiroError) {
      await adminClient
        .from("payment_receipts")
        .update({
          review_status: "pending",
          reviewed_by: null,
          reviewed_at: null,
          rejection_reason: null,
        })
        .eq("id", receiptId);

      await adminClient
        .from("cobrancas")
        .update({
          status: "aguardando_confirmacao",
          pago_em: null,
          confirmed_by: null,
          confirmed_at: null,
          rejection_reason: null,
        })
        .eq("id", cobranca.id);

      throw financeiroError;
    }

    if (!financeiro) {
      const { error: insertFinanceiroError } = await adminClient.from("financeiro").insert({
        ct_id: cobranca.ct_id,
        saldo: Number(cobranca.valor || 0),
      });

      if (insertFinanceiroError) {
        await adminClient
          .from("payment_receipts")
          .update({
            review_status: "pending",
            reviewed_by: null,
            reviewed_at: null,
            rejection_reason: null,
          })
          .eq("id", receiptId);

        await adminClient
          .from("cobrancas")
          .update({
            status: "aguardando_confirmacao",
            pago_em: null,
            confirmed_by: null,
            confirmed_at: null,
            rejection_reason: null,
          })
          .eq("id", cobranca.id);

        throw insertFinanceiroError;
      }
    } else {
      const { error: updateFinanceiroError } = await adminClient
        .from("financeiro")
        .update({
          saldo: Number(financeiro.saldo || 0) + Number(cobranca.valor || 0),
          updated_at: now,
        })
        .eq("id", financeiro.id);

      if (updateFinanceiroError) {
        await adminClient
          .from("payment_receipts")
          .update({
            review_status: "pending",
            reviewed_by: null,
            reviewed_at: null,
            rejection_reason: null,
          })
          .eq("id", receiptId);

        await adminClient
          .from("cobrancas")
          .update({
            status: "aguardando_confirmacao",
            pago_em: null,
            confirmed_by: null,
            confirmed_at: null,
            rejection_reason: null,
          })
          .eq("id", cobranca.id);

        throw updateFinanceiroError;
      }
    }

    return jsonResponse({
      success: true,
      receipt_id: receiptId,
      cobranca_id: cobranca.id,
      status: "pago",
    });
  } catch (error) {
    console.error("[review-payment-receipt] Error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
