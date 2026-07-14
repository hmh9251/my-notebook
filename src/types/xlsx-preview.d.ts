declare module "xlsx-preview" {
  export interface XlsxOptions {
    output?: "string" | "arrayBuffer";
    separateSheets?: boolean;
    minimumRows?: number;
    minimumCols?: number;
  }
  export type XlsxData = ArrayBuffer | Blob | File;
  export function xlsx2Html(
    data: XlsxData,
    options?: XlsxOptions,
  ): Promise<string | string[] | ArrayBuffer | Promise<ArrayBuffer>[]>;
  const _default: { xlsx2Html: typeof xlsx2Html };
  export default _default;
}
