from typing import Literal

from pydantic import BaseModel, Field

Category = Literal[
    "hackathon", "internship", "placement", "workshop", "seminar", "technical",
    "cultural", "club_recruitment", "competition", "notice",
]
Mode = Literal["online", "offline", "hybrid", "unspecified"]
Priority = Literal["low", "normal", "high", "urgent"]


class Eligibility(BaseModel):
    branches: list[str] = Field(default_factory=list)
    years: list[int] = Field(default_factory=list)
    minTeamSize: int | None = None
    maxTeamSize: int | None = None
    notes: str | None = None


class ExtractedAnnouncement(BaseModel):
    """One announcement. Any field not stated in the source is null or empty. Never guessed."""

    title: str | None = None
    description: str | None = None
    category: Category | None = None
    organizerName: str | None = None
    eventStart: str | None = None
    eventEnd: str | None = None
    registrationDeadline: str | None = None
    mode: Mode | None = None
    venue: str | None = None
    onlineLink: str | None = None
    eligibility: Eligibility = Field(default_factory=Eligibility)
    requiredSkills: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    registrationUrl: str | None = None
    contactDetails: str | None = None
    additionalInstructions: str | None = None
    benefits: str | None = None
    targetAudience: str | None = None
    priority: Priority | None = None
    missingFields: list[str] = Field(default_factory=list)
    uncertainFields: list[str] = Field(default_factory=list)


class ExtractRequest(BaseModel):
    text: str = Field(min_length=10)


class ExtractResponse(BaseModel):
    provider: Literal["llm", "rules"]
    announcements: list[ExtractedAnnouncement]
    splitSuggested: bool
    notes: list[str]


class AssistantRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    records: list[dict] = Field(default_factory=list, max_length=20)


class AssistantResponse(BaseModel):
    answer: str
    provider: Literal["llm", "rules"]
