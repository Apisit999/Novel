"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface Factor {
  id: string;
  status: string;
  friendly_name?: string;
}

const btn =
  "border-border bg-surface text-foreground min-h-12 cursor-pointer rounded-full border px-6 font-bold";
const input =
  "border-border bg-surface text-foreground min-h-14 w-48 rounded-2xl border-2 px-5 text-center text-xl tracking-widest";

/** ตั้งค่า/ยืนยันสองขั้นด้วยแอป Authenticator (TOTP) — ใช้ Supabase MFA ผ่านเบราว์เซอร์ (cookie เซสชันเดียวกับเซิร์ฟเวอร์) */
export function MfaPanel({ next, mode }: { next: string; mode: "challenge" | "enroll" | null }) {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  );
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [aal, setAal] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function load() {
    const [f, a] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    setFactors(((f.data?.all ?? []) as Factor[]).filter((x) => x.status === "verified"));
    setAal(a.data?.currentLevel ?? null);
  }
  useEffect(() => {
    // โหลดสถานะจาก Supabase (ระบบภายนอก) หลัง mount — ตั้ง state ในผลลัพธ์ async เท่านั้น
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verified = factors ?? [];
  const needChallenge = verified.length > 0 && aal !== "aal2";

  async function startEnroll() {
    setBusy(true);
    setError("");
    try {
      // ล้างแอปที่ลงทะเบียนค้างไว้ไม่เสร็จ (กันชื่อซ้ำ/ขยะ)
      const all = await supabase.auth.mfa.listFactors();
      for (const f of (all.data?.all ?? []) as Factor[]) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error: e } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `แอปยืนยัน ${new Date().toISOString().slice(0, 10)}`,
      });
      if (e || !data) throw new Error(e?.message ?? "เริ่มตั้งค่าไม่สำเร็จ");
      setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (e) {
      setError(e instanceof Error ? e.message : "เริ่มตั้งค่าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function verify(factorId: string) {
    setBusy(true);
    setError("");
    try {
      const { error: e } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: code.replace(/\s/g, ""),
      });
      if (e) throw new Error("รหัสไม่ถูกต้องหรือหมดอายุ ลองใหม่อีกครั้ง");
      setCode("");
      setEnroll(null);
      setDone("ยืนยันสำเร็จ");
      await load();
      if (mode) router.push(next);
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ยืนยันไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove(factorId: string) {
    if (!window.confirm("ปิดการยืนยันสองขั้นของแอปนี้? บัญชีจะปลอดภัยน้อยลง")) return;
    setBusy(true);
    setError("");
    const { error: e } = await supabase.auth.mfa.unenroll({ factorId });
    if (e) setError("ลบไม่สำเร็จ (ต้องยืนยันรหัสในเซสชันนี้ก่อน)");
    await load();
    setBusy(false);
  }

  const codeInput = (
    <input
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
      inputMode="numeric"
      autoComplete="one-time-code"
      aria-label="รหัส 6 หลักจากแอปยืนยัน"
      placeholder="000000"
      className={input}
    />
  );

  return (
    <div className="flex max-w-xl flex-col gap-6">
      {mode === "enroll" && (
        <p role="alert" className="border-accent rounded-2xl border-2 p-4 font-bold">
          หลังบ้านบังคับยืนยันสองขั้น — ตั้งค่าแอปยืนยันด้านล่างก่อนเข้าหลังบ้าน
        </p>
      )}
      {factors === null ? (
        <p className="text-muted">กำลังโหลด…</p>
      ) : needChallenge ? (
        <div className="flex flex-col gap-3">
          <p className="font-bold">กรอกรหัส 6 หลักจากแอปยืนยันของคุณ</p>
          <div className="flex flex-wrap items-center gap-3">
            {codeInput}
            <button
              type="button"
              className={btn}
              disabled={busy || code.length !== 6}
              onClick={() => void verify(verified[0].id)}
            >
              ยืนยัน
            </button>
          </div>
        </div>
      ) : (
        <>
          {verified.length > 0 && (
            <section aria-labelledby="mfa-on" className="flex flex-col gap-3">
              <h2 id="mfa-on" className="text-xl font-bold">
                เปิดใช้ยืนยันสองขั้นแล้ว ✓
              </h2>
              <ul className="flex flex-col gap-2">
                {verified.map((f) => (
                  <li
                    key={f.id}
                    className="border-border flex items-center gap-3 rounded-xl border p-3"
                  >
                    <span className="grow">{f.friendly_name || "แอปยืนยัน"}</span>
                    <button
                      type="button"
                      className={btn}
                      disabled={busy}
                      onClick={() => void remove(f.id)}
                    >
                      ลบ
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!enroll && verified.length === 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-bold">ยืนยันสองขั้น (แนะนำสำหรับแอดมินทุกคน)</h2>
              <p className="text-muted">
                ใช้แอป Google Authenticator, Authy หรือ 1Password สแกน QR แล้วกรอกรหัส 6 หลัก ต่อให้บัญชี
                Google ของคุณถูกยึด ก็เข้าหลังบ้านไม่ได้ถ้าไม่มีแอปนี้
              </p>
              <div>
                <button
                  type="button"
                  className={btn}
                  disabled={busy}
                  onClick={() => void startEnroll()}
                >
                  เริ่มตั้งค่า
                </button>
              </div>
            </section>
          )}
          {enroll && (
            <section className="flex flex-col gap-3">
              <p className="font-bold">1) สแกน QR ด้วยแอปยืนยัน</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enroll.qr}
                alt="QR code สำหรับแอปยืนยัน"
                width={200}
                height={200}
                className="rounded-xl bg-white p-2"
              />
              <p className="text-muted text-sm">
                สแกนไม่ได้? กรอกรหัสลับนี้ในแอปเอง: <code className="break-all">{enroll.secret}</code>
              </p>
              <p className="font-bold">2) กรอกรหัส 6 หลักที่แอปแสดง</p>
              <div className="flex flex-wrap items-center gap-3">
                {codeInput}
                <button
                  type="button"
                  className={btn}
                  disabled={busy || code.length !== 6}
                  onClick={() => void verify(enroll.id)}
                >
                  เปิดใช้งาน
                </button>
              </div>
            </section>
          )}
        </>
      )}
      {done && (
        <p role="status" className="font-bold">
          {done}
        </p>
      )}
      {error && (
        <p role="alert" className="text-accent font-bold">
          {error}
        </p>
      )}
    </div>
  );
}
