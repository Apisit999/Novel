"use client";

import { useEffect } from "react";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section>
      <h1 className="text-2xl font-bold">เกิดข้อผิดพลาดบางอย่าง</h1>
      <p className="mt-4">
        <button type="button" onClick={() => retry()} className="text-accent">
          ลองอีกครั้ง
        </button>
      </p>
    </section>
  );
}
