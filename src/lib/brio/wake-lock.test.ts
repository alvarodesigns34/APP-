import { describe, expect, it } from "vitest";
import { keepAwake, requestWakeLock, wakeLockSupported } from "./wake-lock";

type Listener = () => void;

function fakeDoc(state: DocumentVisibilityState = "visible") {
  const listeners: Listener[] = [];
  const doc = {
    visibilityState: state,
    addEventListener: (_: string, fn: Listener) => listeners.push(fn),
    removeEventListener: (_: string, fn: Listener) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
  return {
    doc: doc as unknown as Document,
    fire(next: DocumentVisibilityState) {
      doc.visibilityState = next;
      for (const fn of [...listeners]) fn();
    },
    get listenerCount() {
      return listeners.length;
    },
  };
}

function fakeNav(behaviour: "ok" | "throws" | "missing" = "ok") {
  const released: string[] = [];
  let n = 0;
  const nav = {
    ...(behaviour === "missing"
      ? {}
      : {
          wakeLock: {
            request: async () => {
              if (behaviour === "throws") throw new Error("denied");
              const id = `s${++n}`;
              return {
                released: false,
                release: async () => {
                  released.push(id);
                },
              };
            },
          },
        }),
  };
  return { nav: nav as unknown as Navigator, released, get requests() { return n; } };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("wakeLockSupported", () => {
  it("detecta la API y su ausencia", () => {
    expect(wakeLockSupported(fakeNav("ok").nav)).toBe(true);
    expect(wakeLockSupported(fakeNav("missing").nav)).toBe(false);
  });
});

describe("requestWakeLock", () => {
  it("devuelve null en vez de lanzar cuando no hay API", async () => {
    await expect(requestWakeLock(fakeNav("missing").nav)).resolves.toBeNull();
  });

  it("devuelve null si el navegador lo rechaza", async () => {
    // Pasa de verdad con la batería baja. No es excepcional: es «sigue sin
    // bloqueo», no «rompe la pantalla que lo pidió».
    await expect(requestWakeLock(fakeNav("throws").nav)).resolves.toBeNull();
  });
});

describe("keepAwake", () => {
  it("pide el bloqueo y lo suelta al parar", async () => {
    const { nav, released } = fakeNav();
    const d = fakeDoc();
    const stop = keepAwake(nav, d.doc);
    await tick();
    expect(released).toEqual([]);
    stop();
    await tick();
    expect(released).toEqual(["s1"]);
  });

  it("vuelve a pedirlo al recuperar la visibilidad", async () => {
    // El navegador lo suelta solo al ocultarse la pestaña; sin volver a
    // pedirlo, al regresar a la app la pantalla se apagaría otra vez.
    const f = fakeNav();
    const d = fakeDoc();
    const stop = keepAwake(f.nav, d.doc);
    await tick();
    expect(f.requests).toBe(1);
    d.fire("hidden");
    await tick();
    d.fire("visible");
    await tick();
    expect(f.requests).toBe(2);
    stop();
  });

  it("quita el listener al parar", async () => {
    const d = fakeDoc();
    const stop = keepAwake(fakeNav().nav, d.doc);
    await tick();
    expect(d.listenerCount).toBe(1);
    stop();
    expect(d.listenerCount).toBe(0);
  });

  it("suelta el bloqueo que llega tarde si ya se había parado", async () => {
    // La petición es asíncrona: si se para mientras está en vuelo, el sentinel
    // que llega después quedaría vivo y ya nadie podría liberarlo.
    const { nav, released } = fakeNav();
    const d = fakeDoc();
    const stop = keepAwake(nav, d.doc);
    stop();
    await tick();
    expect(released).toEqual(["s1"]);
  });

  it("no explota donde la API no existe", async () => {
    const stop = keepAwake(fakeNav("missing").nav, fakeDoc().doc);
    await tick();
    expect(() => stop()).not.toThrow();
  });
});
