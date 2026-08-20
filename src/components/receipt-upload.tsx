"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Images, Loader2 } from "lucide-react";

/**
 * 영수증/결제내역/주문내역 이미지 올리기.
 *
 * 두 입구를 제공한다:
 *  - 촬영: 모바일에서 후면 카메라가 바로 열린다 (capture)
 *  - 앨범: 이미 찍어둔 캡처를 고른다. 여러 장 한 번에 가능
 *
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
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  /** 업로드만 하고 바로 돌아온다 — 분석은 서버 백그라운드 큐에서 */
  async function uploadOne(file: File) {
    const compressed = await compressImage(file);

    const formData = new FormData();
    formData.append("image", compressed, "receipt.jpg");

    const response = await fetch("/api/scan-receipt", {
      method: "POST",
      body: formData,
    });
    const data = (await response.json()) as {
      status?: "queued" | "duplicate";
      error?: string;
    };

    if (!response.ok) throw new Error(data.error ?? "업로드에 실패했어요.");
    return data.status ?? "queued";
  }

  async function handleFiles(fileList: FileList) {
    const files = Array.from(fileList).slice(0, 10); //  과도한 일괄 업로드 방지
    if (files.length === 0) return;

    setIsScanning(true);
    setMessage(null);
    setIsError(false);
    setProgress(files.length > 1 ? `${files.length}장 업로드 중...` : "업로드 중...");

    // 큐 방식이라 병렬로 올려도 안전하다 — 서버가 각각 즉시 접수한다
    const results = await Promise.allSettled(files.map((file) => uploadOne(file)));

    const queuedCount = results.filter(
      (r) => r.status === "fulfilled" && r.value === "queued",
    ).length;
    const duplicates = results.filter(
      (r) => r.status === "fulfilled" && r.value === "duplicate",
    ).length;
    const failed = results.filter((r) => r.status === "rejected");

    setProgress(null);
    setIsScanning(false);

    const parts: string[] = [];
    if (queuedCount) parts.push(`${queuedCount}장 업로드 완료 — 분석이 끝나면 아래에 나타나요`);
    if (duplicates) parts.push(`${duplicates}장은 이미 올린 이미지예요`);
    if (failed.length) {
      const reason = failed[0].status === "rejected" && failed[0].reason instanceof Error
        ? failed[0].reason.message : "실패";
      parts.push(`${failed.length}장 업로드 실패 (${reason})`);
    }

    if (queuedCount === 0 && failed.length > 0) {
      setIsError(true);
      setMessage(parts.join(", "));
    } else {
      setMessage(parts.length ? parts.join(", ") : "올릴 이미지가 없어요.");
    }

    router.refresh();

    // 같은 파일을 연달아 올릴 수 있게 초기화
    if (cameraRef.current) cameraRef.current.value = "";
    if (albumRef.current) albumRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      {/* 촬영: 후면 카메라 바로 열기 */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) void handleFiles(event.target.files);
        }}
      />
      {/* 앨범/파일: capture 없음 → 사진 보관함·파일 선택. 여러 장 가능 */}
      <input
        ref={albumRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) void handleFiles(event.target.files);
        }}
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={isScanning}
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
        >
          {isScanning ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" />
          )}
          촬영하기
        </button>

        <button
          type="button"
          onClick={() => albumRef.current?.click()}
          disabled={isScanning}
          className="flex items-center justify-center gap-2 rounded-2xl bg-surface-muted py-3.5 text-sm font-bold text-foreground transition active:scale-[0.98] disabled:opacity-60"
        >
          <Images className="size-4" />
          앨범에서 선택
        </button>
      </div>

      <p className="text-center text-[11px] text-muted">
        영수증·결제내역·쇼핑 주문내역 캡처를 올리면 자동으로 읽어드려요
        {" "}(앨범은 여러 장 가능)
      </p>

      {isScanning && progress && (
        <p
          className="rounded-xl bg-surface-muted px-3 py-2.5 text-center text-xs text-muted"
          role="status"
        >
          {progress}
        </p>
      )}

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
