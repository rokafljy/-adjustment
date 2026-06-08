// 증빙(PDF/이미지) OCR → 금액 추출. 브라우저에서 pdf.js + tesseract.js 사용.
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker, type Worker } from 'tesseract.js';
import type { ProofIndex } from './reconcile';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface OcrProgress {
  fileIndex: number;
  fileCount: number;
  fileName: string;
  phase: string;
}

export interface ProofFileResult {
  fileName: string;
  round: string; // 파일명에서 추출한 회차 (없으면 '')
  amounts: number[]; // 추출된 후보 금액
  textPreview: string;
}

/** 파일명에서 회차 추출: "0418_1회차_..." → "1" */
function roundFromName(name: string): string {
  const m = name.match(/(\d+)\s*회차/);
  return m ? m[1] : '';
}

/** OCR 텍스트에서 금액 후보 추출 (콤마 그룹 숫자 또는 '원' 동반 숫자, 1,000 이상) */
export function extractAmounts(text: string): number[] {
  const found = new Set<number>();
  // 1,800,000 / 59,600 처럼 콤마로 묶인 숫자
  const grouped = text.match(/\d{1,3}(?:,\d{3})+/g) ?? [];
  for (const g of grouped) {
    const n = Number(g.replace(/,/g, ''));
    if (n >= 1000) found.add(n);
  }
  // 59600원 처럼 콤마 없이 '원'이 붙은 숫자
  const won = text.match(/\d{4,}(?=\s*원)/g) ?? [];
  for (const w of won) {
    const n = Number(w);
    if (n >= 1000) found.add(n);
  }
  return [...found].sort((a, b) => a - b);
}

async function renderPdfToCanvases(
  data: ArrayBuffer,
  scale = 2
): Promise<HTMLCanvasElement[]> {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const canvases: HTMLCanvasElement[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    canvases.push(canvas);
  }
  return canvases;
}

function loadImageToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/** 여러 증빙 파일을 OCR 처리하여 회차별 금액 인덱스 생성 */
export async function ocrProofFiles(
  files: File[],
  onProgress?: (p: OcrProgress) => void
): Promise<{ results: ProofFileResult[]; index: ProofIndex }> {
  const worker: Worker = await createWorker('kor+eng');
  const results: ProofFileResult[] = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const report = (phase: string) =>
        onProgress?.({
          fileIndex: i,
          fileCount: files.length,
          fileName: file.name,
          phase,
        });

      report('파일 변환 중');
      let canvases: HTMLCanvasElement[] = [];
      if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
        canvases = await renderPdfToCanvases(await file.arrayBuffer());
      } else {
        canvases = [await loadImageToCanvas(file)];
      }

      let fullText = '';
      for (let c = 0; c < canvases.length; c++) {
        report(`OCR 인식 중 (${c + 1}/${canvases.length}p)`);
        const { data } = await worker.recognize(canvases[c]);
        fullText += '\n' + data.text;
      }

      results.push({
        fileName: file.name,
        round: roundFromName(file.name),
        amounts: extractAmounts(fullText),
        textPreview: fullText.replace(/\s+/g, ' ').trim().slice(0, 300),
      });
    }
  } finally {
    await worker.terminate();
  }

  // 인덱스 구성
  const byRound = new Map<string, Set<number>>();
  const all = new Set<number>();
  for (const r of results) {
    for (const a of r.amounts) all.add(a);
    if (r.round) {
      if (!byRound.has(r.round)) byRound.set(r.round, new Set());
      const set = byRound.get(r.round)!;
      r.amounts.forEach((a) => set.add(a));
    }
  }
  return { results, index: { byRound, all } };
}
