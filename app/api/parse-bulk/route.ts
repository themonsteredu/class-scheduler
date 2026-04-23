import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { parseResultSchema } from "@/lib/schemas";
import { todayISO } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
const TIMEOUT_MS = 60_000;
const MAX_TOKENS = 4000;

const parseArraySchema = z.array(parseResultSchema);

function systemPrompt(today: string) {
  return `당신은 한국의 진로수업 중개 담당자의 비서입니다.
카카오톡/문자/일정표에서 "학교 진로수업 의뢰"를 **여러 건 추출**해 JSON 배열로만 응답합니다.
설명·마크다운·코드펜스 금지. 배열 하나만 출력.

## 오늘 날짜(Asia/Seoul)
${today}

## 규칙
- 반드시 JSON 배열 하나만 출력. 다른 텍스트 금지.
- 입력에 여러 수업 일정이 있으면 **각각을 하나의 JSON 객체**로 만들어 배열에 담는다.
- 수업이 하나뿐이면 길이 1짜리 배열로 반환.
- 확신이 없으면 값은 null, confidence는 'low'.
- 날짜는 오늘 기준 YYYY-MM-DD로. "4/22(수)" → "2026-04-22".
- 시간은 24시간제 HH:mm. "13:30~15:10" → "13:30","15:10".
- 금액은 원 단위 정수. "30만원" → 300000.
- 학년은 "중1","중2","고1","초6" 같은 짧은 형식. 학년 정보 없으면 null.
- 업체/강사 후보 목록이 있으면 먼저 그 안에서 매칭(부분일치 허용).
- 학교명에서 "수대자중" → "수대자중", "월진흥중" → "진흥중" 처럼 **요일 접두어(월/화/수/목/금)가 붙은 경우 요일을 제거**하고 순수 학교명만 추출.
- 차시(예: "2차시"), 대기 공간, 교구 등 스키마에 없는 정보는 notes에 넣는다.

## 출력 스키마 (각 배열 요소)
{
  "school_name": string|null,
  "class_date": "YYYY-MM-DD"|null,
  "start_time": "HH:mm"|null,
  "end_time": "HH:mm"|null,
  "subject": string|null,
  "grade": string|null,
  "student_count": number|null,
  "client_name_guess": string|null,
  "instructor_name_guess": string|null,
  "fee_guess": number|null,
  "confidence": { "<field>": "high"|"mid"|"low" },
  "notes": string|null
}

## 예시 1 (여러 수업)
입력:
"4/22(수) 수대자중 13:30~15:10 3D펜아티스트 2차시 이서은 5층 기술실 대기
4/27(월) 월진흥중 13:40~15:20 드론전문가 2차시 이서은 장애물 교구 지참"

출력:
[{"school_name":"대자중","class_date":"2026-04-22","start_time":"13:30","end_time":"15:10","subject":"3D펜아티스트","grade":null,"student_count":null,"client_name_guess":null,"instructor_name_guess":"이서은","fee_guess":null,"confidence":{"school_name":"high","class_date":"high","start_time":"high","end_time":"high","subject":"high","instructor_name_guess":"high"},"notes":"2차시, 5층 기술실 대기"},{"school_name":"진흥중","class_date":"2026-04-27","start_time":"13:40","end_time":"15:20","subject":"드론전문가","grade":null,"student_count":null,"client_name_guess":null,"instructor_name_guess":"이서은","fee_guess":null,"confidence":{"school_name":"high","class_date":"high","start_time":"high","end_time":"high","subject":"high","instructor_name_guess":"high"},"notes":"2차시, 장애물 교구 지참"}]

## 예시 2 (단일 수업)
입력:
"[진로코칭허브] 4/29 10:00-11:30 양정중 1학년 진로탐색 28명 강사료 25만원"

출력:
[{"school_name":"양정중","class_date":"2026-04-29","start_time":"10:00","end_time":"11:30","subject":"진로탐색","grade":"중1","student_count":28,"client_name_guess":"진로코칭허브","instructor_name_guess":null,"fee_guess":250000,"confidence":{"school_name":"high","class_date":"high","start_time":"high","end_time":"high","subject":"high","grade":"high","student_count":"high","client_name_guess":"high","fee_guess":"high"},"notes":null}]`;
}

function userPrompt(
  message: string,
  existingClients: string[],
  existingInstructors: string[],
) {
  return `[후보 업체]: ${existingClients.join(", ")}
[후보 강사]: ${existingInstructors.join(", ")}
[원문]:
${message}`;
}

function extractJSON(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch !== "{" && ch !== "[") continue;
    const opener = ch;
    const closer = opener === "{" ? "}" : "]";
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (let j = i; j < candidate.length; j++) {
      const c = candidate[j];
      if (inStr) {
        if (escape) escape = false;
        else if (c === "\\") escape = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === opener) depth++;
      else if (c === closer) {
        depth--;
        if (depth === 0) return candidate.slice(i, j + 1);
      }
    }
  }
  return null;
}

async function callClaude(
  client: Anthropic,
  system: string,
  userText: string,
  temperature: number,
) {
  const response = await client.messages.create(
    {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature,
      system,
      messages: [{ role: "user", content: userText }],
    },
    { timeout: TIMEOUT_MS },
  );
  return response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

export async function POST(request: Request) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  let body: {
    message?: string;
    existingClients?: string[];
    existingInstructors?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json(
      { error: "message 필드가 비어 있습니다." },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });
  const system = systemPrompt(todayISO());
  const userText = userPrompt(
    message,
    body.existingClients ?? [],
    body.existingInstructors ?? [],
  );

  try {
    let raw = await callClaude(client, system, userText, 0);
    let jsonStr = extractJSON(raw);
    let parsedObj: unknown = null;
    if (jsonStr) {
      try {
        parsedObj = JSON.parse(jsonStr);
      } catch {
        parsedObj = null;
      }
    }
    if (parsedObj == null) {
      raw = await callClaude(client, system, userText, 0.1);
      jsonStr = extractJSON(raw);
      if (!jsonStr) {
        return NextResponse.json(
          { error: "AI 응답을 파싱하지 못했습니다.", raw },
          { status: 502 },
        );
      }
      try {
        parsedObj = JSON.parse(jsonStr);
      } catch {
        return NextResponse.json(
          { error: "AI 응답이 유효한 JSON이 아닙니다.", raw },
          { status: 502 },
        );
      }
    }

    // If AI returned a single object by mistake, wrap in array
    const arrayish = Array.isArray(parsedObj) ? parsedObj : [parsedObj];
    const validated = parseArraySchema.safeParse(arrayish);
    if (!validated.success) {
      return NextResponse.json(
        {
          error: "AI 응답 스키마가 유효하지 않습니다.",
          details: validated.error.flatten(),
          raw: parsedObj,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ parsed: validated.data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: `AI 호출 실패: ${msg}` },
      { status: 500 },
    );
  }
}
