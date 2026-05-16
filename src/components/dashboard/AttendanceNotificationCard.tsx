import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MapPin, BellRing, CheckCircle2, AlertTriangle, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { getCurrentBrowserPosition, getGeolocationContextError } from "@/lib/geolocation";

interface ActiveCall {
  id: string;
  titulo: string;
  mensagem: string | null;
  expira_em: string;
  status: string;
}

const AttendanceNotificationCard = ({ userId }: { userId: string }) => {
  const [ctId, setCtId] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [notifiedCallId, setNotifiedCallId] = useState<string | null>(null);
  const geolocationContextError = getGeolocationContextError();

  const getDismissStorageKey = (callId: string) => `attendance-call-dismissed:${userId}:${callId}`;

  useEffect(() => {
    const load = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("ct_id")
        .eq("user_id", userId)
        .single();

      const nextCtId = profile?.ct_id || null;
      setCtId(nextCtId);

      if (nextCtId) {
        await fetchActiveCall(nextCtId);
      }

      setLoading(false);
    };

    void load();
  }, [userId]);

  useEffect(() => {
    if (!ctId) return;

    const channel = supabase
      .channel(`aula-chamadas-${ctId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aula_chamadas", filter: `ct_id=eq.${ctId}` },
        async (payload) => {
          await fetchActiveCall(ctId);

          if (payload.eventType === "INSERT") {
            const call = payload.new as Partial<ActiveCall>;
            if (call.status === "ativa") {
              toast.info(call.titulo || "Nova chamada de presenca disponivel");
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ctId, userId]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  const fetchActiveCall = async (currentCtId: string) => {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("aula_chamadas")
      .select("id, titulo, mensagem, expira_em, status")
      .eq("ct_id", currentCtId)
      .eq("status", "ativa")
      .gt("expira_em", now)
      .order("iniciada_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextCall = data || null;
    setActiveCall(nextCall);

    if (!nextCall) {
      setConfirmed(false);
      setDismissed(false);
      return;
    }

    if (typeof window !== "undefined") {
      setDismissed(window.localStorage.getItem(getDismissStorageKey(nextCall.id)) === "true");
    }

    const today = new Date().toISOString().split("T")[0];
    const { data: existingPresence } = await supabase
      .from("presencas")
      .select("id")
      .eq("aluno_id", userId)
      .eq("ct_id", currentCtId)
      .eq("data_treino", today)
      .eq("chamada_id", nextCall.id)
      .limit(1)
      .maybeSingle();

    setConfirmed(Boolean(existingPresence?.id));
  };

  const expiresLabel = useMemo(() => {
    if (!activeCall?.expira_em) return "";
    return new Date(activeCall.expira_em).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [activeCall]);

  useEffect(() => {
    if (!activeCall || confirmed || dismissed) {
      return;
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission !== "granted" || notifiedCallId === activeCall.id) {
      return;
    }

    new Notification("Chamada ativa", {
      body: activeCall.mensagem || "Confirme sua presenca usando sua localizacao atual.",
    });

    setNotifiedCallId(activeCall.id);
  }, [activeCall, confirmed, dismissed, notifiedCallId]);

  const handleDismiss = () => {
    if (!activeCall || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(getDismissStorageKey(activeCall.id), "true");
    setDismissed(true);
  };

  const handleConfirm = async () => {
    if (!activeCall) return;

    setConfirming(true);
    try {
      const position = await getCurrentBrowserPosition();
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      const { data, error } = await supabase.functions.invoke("confirmar-presenca-aula", {
        body: {
          chamada_id: activeCall.id,
          latitude,
          longitude,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.approved) {
        if (data?.reason === "fora_do_perimetro") {
          toast.error(
            `Presenca ignorada: voce esta a ${data.distance_meters} m do CT. Limite: ${data.allowed_radius_meters} m.`,
          );
        } else if (data?.reason === "chamada_expirada") {
          toast.error("A chamada ja expirou.");
        } else {
          toast.error("Nao foi possivel confirmar sua presenca.");
        }
        await fetchActiveCall(ctId!);
        return;
      }

      toast.success(`Presenca confirmada com sucesso (${data.distance_meters} m do CT).`);
      setConfirmed(true);
      setDismissed(false);
      await fetchActiveCall(ctId!);
    } catch (error: any) {
      const message = error?.message || "Nao foi possivel obter sua localizacao";
      toast.error(message);
    } finally {
      setConfirming(false);
    }
  };

  if (loading || !activeCall) {
    return null;
  }

  if (dismissed && !confirmed) {
    return null;
  }

  if (confirmed) {
    return (
      <div className="mb-8 flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/5 p-4">
        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-green-500">Presenca confirmada para esta chamada.</p>
          <p className="text-xs text-muted-foreground">Nenhuma outra acao e necessaria no momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card mb-8 rounded-lg border border-primary/30 p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-primary/15 p-3">
          <BellRing className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-lg uppercase text-foreground">
              {activeCall.titulo}
            </h2>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              Confirmar ate {expiresLabel}
            </span>
          </div>

          <p className="mb-4 text-sm text-muted-foreground">
            {activeCall.mensagem || "O mestre liberou a chamada da aula. Confirme sua presenca usando sua localizacao atual."}
          </p>

          <div className="mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1">
              <MapPin className="h-3.5 w-3.5" />
              Necessario estar dentro do raio do CT
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              A presenca so vale se for aprovada pela geolocalizacao
            </span>
          </div>

          <div className="mb-4 rounded-md bg-secondary/60 p-3 text-xs text-muted-foreground">
            <p className="inline-flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-primary" />
              Se voce estiver fora do perimetro permitido, o sistema ignora a confirmacao mesmo que o botao seja pressionado.
            </p>
          </div>

          {geolocationContextError && (
            <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {geolocationContextError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleConfirm} disabled={confirming || !!geolocationContextError} className="gap-2">
              {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              {confirming ? "Validando localizacao..." : "Confirmar Presenca"}
            </Button>
            <Button type="button" variant="ghost" onClick={handleDismiss} className="gap-2 text-muted-foreground">
              <XCircle className="h-4 w-4" />
              Dispensar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceNotificationCard;
