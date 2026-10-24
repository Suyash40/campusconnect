"""Checks LLM output against the source text so that invented links or organizers are dropped."""

from app.schemas import ExtractedAnnouncement


def _appears(value: str | None, source: str) -> bool:
    return value is None or value.strip().lower() in source.lower()


def verify_against_source(item: ExtractedAnnouncement, source: str) -> tuple[ExtractedAnnouncement, list[str]]:
    dropped: list[str] = []
    for field in ("registrationUrl", "onlineLink"):
        value = getattr(item, field)
        if value and not _appears(value, source):
            setattr(item, field, None)
            dropped.append(field)
    if item.organizerName and not _appears(item.organizerName, source):
        item.organizerName = None
        dropped.append("organizerName")
    if item.venue and not _appears(item.venue, source):
        item.venue = None
        dropped.append("venue")
    if dropped:
        item.uncertainFields = sorted(set(item.uncertainFields) | set(dropped))
    return item, dropped
