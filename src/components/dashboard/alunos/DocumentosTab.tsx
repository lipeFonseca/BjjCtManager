import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileText, Trash2, Download, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Documento {
  id: string;
  nome_arquivo: string;
  tipo_documento: string;
  storage_path: string;
  tamanho_bytes: number | null;
  created_at: string;
}

interface DocumentosTabProps {
  alunoId: string;
  ctId: string | null;
  canEdit: boolean;
}

const tiposDocumento = [
  { value: "foto_perfil", label: "Foto de Perfil" },
  { value: "documento_id", label: "Documento de Identidade" },
  { value: "atestado_medico", label: "Atestado Médico" },
  { value: "comprovante_residencia", label: "Comprovante de Residência" },
  { value: "certificado", label: "Certificado" },
  { value: "outro", label: "Outro" },
];

const DocumentosTab = ({ alunoId, ctId, canEdit }: DocumentosTabProps) => {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tipoDocumento, setTipoDocumento] = useState("outro");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocumentos = async () => {
    const { data, error } = await supabase
      .from("aluno_documentos")
      .select("*")
      .eq("aluno_id", alunoId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching documentos:", error);
    } else {
      setDocumentos((data as Documento[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDocumentos();
  }, [alunoId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    setUploading(true);
    const { data: userData } = await supabase.auth.getUser();

    const fileExt = file.name.split(".").pop();
    const fileName = `${alunoId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("aluno-docs")
      .upload(fileName, file);

    if (uploadError) {
      toast.error("Erro no upload: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from("aluno_documentos").insert({
      aluno_id: alunoId,
      storage_path: fileName,
      nome_arquivo: file.name,
      tipo_documento: tipoDocumento,
      tamanho_bytes: file.size,
      ct_id: ctId,
      uploaded_by: userData.user?.id || null,
    });

    if (dbError) {
      toast.error("Erro ao salvar documento: " + dbError.message);
    } else {
      toast.success("Documento enviado!");
      fetchDocumentos();
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (doc: Documento) => {
    const { error: storageError } = await supabase.storage
      .from("aluno-docs")
      .remove([doc.storage_path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
    }

    const { error: dbError } = await supabase
      .from("aluno_documentos")
      .delete()
      .eq("id", doc.id);

    if (dbError) {
      toast.error("Erro ao excluir: " + dbError.message);
    } else {
      toast.success("Documento excluído!");
      fetchDocumentos();
    }
  };

  const handleDownload = async (doc: Documento) => {
    const { data, error } = await supabase.storage
      .from("aluno-docs")
      .download(doc.storage_path);

    if (error) {
      toast.error("Erro ao baixar: " + error.message);
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.nome_arquivo;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleView = async (doc: Documento) => {
    const { data } = await supabase.storage
      .from("aluno-docs")
      .createSignedUrl(doc.storage_path, 3600);

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Erro ao gerar link de visualização");
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTipoLabel = (tipo: string) => {
    return tiposDocumento.find((t) => t.value === tipo)?.label || tipo;
  };

  if (loading) {
    return <p className="text-muted-foreground text-sm">Carregando documentos...</p>;
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="p-4 rounded-lg bg-secondary/50 border border-border space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Tipo de Documento</Label>
              <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {tiposDocumento.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Arquivo</Label>
              <div className="relative">
                <Input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleUpload}
                  disabled={uploading}
                  className="bg-secondary border-border text-foreground"
                  accept="image/*,.pdf,.doc,.docx"
                />
              </div>
            </div>
          </div>
          {uploading && <p className="text-sm text-muted-foreground">Enviando...</p>}
        </div>
      )}

      {documentos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nenhum documento cadastrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documentos.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-foreground text-sm truncate">{doc.nome_arquivo}</p>
                  <p className="text-xs text-muted-foreground">
                    {getTipoLabel(doc.tipo_documento)} • {formatFileSize(doc.tamanho_bytes)} •{" "}
                    {format(new Date(doc.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={() => handleView(doc)} title="Visualizar">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)} title="Baixar">
                  <Download className="h-4 w-4" />
                </Button>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(doc)}
                    className="text-destructive hover:text-destructive"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentosTab;
