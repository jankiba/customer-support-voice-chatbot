import re

# Deliberately simple regex-based extraction rather than an extra LLM call —
# fast, free, and good enough for structured references like order/ticket IDs.
_ORDER_PATTERN = re.compile(r"order\s*(?:id|number|#)?\s*[:\-]?\s*([A-Za-z0-9]{4,15})", re.IGNORECASE)
_TICKET_PATTERN = re.compile(r"ticket\s*(?:id|number|#)?\s*[:\-]?\s*(SUP-[A-Za-z0-9]{3,10}|[A-Za-z0-9]{4,15})", re.IGNORECASE)


def extract_entities(text: str) -> dict:
    """Pull structured references (order ID, ticket ID) out of a message so
    they can be remembered later in the conversation without the customer
    having to repeat themselves."""
    entities = {}

    order_match = _ORDER_PATTERN.search(text)
    if order_match:
        entities["order_id"] = order_match.group(1)

    ticket_match = _TICKET_PATTERN.search(text)
    if ticket_match:
        entities["ticket_id"] = ticket_match.group(1)

    return entities