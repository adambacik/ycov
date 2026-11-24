/**
 * Plain fetch client for the ycov API: one function per endpoint.
 *
 * URLs are relative ("/api/..."): in production the page and the API come
 * from the same `ycov view` server, in dev Vite proxies /api to it.
 */

import type {
  Coverage,
  Mode,
  ProjectInfo,
  Region,
  SampleInfo,
  WindowAnnotations,
} from "@/api/types";

/** A failed API call: HTTP status (0 = server not reachable) and a readable message. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Query parameters of GET /api/coverage; all optional, the server has defaults. */
export interface CoverageQuery {
  /** default: the whole chromosome */
  region?: Region;
  /** bin size in bp, a multiple of the window size; default: the window size */
  resolution?: number;
  /** default: "rel_copy" */
  mode?: Mode;
  /** sample ids in display order; default: all samples */
  samples?: string[];
}

export function getProject(signal?: AbortSignal): Promise<ProjectInfo> {
  return getJson("/api/project", signal);
}

export function getSamples(signal?: AbortSignal): Promise<SampleInfo[]> {
  return getJson("/api/samples", signal);
}

export function getWindows(signal?: AbortSignal): Promise<WindowAnnotations> {
  return getJson("/api/windows", signal);
}

export function getCoverage(query: CoverageQuery = {}, signal?: AbortSignal): Promise<Coverage> {
  const params = new URLSearchParams();
  if (query.region) params.set("region", formatRegion(query.region));
  if (query.resolution !== undefined) params.set("resolution", String(query.resolution));
  if (query.mode) params.set("mode", query.mode);
  if (query.samples && query.samples.length > 0) {
    params.set("samples", query.samples.join(","));
  }

  const qs = params.toString();
  return getJson(qs ? `/api/coverage?${qs}` : "/api/coverage", signal);
}

/** Region -> "chrY:<start>-<end>", the format the server parses. */
export function formatRegion(region: Region): string {
  return `${region.chromosome}:${region.start}-${region.end}`;
}

/**
 * GET a URL and return its JSON body as T.
 *
 * The type is trusted, not checked: the server already validates every
 * response against its pydantic model. Abort errors are passed through
 * unchanged so callers can ignore them.
 */
async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, "Cannot reach the ycov server - is `ycov view` still running?");
  }

  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response));
  }
  return (await response.json()) as T;
}

/**
 * Readable message from an error response.
 *
 * FastAPI sends {"detail": "..."} for HTTPException (bad region, unknown
 * sample) and {"detail": [{"loc": [...], "msg": "..."}, ...]} for invalid
 * query parameters (e.g. resolution not a multiple of the window size).
 */
async function errorMessage(response: Response): Promise<string> {
  const fallback = `${response.status} ${response.statusText}`.trim();
  try {
    const body: unknown = await response.json();
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d: { loc?: unknown[]; msg?: string }) => {
          const field = d.loc?.at(-1);
          return field !== undefined ? `${String(field)}: ${d.msg}` : String(d.msg);
        })
        .join("; ");
    }
  } catch {
    // not JSON, e.g. a proxy error page
  }
  return fallback;
}
