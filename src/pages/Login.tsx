import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import defaultLogo from "@/assets/logo.png";
import { useLoginConfig } from "@/hooks/useLoginConfig";

/** Input with mouse-tracking glow border */
const GlowInput = ({
  glowColor,
  accentColor,
  textColor,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  glowColor: string;
  accentColor: string;
  textColor: string;
}) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div className="relative w-full">
      <input
        className="relative z-10 h-12 w-full rounded-md px-4 text-sm outline-none transition-all duration-200 ease-in-out border-2"
        style={{
          backgroundColor: accentColor,
          borderColor: accentColor,
          color: textColor,
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        {...props}
      />
      {hovering && (
        <>
          <div
            className="absolute pointer-events-none top-0 left-0 right-0 h-[2px] z-20 rounded-t-md overflow-hidden"
            style={{
              background: `radial-gradient(40px circle at ${mousePos.x}px 0px, ${glowColor} 0%, transparent 70%)`,
            }}
          />
          <div
            className="absolute pointer-events-none bottom-0 left-0 right-0 h-[2px] z-20 rounded-b-md overflow-hidden"
            style={{
              background: `radial-gradient(40px circle at ${mousePos.x}px 2px, ${glowColor} 0%, transparent 70%)`,
            }}
          />
          <div
            className="absolute pointer-events-none top-0 left-0 bottom-0 w-[2px] z-20 rounded-l-md overflow-hidden"
            style={{
              background: `radial-gradient(40px circle at 0px ${mousePos.y}px, ${glowColor} 0%, transparent 70%)`,
            }}
          />
          <div
            className="absolute pointer-events-none top-0 right-0 bottom-0 w-[2px] z-20 rounded-r-md overflow-hidden"
            style={{
              background: `radial-gradient(40px circle at 2px ${mousePos.y}px, ${glowColor} 0%, transparent 70%)`,
            }}
          />
        </>
      )}
    </div>
  );
};

const Login = () => {
  const [username, setUsername] = useState("");
  const [ct, setCt] = useState("");
  const [password, setPassword] = useState("");
  const [rememberAccess, setRememberAccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [logoFallback, setLogoFallback] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { config, loading: configLoading } = useLoginConfig();

  // Mouse glow for the card area
  const [cardMousePos, setCardMousePos] = useState({ x: 0, y: 0 });
  const [cardHovering, setCardHovering] = useState(false);

  const invalidCredentialsMessage = "Nome de usuario ou senha incorretos";
  const missingCtMessage = "Informe o nome do CT.";
  const ctNotFoundMessage = "CT nao encontrado para este usuario.";
  const invalidCtForUserMessage = "Nome do CT invalido para este usuario.";
  const LOGIN_STORAGE_KEY = "bjjmanager_login_preferences";

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOGIN_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as { username?: string; ct?: string };
      setUsername(parsed.username || "");
      setCt(parsed.ct || "");
      setRememberAccess(Boolean(parsed.username || parsed.ct));
    } catch {
      // ignore invalid stored preferences
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedCt = ct.trim();

    if (normalizedUsername !== "admin" && !normalizedCt) {
      toast.error(missingCtMessage);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("login-by-username", {
        body: { username, password, ct: normalizedCt },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao fazer login");
      }

      if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        const {
          data: { session: confirmedSession },
        } = await supabase.auth.getSession();

        if (!confirmedSession?.access_token) {
          throw new Error("Nao foi possivel concluir a sessao. Tente entrar novamente.");
        }
      }

      if (rememberAccess) {
        window.localStorage.setItem(
          LOGIN_STORAGE_KEY,
          JSON.stringify({
            username: username.trim(),
            ct: normalizedCt,
          }),
        );
      } else {
        window.localStorage.removeItem(LOGIN_STORAGE_KEY);
      }

      toast.success("Login realizado com sucesso!");
      navigate("/dashboard");
    } catch (error: unknown) {
      let message = "Nao foi possivel entrar. Tente novamente.";

      if (error instanceof FunctionsHttpError) {
        try {
          const errorBody = await error.context.json();
          message = errorBody?.error || message;
        } catch {
          message = invalidCredentialsMessage;
        }
      } else if (error instanceof Error) {
        message = error.message || message;
      }

      if (
        message === "Invalid login credentials" ||
        message === "Usuário não encontrado" ||
        message === "Usuário ou senha inválidos" ||
        message === "Usuario ou senha invalidos" ||
        message === "Edge Function returned a non-2xx status code"
      ) {
        message = invalidCredentialsMessage;
      } else if (
        message !== invalidCredentialsMessage &&
        message !== missingCtMessage &&
        message !== ctNotFoundMessage &&
        message !== invalidCtForUserMessage
      ) {
        message = "Nao foi possivel entrar. Tente novamente.";
      }

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const sanitizeAssetUrl = (value: string) => {
    const normalized = String(value || "").trim();
    if (!normalized || normalized === '""' || normalized === "null") {
      return "";
    }
    return normalized;
  };

  const configuredLogo = sanitizeAssetUrl(config.login_logo_url);
  const logoSrc = logoFallback || !configuredLogo ? defaultLogo : configuredLogo;
  const bgColor = config.login_bg_color || "#121212";
  const cardBgColor = config.login_card_bg_color || "#1a1a1a";
  const primaryColor = config.login_primary_color || "#dc2626";
  const textColor = config.login_text_color || "#f2f2f2";
  const accentColor = config.login_accent_color || "#262626";
  const bannerUrl = sanitizeAssetUrl(config.login_banner_url);
  const bannerHeight = Number(config.login_banner_height) || 208;
  const bgImageUrl = sanitizeAssetUrl(config.login_bg_image_url);
  const footerImageUrl = sanitizeAssetUrl(config.login_footer_image_url);
  const footerHeight = Number(config.login_footer_height) || 150;
  const logoSize = Number(config.login_logo_size) || 64;
  const bgOpacity = Number(config.login_bg_image_opacity ?? 100) / 100;
  const sideImageEnabled = config.login_side_image_enabled !== "false";
  const sideImageUrl = sanitizeAssetUrl(config.login_side_image_url);
  const sideImageOpacity = Number(config.login_side_image_opacity ?? 40) / 100;
  const sideImageSize = config.login_side_image_size || "cover";
  const showSideImage = sideImageEnabled && sideImageUrl;
  const glowColor = config.login_glow_color || "#dc262640";
  const inputGlowColor = config.login_input_glow_color || primaryColor;

  useEffect(() => {
    setLogoFallback(false);
  }, [configuredLogo]);

  if (renderError) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#121212", display: "flex", alignItems: "center", justifyContent: "center", color: "#f2f2f2", padding: "20px" }}>
        <div style={{ textAlign: "center" }}>
          <h2>Erro ao carregar a página</h2>
          <p style={{ marginTop: "10px", opacity: 0.7 }}>Nao foi possivel carregar a pagina agora.</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: "20px", padding: "10px 20px", backgroundColor: "#dc2626", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
            Recarregar página
          </button>
        </div>
      </div>
    );
  }

  if (configLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando configurações...</div>
      </div>
    );
  }

  try {
    return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{ backgroundColor: bgColor }}
    >
      <div className="absolute right-4 top-4 z-20">
        <Link to="/planos">
          <Button variant="outline">Ver planos</Button>
        </Link>
      </div>

      {bgImageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
          style={{
            backgroundImage: `url(${bgImageUrl})`,
            opacity: bgOpacity,
          }}
        />
      )}

      {bannerUrl && (
        <div className="w-full overflow-hidden flex-shrink-0 relative z-10" style={{ height: `${bannerHeight}px` }}>
          <img
            src={bannerUrl}
            alt="Banner"
            className="w-full h-full object-cover"
            style={{ objectPosition: `center ${config.login_banner_position || 50}%` }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-3 sm:px-4 py-4 sm:py-0 relative z-10">
        <div
          className={`w-full rounded-xl overflow-hidden flex shadow-2xl ${showSideImage ? "max-w-4xl" : "max-w-md"}`}
          style={{ border: `1px solid ${accentColor}` }}
        >
          {/* Left side – form */}
          <div
            className={`w-full ${showSideImage ? "lg:w-1/2" : ""} relative overflow-hidden`}
            style={{ backgroundColor: cardBgColor }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setCardMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
            onMouseEnter={() => setCardHovering(true)}
            onMouseLeave={() => setCardHovering(false)}
          >
            {/* Glow follower */}
            <div
              className="absolute pointer-events-none w-[200px] h-[200px] md:w-[400px] md:h-[400px] rounded-full blur-2xl md:blur-3xl transition-opacity duration-300"
              style={{
                background: glowColor,
                opacity: cardHovering ? 1 : 0,
                transform: `translate(${cardMousePos.x - 100}px, ${cardMousePos.y - 100}px)`,
                transition: "transform 0.15s ease-out, opacity 0.3s",
              }}
            />

            <form
              onSubmit={handleLogin}
              className="relative z-10 flex flex-col items-center justify-center p-5 sm:p-8 md:p-12 min-h-0 sm:min-h-[500px] space-y-4 sm:space-y-6"
            >
              <img
                src={logoSrc}
                alt="Logo"
                className="mb-2 object-contain"
                style={{ height: `${logoSize}px`, width: `${logoSize}px` }}
                onError={() => setLogoFallback(true)}
              />
              <h1
                className="font-heading text-2xl sm:text-3xl md:text-4xl uppercase tracking-wider text-center"
                style={{ color: textColor }}
              >
                {config.login_title || "BJJ Manager"}
              </h1>
              <p style={{ color: textColor, opacity: 0.6 }} className="text-sm text-center">
                {config.login_subtitle || "Acesse sua conta"}
              </p>

              <div className="w-full max-w-sm space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" style={{ color: textColor }} className="text-sm">
                    Nome de Usuário
                  </Label>
                  <GlowInput
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ex: admin"
                    required
                    autoComplete="username"
                    glowColor={inputGlowColor}
                    accentColor={accentColor}
                    textColor={textColor}
                  />
                  <p className="text-xs" style={{ color: textColor, opacity: 0.4 }}>
                    Use seu nome de usuário, não o email.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" style={{ color: textColor }} className="text-sm">
                    Senha
                  </Label>
                  <div className="relative">
                    <GlowInput
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      glowColor={inputGlowColor}
                      accentColor={accentColor}
                      textColor={textColor}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-20 opacity-60 hover:opacity-100 transition-opacity"
                      style={{ color: textColor }}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ct" style={{ color: textColor }} className="text-sm">
                    CT
                  </Label>
                  <GlowInput
                    id="ct"
                    type="text"
                    value={ct}
                    onChange={(e) => setCt(e.target.value)}
                    placeholder="Ex: TFTeam"
                    autoComplete="organization"
                    required={username.trim().toLowerCase() !== "admin"}
                    glowColor={inputGlowColor}
                    accentColor={accentColor}
                    textColor={textColor}
                  />
                  <p className="text-xs" style={{ color: textColor, opacity: 0.4 }}>
                    Obrigatorio para todos os usuarios, exceto o admin do sistema.
                  </p>
                </div>

                <label className="flex items-center gap-2 text-sm" style={{ color: textColor, opacity: 0.85 }}>
                  <input
                    type="checkbox"
                    checked={rememberAccess}
                    onChange={(e) => setRememberAccess(e.target.checked)}
                    className="h-4 w-4 rounded border border-white/20 bg-transparent accent-red-600"
                  />
                  Salvar usuario e CT neste dispositivo
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full inline-flex justify-center items-center overflow-hidden rounded-md px-4 py-3 text-sm font-semibold text-white transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: primaryColor,
                    boxShadow: `0 0 20px ${primaryColor}40`,
                  }}
                >
                  <span className="relative z-10">
                    {loading ? "Entrando..." : "Entrar"}
                  </span>
                  <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-13deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-13deg)_translateX(100%)]">
                    <div className="relative h-full w-10 bg-white/20" />
                  </div>
                </button>
              </div>
            </form>
          </div>

          {/* Right side – image */}
          {showSideImage && (
            <div className="hidden lg:block w-1/2 relative overflow-hidden">
              <img
                src={sideImageUrl}
                alt="Side"
                className="w-full h-full transition-transform duration-500 hover:scale-105"
                style={{
                  objectFit: sideImageSize as any,
                  opacity: sideImageOpacity,
                }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, ${bgColor}cc 0%, transparent 60%)`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {footerImageUrl && (
        <div className="w-full flex-shrink-0 overflow-hidden relative z-10" style={{ height: `${footerHeight}px` }}>
          <img
            src={footerImageUrl}
            alt="Rodapé"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      )}
    </div>
    );
  } catch (error: any) {
    setRenderError("Erro ao renderizar a pagina");
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#121212", display: "flex", alignItems: "center", justifyContent: "center", color: "#f2f2f2", padding: "20px" }}>
        <div style={{ textAlign: "center" }}>
          <h2>Erro ao renderizar página de login</h2>
          <p style={{ marginTop: "10px", opacity: 0.7 }}>Nao foi possivel carregar a pagina agora.</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: "20px", padding: "10px 20px", backgroundColor: "#dc2626", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
            Recarregar página
          </button>
        </div>
      </div>
    );
  }
};

export default Login;
