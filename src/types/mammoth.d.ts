/** ไลบรารีอ่านไฟล์ Word (.docx) รุ่นสำหรับเบราว์เซอร์ — ตัวแพ็กเกจไม่มี type ให้ไฟล์นี้ */
declare module "mammoth/mammoth.browser" {
  export interface RawTextResult {
    value: string;
    messages: unknown[];
  }
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<RawTextResult>;
  const mammoth: { extractRawText: typeof extractRawText };
  export default mammoth;
}
