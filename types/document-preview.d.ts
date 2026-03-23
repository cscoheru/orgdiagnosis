declare module 'pptxjs' {
  interface PptxJs {
    on(event: 'slideChanged', callback: (slideNumber: number) => void): void;
    on(event: 'loaded', callback: (slideCount: number) => void): void;
    on(event: 'error', callback: (error: Error) => void): void;
    load(): void;
  }

  interface PptxJsConstructor {
    new (url: string, container: HTMLElement): PptxJs;
  }

  const PptxJs: PptxJsConstructor;
  export default PptxJs;
}

declare module 'docx-preview' {
  interface Options {
    className?: string;
    inWrapper?: boolean;
    ignoreWidth?: boolean;
    ignoreHeight?: boolean;
    ignoreFonts?: boolean;
    breakPages?: boolean;
    ignoreLastRenderedPageBreak?: boolean;
    experimental?: boolean;
    trimXmlDeclaration?: boolean;
    useBase64URL?: boolean;
    renderHeaders?: boolean;
    renderFooters?: boolean;
    renderFootnotes?: boolean;
    renderEndnotes?: boolean;
  }

  export function renderAsync(
    data: ArrayBuffer | Blob,
    bodyContainer: HTMLElement,
    styleContainer?: HTMLElement | null,
    options?: Options
  ): Promise<void>;
}

declare module 'xlsx' {
  interface WorkSheet {
    [key: string]: any;
  }

  interface WorkBook {
    SheetNames: string[];
    Sheets: { [key: string]: WorkSheet };
  }

  interface ReadingOptions {
    type?: 'base64' | 'binary' | 'buffer' | 'file' | 'array' | 'string';
    cellFormula?: boolean;
    cellHTML?: boolean;
    cellNF?: boolean;
    cellStyles?: boolean;
    cellText?: boolean;
    cellDates?: boolean;
    sheetStubs?: boolean;
    sheetRows?: number;
    bookDeps?: boolean;
    bookSheets?: boolean;
    bookProps?: boolean;
    bookVBA?: boolean;
    password?: string;
  }

  interface Sheet2JSONOpts {
    header?: number | string[];
    dateNF?: string;
    defval?: any;
    blankrows?: boolean;
    raw?: boolean;
    rawNumbers?: boolean;
  }

  export function read(data: any, options?: ReadingOptions): WorkBook;
  export function readFile(filename: string, options?: ReadingOptions): WorkBook;
  export const utils: {
    sheet_to_json<T = any>(sheet: WorkSheet, opts?: Sheet2JSONOpts): T[];
    sheet_to_csv(sheet: WorkSheet, opts?: any): string;
    aoa_to_sheet<T = any>(data: T[][], opts?: any): WorkSheet;
    json_to_sheet<T = any>(data: T[], opts?: any): WorkSheet;
    book_new(): WorkBook;
    book_append_sheet(workbook: WorkBook, worksheet: WorkSheet, name?: string): void;
  };
}
