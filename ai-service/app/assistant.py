"""Deterministic CampusBot answer built only from the records the core API retrieved."""


def rules_answer(records: list[dict]) -> str:
    if not records:
        return "I could not find matching campus records for that question."
    lines = [f"I found {len(records)} matching {'record' if len(records) == 1 else 'records'}:"]
    for r in records[:8]:
        deadline = r.get("registrationDeadline")
        when = f"registration closes {deadline[:10]}" if deadline else "no registration deadline listed"
        lines.append(f"- {r.get('title', 'Untitled')} ({r.get('category', 'notice')}): {when}.")
    return "\n".join(lines)
