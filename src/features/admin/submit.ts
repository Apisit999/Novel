import { startTransition, type FormEvent } from "react";

/**
 * ส่งฟอร์มให้ Server Action โดย "ไม่ล้างช่องกรอก"
 * (<form action={fn}> ของ React 19 รีเซ็ตทุกช่องหลังส่ง แม้ส่งไม่ผ่านตรวจสอบ —
 *  แอดมินที่พิมพ์เนื้อหาตอนยาว ๆ แล้ว slug/เลขตอนผิด จะเสียข้อความที่พิมพ์ไปทั้งหมด)
 * ผลลัพธ์/ข้อผิดพลาดยังมาทาง useActionState ตามเดิม
 */
export function submitKeepingValues(action: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // ใส่ปุ่มที่กดเข้าไปด้วย (เช่น "บันทึกแล้วไปตอนถัดไป") — new FormData(form) เฉย ๆ ไม่รวมค่าของปุ่ม
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData =
      submitter instanceof HTMLElement
        ? new FormData(event.currentTarget, submitter as HTMLButtonElement)
        : new FormData(event.currentTarget);
    startTransition(() => action(formData));
  };
}
