import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/supabase/server";
import { parseResultSchema } from "@/lib/schemas";
import { todayISO } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
const TIMEOUT_MS = 30_000;
const MAX_TOKENS = 1200;

function systemPrompt(today: string) {
  return `당신은 한국의 진로수업 중개 담당자의 비서입니다.
카카오톡/문자/전화 메모에서 "학교 진로수업 의뢰" 정보를 추출해
지정된 JSON 스키마로만 응답합니다. 설명·마크다운·코드펜스 금지.

## 오늘 날짜(Asia/Seoul)
${today}

## 규칙
- 반드시 아래 JSON 형식 하나만 출력. 다른 텍스트 금지.
- **여러 수업 일정이 같이 들어와도 반드시 단일 JSON 객체 하나만 반환** (배열 금지). 원문에서 첫 번째 수업을 기준으로 파싱하고, 나머지는 notes에 "외 N건" 형태로만 언급.
- 확신이 없으면 값은 null, confidence는 'low'.
- 상대 날짜("다음 주 화요일", "담주 수", "5/12")는 오늘 날짜 기준 YYYY-MM-DD로 변환.
- 시간은 24시간제 HH:mm. "오후 2시~3시 반" → "14:00","15:30".
- 금액은 원 단위 정수. "30만원", "30만", "300,000" 모두 300000.
- 학년은 "중1","중2","고1","초6" 같은 짧은 형식.
- 업체/강사 후보 목록이 주어지면 그 안의 이름과 먼저 매칭(부분일치 허용).
- notes 필드에는 스키마로 담지 못한 특이사항(여러 학급/반복 수업/요청사항)을 한 줄로.

## 출력 스키마
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

## 예시 1
입력:
"[진로코칭허브] 안녕하세요~ 담주 화요일(4/29) 오전 10시-11시30분
서울 양정중 1학년 진로탐색 1반 28명 강의 가능하신가요?
강사료 25만원 + 교통비 별도입니다."

출력:
{"school_name":"양정중","class_date":"2026-04-29","start_time":"10:00","end_time":"11:30","subject":"진로탐색","grade":"중1","student_count":28,"client_name_guess":"진로코칭허브","instructor_name_guess":null,"fee_guess":250000,"confidence":{"school_name":"high","class_date":"high","start_time":"high","end_time":"high","subject":"high","grade":"high","student_count":"high","client_name_guess":"high","fee_guess":"high"},"notes":"교통비 별도"}

## 예시 2
입력:
"쌤~ 5/7 수 3-4교시(11:00~12:40) 부산 해운대고 2학년 150명 대상 진로특강
섭외 가능한 선생님 계실까요? 강사료 40, 자료비 3만 포함. 이수민 선생님 어떠세요?"

출력:
{"school_name":"해운대고","class_date":"2026-05-07","start_time":"11:00","end_time":"12:40","subject":"진로특강","grade":"고2","student_count":150,"client_name_guess":null,"instructor_name_guess":"이수민","fee_guess":400000,"confidence":{"school_name":"high","class_date":"high","start_time":"high","end_time":"high","subject":"high","grade":"high","student_count":"high","instructor_name_guess":"mid","fee_guess":"high"},"notes":"자료비 3만원 포함"}

## 예시 3
입력:
"다음 달에 중학교 진로수업 하나 가능하세요?"

출력:
{"school_name":null,"class_date":null,"start_time":null,"end_time":null,"subject":"진로수업","grade":null,"student_count":null,"client_name_guess":null,"instructor_name_guess":null,"fee_guess":null,"confidence":{"subject":"mid"},"notes":"구체 정보 없음 — 추가 확인 필요"}`;
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

// Scan candidate for balanced JSON (array or object) and return the first complete one.
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
        if (escape) {
          escape = false;
        } else if (c === "\\") {
          escape = true;
        } else if (c === '"') {
          inStr = false;
        }
        continue;
      }
      if (c === '"') {
        inStr = true;
      } else if (c === opener) {
        depth++;
      } else if (c === closer) {
        depth--;
        if (depth === 0) {
          return candidate.slice(i, j + 1);
        }
      }
    }
  }
  return null;
}

// Try to parse and normalize an AI result — if the AI returned an array, take the first item.
function coerceToObject(parsed: unknown): unknown {
  if (Array.isArray(parsed)) {
    return parsed.length > 0 ? parsed[0] : {};
  }
  return parsed;
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
  const text = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n");
  return text;
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

    const validated = parseResultSchema.safeParse(coerceToObject(parsedObj));
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
