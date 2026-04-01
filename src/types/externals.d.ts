declare const process: {
  env: Record<string, string | undefined>;
  cwd(): string;
  exit(code?: number): never;
  exitCode?: number;
};

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare module "react" {
  export type ReactNode = any;
  export type Dispatch<T> = (value: T) => void;
  export type SetStateAction<T> = T | ((prev: T) => T);
  export type MutableRefObject<T> = { current: T };
  export type RefObject<T> = { current: T | null };

  export function useEffect(effect: (...args: any[]) => any, deps?: any[]): void;
  export function useLayoutEffect(effect: (...args: any[]) => any, deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps?: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps?: any[]): T;
  export function useState<T>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>];

  export function useRef<T>(initialValue: T): MutableRefObject<T>;
  export function useRef<T>(initialValue: T | null): RefObject<T>;

  export function useTransition(): [boolean, (cb: () => void) => void];
}

declare module "node:fs" {
  export function readFileSync(path: string, encoding: string): string;
  export function existsSync(path: string): boolean;
  export function writeFileSync(path: string, data: string): void;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
}

declare module "node:path" {
  export function join(...parts: string[]): string;
}

declare module "csv-parse/sync" {
  export function parse(
    input: string,
    options?: Record<string, unknown>
  ): Array<Record<string, string>>;
}

declare module "@supabase/supabase-js" {
  export type SupabaseClient = any;
  export function createClient(...args: any[]): any;
}

declare module "@supabase/ssr" {
  export function createBrowserClient(...args: any[]): any;
  export function createServerClient(...args: any[]): any;
}

declare module "next/headers" {
  export function cookies(): Promise<any> | any;
}

declare namespace React {
  type ReactNode = any;
}

declare module "next/server" {
  export class NextResponse {
    constructor(body?: any, init?: any);
    static json(body: any, init?: any): any;
    static redirect(url: string | URL, init?: number | ResponseInit): any;
  }
  export type NextRequest = any;
}

declare module "next/link" {
  const Link: any;
  export default Link;
}

declare module "next/navigation" {
  export function redirect(path: string): never;
  export function usePathname(): string;
  export function useRouter(): {
    replace(path: string, options?: any): void;
    push(path: string, options?: any): void;
  };
  export function useSearchParams(): {
    get(name: string): string | null;
    toString(): string;
  };
}

declare module "next" {
  export type Metadata = any;
}

declare module "zod" {
  export const z: any;
  export default z;
}