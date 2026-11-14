"use client";

import { useActionState } from "react";
import { requestLoginLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(requestLoginLink, initial);

  if (state.status === "sent") {
    return (
      <p role="status" className="border-border bg-surface rounded-2xl border p-5">
        ส่งลิงก์เข้าสู่ระบบไปที่อีเมลของคุณแล้ว กรุณาเปิดอีเมลและกดลิงก์ภายใน 1 ชั่วโมง (ถ้าไม่เห็น ลองดูในกล่องจดหมายขยะ)
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="font-bold">
        อีเมล
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder="you@example.com"
        className="border-border bg-surface text-foreground min-h-14 rounded-2xl border-2 px-5"
      />
      {state.status === "error" && (
        <p role="alert" className="text-accent font-bold">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-accent-foreground min-h-14 cursor-pointer rounded-full px-8 font-bold disabled:opacity-60"
      >
        {pending ? "กำลังส่ง…" : "ส่งลิงก์เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
