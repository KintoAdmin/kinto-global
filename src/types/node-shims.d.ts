declare module "fs/promises" {
  export const readFile: any;
  export const writeFile: any;
  export const mkdir: any;
  export const stat: any;
}
declare module "path" {
  const anyPath: any;
  export = anyPath;
}
declare module "node:child_process" { export const execFile: any; }
declare module "node:util" { export const promisify: any; }
declare module "node:fs/promises" {
  export const readFile: any;
  export const writeFile: any;
  export const mkdir: any;
  export const stat: any;
}
declare module "node:path" { const anyPath: any; export = anyPath; }
declare module "node:os" { const anyOs: any; export = anyOs; }
