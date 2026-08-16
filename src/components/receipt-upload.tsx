"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";

/**
 * 영수증/결제내역 사진 올리기.
 *
 * 모바일에서는 카메라가 바로 열리고(capture), 앨범에서 골라도 된다.
 * 전송 전에 캔버스로 줄여서(긴 변 1600px, JPEG) 업로드를 가볍게 한다.
 * 인식 결과는 수신함(PENDING)으로 들어와 확인 후 등록한다.
 */

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return file;

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ?? file),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

export function ReceiptUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleFile(file: File) {
    setIsScanning(true);
    setMessage(null);
    setIsError(false);

    try {
      const compressed = await compressImage(file);

      const formData = new FormData();
      formData.append("image", compressed, "receipt.jpg");

      const response = await fetch("/api/scan-receipt", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        added?: number;
        duplicates?: number;
        error?: string;
      };

      if (!response.ok) {
        setIsError(true);
        setMessage(data.error ?? "인식에 실패했어요. 다시 시도해 주세요.");
        return;
      }

      const parts: string[] = [];
      if (data.added) parts.push(`${data.added}건을 읽었어요`);
      if (data.duplicates) parts.push(`${data.duplicates}건은 이미 있어요`);
      setMessage(
        parts.length > 0
          ? `${parts.join(", ")}. 아래에서 확인 후 등록해 주세요.`
          : "새로 읽은 내역이 없어요.",
      );

      router.refresh();
    } catch {
      setIsError(true);
      setMessage("이미지를 처리하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setIsScanning(false);
      // 같은 사진을 연달아 올릴 수 있게 초기화
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        // 모바일에서 후면 카메라 우선 (앨범 선택도 가능)
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isScanning}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
      >
        {isScanning ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            사진을 읽는 중...
          </>
        ) : (
          <>
            <Camera className="size-4" />
            영수증·결제내역 찍어서 올리기
          </>
        )}
      </button>

      {message && (
        <p
          className={`rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
            isError
              ? "bg-expense/10 text-expense"
              : "bg-success/10 text-success"
          }`}
          role={isError ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </div>
  );
}
