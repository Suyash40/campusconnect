"""
CampusConnect AI service. Called only by the core API (server), never by the browser.
Endpoints:
  POST /v1/extract    WhatsApp/announcement text -> structured announcement drafts
  POST /v1/assistant  question + DB-retrieved records -> grounded answer
  GET  /health
"""

import logging

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app.assistant import rules_answer
from app.config import get_settings
from app.extractor import extract
from app.llm import answer_with_llm, extract_with_llm, llm_configured
from app.schemas import AssistantRequest, AssistantResponse, ExtractRequest, ExtractResponse
from app.verify import verify_against_source

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("campusconnect.ai")

app = FastAPI(title="CampusConnect AI Service", version="1.0.0")


async def require_service_token(request: Request) -> None:
    token = get_settings().service_token
    if not token:
        return
    if request.headers.get("authorization") != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "llm": llm_configured()}


@app.post("/v1/extract", response_model=ExtractResponse, dependencies=[Depends(require_service_token)])
async def extract_endpoint(body: ExtractRequest) -> ExtractResponse:
    settings = get_settings()
    text = body.text[: settings.max_input_chars]
    notes: list[str] = []

    if llm_configured():
        try:
            items, llm_notes = await extract_with_llm(text, settings.reference_year)
            verified = []
            for item in items:
                item, dropped = verify_against_source(item, text)
                if dropped:
                    notes.append(f"Removed values not found in the message: {', '.join(dropped)}.")
                verified.append(item)
            return ExtractResponse(provider="llm", announcements=verified, splitSuggested=len(verified) > 1, notes=notes + llm_notes)
        except Exception:  # noqa: BLE001 - any LLM failure falls back to rules; details are logged, not returned
            log.exception("LLM extraction failed; using rule-based extraction")
            notes.append("The AI provider was unavailable, so rule-based extraction was used. Review every field.")

    items, split, rule_notes = extract(text, settings.reference_year)
    return ExtractResponse(provider="rules", announcements=items, splitSuggested=split, notes=notes + rule_notes)


@app.post("/v1/assistant", response_model=AssistantResponse, dependencies=[Depends(require_service_token)])
async def assistant_endpoint(body: AssistantRequest) -> AssistantResponse:
    if llm_configured() and body.records:
        try:
            return AssistantResponse(answer=await answer_with_llm(body.question, body.records), provider="llm")
        except Exception:  # noqa: BLE001
            log.exception("LLM assistant failed; using rule-based answer")
    return AssistantResponse(answer=rules_answer(body.records), provider="rules")


@app.exception_handler(Exception)
async def unhandled(_request: Request, _exc: Exception) -> JSONResponse:
    # Never leak stack traces or provider details to the caller.
    return JSONResponse(status_code=500, content={"detail": "AI service error"})
