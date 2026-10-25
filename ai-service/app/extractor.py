"""
Rule-based extraction from a pasted announcement message.

Design rules:
- Only values that appear in the source text are returned. Missing values stay None or empty.
- Ambiguous values (numeric dates, years not stated, several categories) are listed in uncertainFields.
- The message is treated as data. Nothing in it is executed or interpreted as an instruction.
"""

import re
from datetime import date, datetime, timedelta, timezone

from app.schemas import Category, ExtractedAnnouncement, Eligibility

IST = timezone(timedelta(hours=5, minutes=30))

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}
MONTH_RE = r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"

# Ordered: earlier patterns win when a message mentions several categories.
CATEGORY_KEYWORDS: list[tuple[Category, str]] = [
    ("internship", r"\binternship"),
    ("placement", r"\bplacement|\bpool campus|\bhiring drive|\brecruitment drive"),
    ("hackathon", r"\bhackathon"),
    ("competition", r"\bcompetition|\bcontest|\bquiz\b|\bctf\b"),
    ("workshop", r"\bworkshop"),
    ("seminar", r"\bseminar|\bwebinar|\bguest lecture|\btalk\b"),
    ("club_recruitment", r"\bclub recruitment|\brecruitment for|\bjoin (?:us|our)\b|\bopen for applications"),
    ("cultural", r"\bcultural|\bfest\b|\bdance\b|\bmusic\b|\bdrama\b"),
    ("technical", r"\btechnical|\bcoding|\bprogramming"),
    ("notice", r"\bnotice\b|\bcircular\b|\bimportant announcement"),
]

BRANCH_PATTERNS: list[tuple[str, str]] = [
    ("AI & ML", r"\bai\s*(?:&|and|/)\s*ml\b|\baiml\b|\bai/ml\b"),
    ("CSE", r"\bcse\b|\bcomputer science"),
    ("IT", r"\bit branch\b|\binformation technology\b"),
    ("ECE", r"\bece\b|\belectronics and communication"),
    ("EEE", r"\beee\b|\belectrical and electronics"),
    ("Mechanical", r"\bmechanical\b|\bme branch\b"),
    ("Civil", r"\bcivil\b"),
]

SKILL_KEYWORDS = [
    "python", "java", "c++", "javascript", "typescript", "react", "node.js", "sql", "machine learning",
    "deep learning", "data science", "figma", "ui/ux", "flutter", "android", "aws", "docker", "git",
]

URL_RE = re.compile(r"https?://[^\s<>\"']+")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"(?:\+?\d{1,3}[\s-]?)?\b\d{10}\b")
NUMERIC_DATE_RE = re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b")
TEXT_DATE_RE = re.compile(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?{MONTH_RE}\b(?:,?\s+(\d{{4}}))?", re.I)
TEXT_DATE_RE_ALT = re.compile(rf"\b{MONTH_RE}\s+(\d{{1,2}})(?:st|nd|rd|th)?\b(?:,?\s+(\d{{4}}))?", re.I)
DEADLINE_RE = re.compile(r"registration|register|deadline|closes|closing|last date|apply by|applications? close", re.I)


def _month_number(token: str) -> int:
    return MONTHS[token[:3].lower()]


def _iso_date(day: int, month: int, year: int) -> str | None:
    try:
        return datetime(year, month, day, tzinfo=IST).isoformat()
    except ValueError:
        return None


def _find_dates(sentence: str, reference_year: int) -> list[tuple[str, bool]]:
    """Returns (iso, year_assumed) for each date found in a sentence, in order of appearance."""
    found: list[tuple[int, str, bool]] = []
    for m in TEXT_DATE_RE.finditer(sentence):
        day, month, year = int(m.group(1)), _month_number(m.group(2)), m.group(3)
        iso = _iso_date(day, month, int(year) if year else reference_year)
        if iso:
            found.append((m.start(), iso, year is None))
    for m in TEXT_DATE_RE_ALT.finditer(sentence):
        month, day, year = _month_number(m.group(1)), int(m.group(2)), m.group(3)
        iso = _iso_date(day, month, int(year) if year else reference_year)
        if iso and not any(abs(m.start() - f[0]) < 3 for f in found):
            found.append((m.start(), iso, year is None))
    return [(iso, assumed) for _, iso, assumed in sorted(found)]


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [p.strip() for p in parts if p.strip()]


def _category(text: str) -> tuple[Category | None, bool]:
    hits = [c for c, pattern in CATEGORY_KEYWORDS if re.search(pattern, text, re.I)]
    # "technical" is a broad word ("coding hackathon"), so it only counts when nothing more specific matched.
    specific = [c for c in hits if c != "technical"]
    if specific:
        return specific[0], len(specific) > 1
    if hits:
        return hits[0], False
    return None, False


def _years(text: str) -> list[int]:
    words = {"first": 1, "second": 2, "third": 3, "fourth": 4, "1st": 1, "2nd": 2, "3rd": 3, "4th": 4}
    found: set[int] = set()
    rng = re.search(r"\b([1-4])(?:st|nd|rd|th)?\s*(?:to|-)\s*([1-4])(?:st|nd|rd|th)?\s*years?", text, re.I)
    if rng:
        found.update(range(int(rng.group(1)), int(rng.group(2)) + 1))
    for m in re.finditer(r"\b(first|second|third|fourth|1st|2nd|3rd|4th)\b(?:\s+(?:and|or|&|,)\s+(first|second|third|fourth|1st|2nd|3rd|4th))?\s+years?", text, re.I):
        found.add(words[m.group(1).lower()])
        if m.group(2):
            found.add(words[m.group(2).lower()])
    for m in re.finditer(r"\b([1-4])(?:st|nd|rd|th)\s+years?\b", text, re.I):
        found.add(int(m.group(1)))
    return sorted(found)


def _team_size(text: str) -> tuple[int | None, int | None]:
    m = re.search(r"teams?\s+of\s+(\d)(?:\s*(?:to|-)\s*(\d))?", text, re.I)
    if m:
        return int(m.group(1)), int(m.group(2) or m.group(1))
    m = re.search(r"(?:maximum|max\.?)\s+(\d)\s+members", text, re.I)
    if m:
        return None, int(m.group(1))
    return None, None


CATEGORY_LABELS: dict[str, str] = {
    "hackathon": "Hackathon",
    "internship": "Internship",
    "placement": "Placement Drive",
    "workshop": "Workshop",
    "seminar": "Seminar",
    "technical": "Technical Event",
    "cultural": "Cultural Event",
    "club_recruitment": "Recruitment",
    "competition": "Competition",
    "notice": "Notice",
}

EXPLICIT_TITLE_RE = re.compile(r"^\s*(?:title|event(?: name)?|name of (?:the )?event)\s*[:\-]\s*(.+?)\s*$", re.I | re.M)


def _title(text: str, category: Category | None, organizer: str | None) -> tuple[str | None, bool]:
    """Returns (title, generated). A labelled title in the message is used as written. Otherwise the title is built from the organizer and category, and flagged as uncertain."""
    m = EXPLICIT_TITLE_RE.search(text)
    if m:
        return m.group(1)[:120], False
    if not category:
        return None, False
    label = CATEGORY_LABELS[category]
    if organizer:
        name = re.sub(r"^the\s+", "", organizer, flags=re.I).strip()
        return f"{name} {label}"[:120], True
    return label, True


def extract_one(text: str, reference_year: int) -> ExtractedAnnouncement:
    sentences = _sentences(text)
    uncertain: set[str] = set()
    notes_for_fields: list[str] = []

    category, ambiguous_category = _category(text)
    if ambiguous_category:
        uncertain.add("category")

    # Organizer: "The X Club is organizing ...", "organised by X", "hosted by X"
    organizer = None
    m = re.search(r"\b(?:the\s+)?([A-Z][\w&'.-]*(?:\s+[A-Z&][\w&'.-]*){0,4})\s+(?:is|are)\s+(?:organi[sz]ing|hosting|conducting|presenting)", text)
    if m:
        organizer = m.group(1).strip()
    else:
        m = re.search(r"(?:organi[sz]ed|hosted|presented|conducted)\s+by\s+(?:the\s+)?([A-Z][\w&'.-]*(?:\s+[A-Z&][\w&'.-]*){0,4})", text)
        if m:
            organizer = m.group(1).strip()

    # Dates
    deadline_iso = None
    event_iso = None
    event_end = None
    for s in sentences:
        dates = _find_dates(s, reference_year)
        if not dates:
            continue
        if DEADLINE_RE.search(s) and deadline_iso is None:
            deadline_iso, assumed = dates[0]
            if assumed:
                uncertain.add("registrationDeadline")
        elif event_iso is None and not DEADLINE_RE.search(s):
            event_iso, assumed = dates[0]
            if assumed:
                uncertain.add("eventStart")
            if len(dates) > 1:
                event_end = dates[1][0]
    if NUMERIC_DATE_RE.search(text):
        uncertain.update({"eventStart", "registrationDeadline"})
        notes_for_fields.append("Numeric date format (for example 05/06/2026) may be ambiguous. Check day and month.")

    # URLs: a link on the same line as "register" is the registration URL; otherwise a meeting link.
    urls = [u.rstrip(".,);]") for u in URL_RE.findall(text)]
    registration_url = None
    online_link = None
    for s in sentences:
        for u in URL_RE.findall(s):
            clean = u.rstrip(".,);]")
            if re.search(r"register|form|apply|signup|sign up", s, re.I) and registration_url is None:
                registration_url = clean
            elif re.search(r"meet\.google|zoom|teams\.microsoft|meeting|join", s, re.I) and online_link is None:
                online_link = clean
    if registration_url is None and len(urls) == 1 and online_link is None:
        uncertain.add("registrationUrl")
        registration_url = urls[0]

    # Mode
    online = bool(re.search(r"\bonline\b|\bvirtual\b|zoom|google meet|\bmeet\.google", text, re.I))
    offline = bool(re.search(r"\boffline\b|in[- ]person|\bvenue\b|\bhall\b|\bauditorium\b|\blab\b|\bblock\b", text, re.I))
    mode = "hybrid" if online and offline else "online" if online else "offline" if offline else None

    venue = None
    vm = re.search(r"(?:venue|location|held at|will be held at)\s*[:\-]?\s*((?:the\s+)?[A-Z][\w\- ]{2,50}?(?:Hall|Lab|Block|Auditorium|Room|Ground|Campus|Library))", text)
    if vm:
        venue = vm.group(1).strip()

    # Eligibility
    branches = [name for name, pattern in BRANCH_PATTERNS if re.search(pattern, text, re.I)]
    years = _years(text)
    min_team, max_team = _team_size(text)
    eligibility = Eligibility(
        branches=branches,
        years=years,
        minTeamSize=min_team,
        maxTeamSize=max_team,
        notes=None,
    )

    skills = [s for s in SKILL_KEYWORDS if re.search(rf"\b{re.escape(s)}\b", text, re.I)]

    contact = None
    email = EMAIL_RE.search(text)
    phone = PHONE_RE.search(text)
    if email or phone:
        contact = ", ".join(x.group(0) for x in (email, phone) if x)

    benefits = next((s for s in sentences if re.search(r"certificate|prize|stipend|cash|goodies|reward|₹|rs\.?\s?\d", s, re.I)), None)
    title, title_generated = _title(text, category, organizer)
    if title_generated:
        uncertain.add("title")
    description = text.strip()[:2000]

    tags = sorted({c for c in [category] if c} | set(skills[:3]))
    priority = "urgent" if re.search(r"\burgent\b|\basap\b|\bimmediately\b", text, re.I) else None

    result = ExtractedAnnouncement(
        title=title,
        description=description,
        category=category,
        organizerName=organizer,
        eventStart=event_iso,
        eventEnd=event_end,
        registrationDeadline=deadline_iso,
        mode=mode,
        venue=venue,
        onlineLink=online_link,
        eligibility=eligibility,
        requiredSkills=skills,
        tags=tags,
        registrationUrl=registration_url,
        contactDetails=contact,
        benefits=benefits,
        priority=priority,
    )
    if notes_for_fields:
        result.additionalInstructions = " ".join(notes_for_fields)

    missing = []
    if not result.title:
        missing.append("title")
    if not result.category:
        missing.append("category")
    if not result.organizerName:
        missing.append("organizerName")
    if not result.eventStart:
        missing.append("eventStart")
    if not result.registrationDeadline:
        missing.append("registrationDeadline")
    if not result.registrationUrl:
        missing.append("registrationUrl")
    if not branches and not years:
        missing.append("eligibility")
    result.missingFields = missing
    result.uncertainFields = sorted(uncertain)
    return result


def split_segments(text: str) -> list[str]:
    """Splits a message with several separated opportunities (blank lines or numbered/bulleted items)."""
    chunks = re.split(r"\n\s*\n|\n(?=\s*(?:\d+[.)]|[-*•])\s)", text)
    return [c.strip() for c in chunks if c.strip()]


def extract(text: str, reference_year: int) -> tuple[list[ExtractedAnnouncement], bool, list[str]]:
    notes: list[str] = []
    segments = split_segments(text)
    candidates = [s for s in segments if _category(s)[0] and _find_dates(s, reference_year)]
    if len(candidates) > 1:
        notes.append(f"This message appears to contain {len(candidates)} opportunities. Review each one separately.")
        return [extract_one(c, reference_year) for c in candidates[:5]], True, notes
    return [extract_one(text, reference_year)], False, notes
