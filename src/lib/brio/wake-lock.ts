/**
 * Mantener la pantalla encendida mientras haces algo con las manos ocupadas.
 *
 * Cocinar y descansar entre series tienen el mismo problema: dejas el móvil
 * apoyado, la pantalla se apaga a los treinta segundos y hay que desbloquear
 * con las manos llenas o sudadas.
 *
 * La API es opcional a propósito en toda la implementación: Wake Lock no
 * existe en Safari antiguo ni en algunos navegadores de escritorio, y no
 * tenerla no debe romper nada — simplemente la pantalla se apagará como
 * siempre. Nada de esto sale del dispositivo.
 */

type Sentinel = { released: boolean; release: () => Promise<void> };

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
};

export function wakeLockSupported(nav: Navigator = navigator): boolean {
  return typeof (nav as WakeLockNavigator).wakeLock?.request === "function";
}

/**
 * Pide el bloqueo y devuelve cómo soltarlo, o null si no se pudo.
 *
 * El navegador suelta el bloqueo por su cuenta al pasar la pestaña a segundo
 * plano, así que quien lo use tiene que volver a pedirlo al recuperar el foco
 * (ver `keepAwake`). Un fallo aquí no es excepcional: pasa con la batería baja
 * o si el permiso se deniega, y lo correcto es seguir sin bloqueo.
 */
export async function requestWakeLock(nav: Navigator = navigator): Promise<Sentinel | null> {
  const api = (nav as WakeLockNavigator).wakeLock;
  if (!api) return null;
  try {
    return await api.request("screen");
  } catch {
    return null;
  }
}

/**
 * Mantiene la pantalla encendida hasta que se llame a la función devuelta.
 *
 * Se vuelve a pedir al recuperar la visibilidad porque el navegador lo suelta
 * siempre que la pestaña deja de verse: sin eso, volver a la app tras mirar
 * otra cosa dejaba la pantalla apagándose otra vez, que es justo el momento en
 * que más molesta.
 */
export function keepAwake(nav: Navigator = navigator, doc: Document = document): () => void {
  let sentinel: Sentinel | null = null;
  let stopped = false;

  async function acquire() {
    if (stopped || sentinel != null) return;
    sentinel = await requestWakeLock(nav);
    // Si se paró mientras esperábamos la promesa, soltar lo que acabe de
    // llegar: si no, quedaría un bloqueo vivo que ya nadie puede liberar.
    if (stopped && sentinel) {
      void sentinel.release().catch(() => {});
      sentinel = null;
    }
  }

  function onVisible() {
    if (doc.visibilityState !== "visible") {
      sentinel = null;
      return;
    }
    void acquire();
  }

  void acquire();
  doc.addEventListener("visibilitychange", onVisible);

  return () => {
    stopped = true;
    doc.removeEventListener("visibilitychange", onVisible);
    const s = sentinel;
    sentinel = null;
    if (s && !s.released) void s.release().catch(() => {});
  };
}
