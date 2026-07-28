# In-memory session state, keyed by session_id.
# NOTE: same tradeoff as otp_service — resets on server restart and doesn't
# share across multiple backend processes. Fine for a single-instance
# deployment; move to Redis if you scale out.
_session_store: dict[str, dict] = {}


def _get(session_id: str) -> dict:
    if session_id not in _session_store:
        _session_store[session_id] = {"entities": {}, "pending_ticket": False}
    return _session_store[session_id]


def get_entities(session_id: str) -> dict:
    return _get(session_id)["entities"]


def update_entities(session_id: str, new_entities: dict) -> None:
    if new_entities:
        _get(session_id)["entities"].update(new_entities)


def is_awaiting_ticket_confirmation(session_id: str) -> bool:
    return _get(session_id)["pending_ticket"]


def set_awaiting_ticket_confirmation(session_id: str, value: bool, question: str = None) -> None:
    """When setting the pending flag True, also remember the original
    question that triggered escalation -- so when the customer later just
    replies 'yes', the ticket records what they actually asked about,
    not their confirmation reply."""
    session = _get(session_id)
    session["pending_ticket"] = value
    if value:
        session["pending_question"] = question
    else:
        session.pop("pending_question", None)


def get_pending_question(session_id: str):
    return _get(session_id).get("pending_question")