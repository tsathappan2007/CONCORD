import pytest
from app.services.negotiator import NegotiationEngine

def test_validate_value_against_constraint():
    engine = NegotiationEngine()
    
    # 1. Numeric Constraints
    num_constraint = {
        "type": "numeric",
        "walkaway_min": 100,
        "walkaway_max": 200,
        "preferred": 150
    }
    
    # Valid numeric proposals
    assert engine._validate_value_against_constraint("rate", "150", num_constraint) is True
    assert engine._validate_value_against_constraint("rate", "$120", num_constraint) is True
    assert engine._validate_value_against_constraint("rate", "200", num_constraint) is True
    assert engine._validate_value_against_constraint("rate", "100", num_constraint) is True
    
    # Invalid numeric proposals
    assert engine._validate_value_against_constraint("rate", "99", num_constraint) is False
    assert engine._validate_value_against_constraint("rate", "$205", num_constraint) is False
    assert engine._validate_value_against_constraint("rate", "invalid_number", num_constraint) is False

    # 2. Date Constraints
    date_constraint = {
        "type": "date",
        "walkaway_earliest": "2026-06-01",
        "walkaway_latest": "2026-12-31",
        "preferred": "2026-10-01"
    }
    
    # Valid date proposals
    assert engine._validate_value_against_constraint("deadline", "2026-10-15", date_constraint) is True
    assert engine._validate_value_against_constraint("deadline", "2026-06-01", date_constraint) is True
    assert engine._validate_value_against_constraint("deadline", "2026-12-31", date_constraint) is True
    
    # Invalid date proposals
    assert engine._validate_value_against_constraint("deadline", "2026-05-20", date_constraint) is False
    assert engine._validate_value_against_constraint("deadline", "2027-01-01", date_constraint) is False

    # 3. Categorical Select Constraints
    select_constraint = {
        "type": "select",
        "options": ["client", "shared", "contractor"],
        "walkaway_exclude": ["contractor", "shared"],
        "preferred": "client"
    }
    
    # Valid selection
    assert engine._validate_value_against_constraint("ip_ownership", "client", select_constraint) is True
    assert engine._validate_value_against_constraint("ip_ownership", "Client", select_constraint) is True
    
    # Excluded walk-away selections
    assert engine._validate_value_against_constraint("ip_ownership", "contractor", select_constraint) is False
    assert engine._validate_value_against_constraint("ip_ownership", "shared", select_constraint) is False

def test_detect_deadlock():
    engine = NegotiationEngine()

    # Case 1: Diverse history on different terms (No deadlock)
    logs_no_deadlock = [
        {"term": "rate", "tool_called": "counter_propose", "created_at": "2026-07-10T12:00:00Z"},
        {"term": "deadline", "tool_called": "counter_propose", "created_at": "2026-07-10T12:01:00Z"},
        {"term": "rate", "tool_called": "counter_propose", "created_at": "2026-07-10T12:02:00Z"},
        {"term": "deadline", "tool_called": "counter_propose", "created_at": "2026-07-10T12:03:00Z"}
    ]
    assert engine._detect_deadlock(logs_no_deadlock, {}) is None

    # Case 2: 4 consecutive proposal actions on the same term (Deadlock detected)
    logs_deadlock = [
        {"term": "rate", "tool_called": "counter_propose", "created_at": "2026-07-10T12:00:00Z"},
        {"term": "rate", "tool_called": "propose_term", "created_at": "2026-07-10T12:01:00Z"},
        {"term": "rate", "tool_called": "counter_propose", "created_at": "2026-07-10T12:02:00Z"},
        {"term": "rate", "tool_called": "counter_propose", "created_at": "2026-07-10T12:03:00Z"}
    ]
    # When term is not agreed, it should flag 'rate' as stuck
    assert engine._detect_deadlock(logs_deadlock, {"rate": {"status": "pending"}}) == "rate"

    # Case 3: Same history but term is already agreed (No deadlock)
    assert engine._detect_deadlock(logs_deadlock, {"rate": {"status": "agreed"}}) is None
