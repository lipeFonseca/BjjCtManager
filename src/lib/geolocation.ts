const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

const getCurrentOrigin = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
};

const isAllowedHttpHost = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return LOCALHOST_HOSTNAMES.has(window.location.hostname);
};

export const getGeolocationContextError = () => {
  if (typeof navigator === "undefined") {
    return "Geolocalizacao indisponivel neste ambiente.";
  }

  if (!navigator.geolocation) {
    return "Geolocalizacao nao suportada neste dispositivo.";
  }

  if (typeof window !== "undefined" && !window.isSecureContext && !isAllowedHttpHost()) {
    return `A geolocalizacao do navegador so funciona em HTTPS ou localhost. Abra o sistema por uma origem segura em vez de ${getCurrentOrigin()}.`;
  }

  return null;
};

const normalizeGeolocationError = (error: GeolocationPositionError | Error) => {
  if ("code" in error) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return "Permissao de localizacao negada. Libere o acesso a localizacao no navegador e tente novamente.";
      case error.POSITION_UNAVAILABLE:
        return "Nao foi possivel determinar sua localizacao atual.";
      case error.TIMEOUT:
        return "A localizacao demorou mais do que o esperado. Tente novamente.";
      default:
        break;
    }
  }

  if (error.message?.includes("Only secure origins are allowed")) {
    return getGeolocationContextError() || "A geolocalizacao exige uma origem segura.";
  }

  return error.message || "Nao foi possivel obter sua localizacao.";
};

export const getCurrentBrowserPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    const contextError = getGeolocationContextError();
    if (contextError) {
      reject(new Error(contextError));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => reject(new Error(normalizeGeolocationError(error))),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  });
