// The setup gate before the game opens. The machine is checked first, before any download. A capable GPU gets guided
// setup and the game opens with the tuned model ready, so nobody plays half set up. A weak integrated GPU on a machine
// that may have a better one gets the Windows steps and a re-check. Anything else goes straight in (Muse Spark, then
// rules). The result is remembered per GPU, so a return visit opens at once.

export type GpuVerdict = "capable" | "switch" | "none";

export interface GpuInfo {
  vendor: string;
  architecture: string;
  description: string;
  fallback: boolean; // a software adapter
}

// From real results: a GTX 1050 runs the model, Intel Gen 9 crashes on it (docs/archive/FINETUNE.md). Newer Intel gets a try;
// the warm-up prompt decides.
const WEAK_INTEL = /^gen-[0-9]$/;
export function gpuVerdict(info: GpuInfo | null, mobile = false): GpuVerdict {
  if (!info || info.fallback || mobile) return "none";
  const text = `${info.vendor} ${info.description}`.toLowerCase();
  if (/swiftshader|llvmpipe|software|microsoft basic/.test(text)) return "none";
  if (info.vendor.toLowerCase() === "intel" && (WEAK_INTEL.test(info.architecture) || !info.architecture)) return "switch";
  return "capable";
}

export const SETUP_KEY = "mindworld.setup.v1";
export interface SetupMemo {
  gpu: string;
  ok: boolean; // the tuned model warmed up on this GPU
}
export const gpuId = (i: GpuInfo): string => `${i.vendor}/${i.architecture}/${i.description}`.slice(0, 120);

// What a stored result means for this GPU: "load" = open at once and load in the background, "skip" = this GPU failed
// before, null = no result for it, so run the gate.
export function remembered(raw: string | null, gpu: string): "load" | "skip" | null {
  try {
    const m = JSON.parse(raw ?? "null") as SetupMemo | null;
    return m?.gpu === gpu ? (m.ok ? "load" : "skip") : null;
  } catch {
    return null;
  }
}

export function storeSetup(gpu: string | null, ok: boolean): void {
  try {
    if (gpu === null) localStorage.removeItem(SETUP_KEY);
    else localStorage.setItem(SETUP_KEY, JSON.stringify({ gpu, ok } satisfies SetupMemo));
  } catch {
    // storage blocked: the gate simply runs again next visit
  }
}

async function readGpu(): Promise<GpuInfo | null> {
  if (!("gpu" in navigator)) return null;
  try {
    // A GPU that never answers must not hold the game shut: after 4 s it counts as no GPU.
    const a = await Promise.race([navigator.gpu.requestAdapter({ powerPreference: "high-performance" }), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
    if (!a) return null;
    const i = a.info as GPUAdapterInfo & { isFallbackAdapter?: boolean };
    return { vendor: i.vendor ?? "", architecture: i.architecture ?? "", description: i.description ?? "", fallback: i.isFallbackAdapter ?? false };
  } catch {
    return null;
  }
}

export interface SetupHost {
  load(onProgress: (text: string, frac: number) => void): Promise<void>; // download + warm-up
  ready(): void; // the model works: switch the minds to it
  background(): void; // load after the game opened (return visits)
}

const SWITCH_STEPS = [
  "Your browser is using the built-in Intel graphics, which can't run the village's AI. If this computer also has an NVIDIA or AMD card:",
  "1. Open Windows Settings > System > Display > Graphics.",
  "2. Find your browser (add it if it isn't listed).",
  "3. Options > High performance > Save.",
  "4. Close the browser fully, open it again, and come back here.",
];

// Runs the gate; resolves when the game may open.
export async function runSetup(host: SetupHost): Promise<void> {
  const params = new URLSearchParams(location.search);
  const forced = import.meta.env.DEV ? (params.get("gpu") as GpuVerdict | "skip" | null) : null;
  if (forced === "skip") return;
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const box = document.getElementById("setup") as HTMLElement;
  const text = box.querySelector("p")!;
  const bar = box.querySelector<HTMLElement>("[data-bar]")!;
  const fill = box.querySelector<HTMLElement>("[data-fill]")!;
  const buttons = box.querySelector("div[data-buttons]")!;

  const show = (lines: string[], btns: [string, () => void][], progress = false): void => {
    box.hidden = false;
    text.textContent = lines.join("\n");
    bar.hidden = !progress;
    buttons.replaceChildren(...btns.map(([label, fn]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.onclick = fn;
      return b;
    }));
  };

  return new Promise<void>((resolve) => {
    const open = (): void => {
      box.hidden = true;
      resolve();
    };

    const install = (gpu: string): void => {
      show(["Getting the village's AI ready.", "About 0.9 GB, once. It runs on your own graphics card, in this tab."], [], true);
      fill.style.width = "0%";
      let warming = false;
      host.load((_t, frac) => {
        fill.style.width = `${Math.round(100 * frac)}%`;
        if (frac >= 1 && !warming) {
          warming = true;
          show(["Waking up the villagers...", "The first run takes about a minute."], [], true);
        }
      }).then(() => {
        storeSetup(gpu, true);
        host.ready();
        open();
      }, (e: unknown) => {
        console.warn("setup failed", e);
        if (warming) {
          // The weights arrived and the GPU could not run them: this machine stays on the cloud minds.
          storeSetup(gpu, false);
          show(["This graphics card can't run the local AI, so the village uses the cloud instead. Everything still works."], [["Play", open]]);
        } else show(["The download did not finish. Check your connection and try again."], [["Try again", () => install(gpu)], ["Skip for now", open]]);
      });
    };

    const check = async (): Promise<void> => {
      const info = await readGpu();
      const verdict = forced ?? gpuVerdict(info, mobile);
      if (verdict === "none") return open();
      const gpu = info ? gpuId(info) : "dev";
      const seen = forced ? null : remembered(localStorage.getItem(SETUP_KEY), gpu);
      if (seen === "skip") return open();
      if (verdict === "switch") {
        if (!/Windows/.test(navigator.userAgent)) return open(); // the steps are for Windows only
        const none = "This computer only has this graphics chip";
        return show(SWITCH_STEPS, [["Check again", () => void check()], [none, () => (storeSetup(gpu, false), open())]]);
      }
      if (seen === "load") {
        open();
        return host.background();
      }
      install(gpu);
    };
    void check();
  });
}
