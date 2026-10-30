"""Deterministic CampusBot answer built only from the records the core API retrieved."""


def rules_answer(records: list[dict]) -> str:
    if not records:
        return "Oops, I could not find anything for that one 😕 Try a different category, a date, or a club name."
    lines = [f"Here you go! I found {len(records)} {'match' if len(records) == 1 else 'matches'} for you 🙌"]
    for r in records[:8]:
        deadline = r.get("registrationDeadline")
        when = f"registration closes {deadline[:10]}" if deadline else "no registration deadline listed"
        lines.append(f"- {r.get('title', 'Untitled')} ({r.get('category', 'notice')}): {when}.")
    return "\n".join(lines)
