import logging
import json
import re
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import HTTPException
from app.services.supabase_client import get_supabase_admin
from app.services.llm_orchestrator import LLMOrchestrator, AgentAction

logger = logging.getLogger("concord")

class NegotiationEngine:
    def __init__(self, llm_orchestrator: Optional[LLMOrchestrator] = None):
        self.llm_orchestrator = llm_orchestrator or LLMOrchestrator()

    def run_step(self, session_id: str) -> Dict[str, Any]:
        """
        Executes a single step in the negotiation turn-taking cycle.
        1. Loads session status, logs, agreed terms, and constraints.
        2. Validates turn.
        3. Calls primary/fallback LLM using structured prompts.
        4. Validates LLM tool call against constraints.
        5. Updates database state (logs, agreed terms, turn, round count).
        """
        supabase = get_supabase_admin()
        
        # 1. Fetch Session
        session_res = supabase.table("negotiation_sessions").select("*").eq("id", session_id).execute()
        if not session_res.data:
            raise HTTPException(status_code=404, detail="Negotiation session not found")
        session = session_res.data[0]

        if session["status"] != "negotiating":
            return {"status": session["status"], "message": "Session is not in negotiating state"}

        # Check round cap
        if session["round_count"] >= session["max_rounds"]:
            self._escalate_all_unresolved(session_id)
            return {"status": "awaiting_approval", "message": "Maximum round limit reached. Escalated to manual approval."}

        current_turn = session["current_turn"]
        if current_turn not in ["party_a", "party_b", "mediator"]:
            raise HTTPException(status_code=400, detail="Invalid current turn state")

        # 2. Fetch Constraints
        constraints_res = supabase.table("party_constraints").select("*").eq("session_id", session_id).execute()
        constraints_list = constraints_res.data
        
        party_a_c = next((c for c in constraints_list if c["role"] == "party_a"), None)
        party_b_c = next((c for c in constraints_list if c["role"] == "party_b"), None)
        
        if not party_a_c or not party_b_c:
            raise HTTPException(status_code=400, detail="Constraints for both parties must be uploaded first")

        # 3. Fetch Agreed Terms & Logs
        agreed_res = supabase.table("agreed_terms").select("*").eq("session_id", session_id).execute()
        agreed_terms = {t["term"]: t for t in agreed_res.data}
        
        logs_res = supabase.table("negotiation_logs").select("*").eq("session_id", session_id).order("created_at").execute()
        logs = logs_res.data

        # 4. Check for automatic deadlock trigger
        # If the same term has been pending for more than 3 consecutive turns without changing, auto-escalate to mediator
        deadlocked_term = self._detect_deadlock(logs, agreed_terms)
        if deadlocked_term and current_turn != "mediator":
            logger.info(f"Auto-escalating session {session_id} to mediator due to deadlock on term: {deadlocked_term}")
            current_turn = "mediator"
            supabase.table("negotiation_sessions").update({
                "current_turn": "mediator"
            }).eq("id", session_id).execute()
            
            # Log system event
            supabase.table("negotiation_logs").insert({
                "session_id": session_id,
                "round": session["round_count"],
                "sender": "system",
                "tool_called": "escalate_to_mediator",
                "term": deadlocked_term,
                "reasoning": f"System Alert: Negotiation has stalled on the term '{deadlocked_term}'. Escalating to the Neutral Mediator Agent."
            }).execute()

        # 5. Run LLM step
        if current_turn == "mediator":
            action = self._run_mediator(session, party_a_c, party_b_c, agreed_terms, logs)
        else:
            active_constraints = party_a_c if current_turn == "party_a" else party_b_c
            counter_constraints = party_b_c if current_turn == "party_a" else party_a_c
            action = self._run_party_agent(session, current_turn, active_constraints, counter_constraints, agreed_terms, logs)

        # 6. Apply Actions and database mutations
        self._apply_agent_action(session, current_turn, action, agreed_terms)
        
        # 7. Check if all terms are resolved and determine next state
        next_status, next_turn = self._determine_next_state(session_id, session, current_turn)
        
        # 8. Update Session
        round_increment = 1 if current_turn == "party_b" else 0 # End of a full turn round
        new_round_count = session["round_count"] + round_increment
        
        # Save version snapshot on significant turns
        if next_status == "awaiting_approval" or current_turn in ["party_a", "party_b"]:
            self._save_version_snapshot(session_id, new_round_count)

        supabase.table("negotiation_sessions").update({
            "status": next_status,
            "current_turn": next_turn,
            "round_count": new_round_count,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", session_id).execute()

        return {
            "status": next_status,
            "current_turn": next_turn,
            "round_count": new_round_count,
            "last_action": action.dict()
        }

    def _run_party_agent(self, session: Dict[str, Any], role: str, constraints: Dict[str, Any], counterparty: Dict[str, Any], agreed_terms: Dict[str, Any], logs: List[Dict[str, Any]]) -> AgentAction:
        """Executes a turn for Party A or Party B."""
        structured_c = constraints.get("structured_constraints", {})
        
        # Create list of terms we negotiate (union of constraints)
        negotiable_terms = list(structured_c.keys())
        
        # Compile status summary of terms
        agreed_summary = []
        pending_summary = []
        for t in negotiable_terms:
            if t in agreed_terms:
                at = agreed_terms[t]
                if at["status"] == "agreed":
                    agreed_summary.append(f"- {t}: '{at['value']}' (agreed)")
                else:
                    pending_summary.append(f"- {t}: '{at['value']}' (proposed by {at['last_modified_by']}, status: pending)")
            else:
                pending_summary.append(f"- {t}: (no proposal yet)")

        # Compile historical log text
        log_lines = []
        for entry in logs[-15:]: # Last 15 actions to fit in context window cleanly
            log_lines.append(
                f"[{entry['created_at']}] {entry['sender'].upper()} called {entry['tool_called']} "
                f"on '{entry['term'] or ''}' with value '{entry['value'] or ''}'. "
                f"Reasoning: {entry['reasoning']}"
            )
        log_text = "\n".join(log_lines) if log_lines else "No history yet."

        system_prompt = (
            f"You are CONCORD's autonomous AI negotiator representing '{role.upper()}'.\n"
            f"Your mandate is to secure a deal that aligns with your client's interests, values, and constraints. "
            f"You must negotiate in a professional, commercial manner.\n\n"
            f"CRITICAL RULES:\n"
            f"1. Protect your client's private constraints. NEVER output or disclose your client's raw limits, walk-away points, or priorities in your public reasoning. Instead, justify your positions using commercial arguments.\n"
            f"2. You are FORBIDDEN from accepting any terms that violate your client's walk-away constraints. If a counter-proposal violates your limits, you must counter-propose a value within your limits, request a concession elsewhere, or escalate.\n"
            f"3. You must execute exactly ONE tool call per turn by setting 'tool_called' to one of the following:\n"
            f"   - 'propose_term' (new terms or initiating negotiation)\n"
            f"   - 'counter_propose' (revising a pending term proposed by the other side)\n"
            f"   - 'accept_term' (agreeing to a value proposed by the other side)\n"
            f"   - 'request_concession' (compromising by adjusting one term in exchange for another)\n"
            f"   - 'escalate_to_mediator' (if deadlock is reached and no compromise satisfies your walkaway points)\n"
        )

        user_prompt = (
            f"--- NEGOTIATION CONTEXT ---\n"
            f"Session Title: {session['title']}\n"
            f"Round: {session['round_count']}/{session['max_rounds']}\n\n"
            f"--- CLIENT'S PRIVATE CONSTRAINTS ---\n"
            f"{json.dumps(structured_c, indent=2)}\n\n"
            f"--- AGREED TERMS STATE ---\n"
            f"Agreed:\n" + "\n".join(agreed_summary) + "\n"
            f"Pending:\n" + "\n".join(pending_summary) + "\n\n"
            f"--- RECENT LOG HISTORY ---\n"
            f"{log_text}\n\n"
            f"Formulate your thought process, choose your action, and return a JSON matching the AgentAction schema."
        )

        # We will loop at most 3 times to ensure the generated action does not violate constraints
        for attempt in range(3):
            action: AgentAction = self.llm_orchestrator.generate_structured(system_prompt, user_prompt, AgentAction)
            
            # Backend safety check: If agent accepted or proposed an invalid value, force retry
            if action.tool_called in ["accept_term", "propose_term", "counter_propose"]:
                val_to_check = action.value if action.tool_called == "propose_term" else action.new_value
                term_name = action.term
                
                # If term is valid, check it
                if term_name in structured_c:
                    is_valid = self._validate_value_against_constraint(term_name, val_to_check, structured_c[term_name])
                    if not is_valid:
                        logger.warning(f"AI Agent generated invalid move violating walk-away limits for term {term_name}: '{val_to_check}'. Retrying step.")
                        user_prompt += f"\n\n[SYSTEM CORRECTION]: Your previous action for '{term_name}' with value '{val_to_check}' violates your client's walk-away points. You must choose a value that satisfies the constraint or escalate."
                        continue
            
            return action

        # Fallback if AI repeatedly violates constraints: Force escalation
        logger.error(f"AI Agent failed to generate a valid action after 3 attempts. Forcing escalation to mediator.")
        return AgentAction(
            thought_process="I was unable to propose a value within my client's walk-away parameters after several attempts.",
            tool_called="escalate_to_mediator",
            stuck_on=negotiable_terms[0] if negotiable_terms else "general",
            reasoning="We have reached our walk-away threshold and cannot make further concessions on the terms. Escalating to the mediator for a compromise.",
            term=negotiable_terms[0] if negotiable_terms else "general"
        )

    def _run_mediator(self, session: Dict[str, Any], party_a_c: Dict[str, Any], party_b_c: Dict[str, Any], agreed_terms: Dict[str, Any], logs: List[Dict[str, Any]]) -> AgentAction:
        """Executes a neutral compromise turn as the Mediator."""
        party_a_struct = party_a_c.get("structured_constraints", {})
        party_b_struct = party_b_c.get("structured_constraints", {})
        
        # Find which term is currently stuck (the one that triggered escalation or the most active pending term)
        stuck_term = "general"
        for log in reversed(logs):
            if log["tool_called"] == "escalate_to_mediator" and log["term"]:
                stuck_term = log["term"]
                break
        if stuck_term == "general" or stuck_term not in party_a_struct or stuck_term not in party_b_struct:
            # Fallback to the first non-agreed term
            for term in party_a_struct:
                if term not in agreed_terms or agreed_terms[term]["status"] != "agreed":
                    stuck_term = term
                    break

        system_prompt = (
            f"You are CONCORD's neutral Mediator Agent.\n"
            f"Your job is to analyze the positions of Party A and Party B on the term '{stuck_term}' and propose a creative, fair, compromise value.\n\n"
            f"CRITICAL COMPROMISE RULES:\n"
            f"1. You have access to BOTH parties' private constraints for '{stuck_term}' below. You must design a compromise value that strictly satisfies BOTH parties' walk-away limits.\n"
            f"2. If a common compromise range is mathematically impossible (i.e. Party A's walk-away is strictly higher than Party B's walk-away, or vice versa with no overlap), you must select 'escalate_to_mediator' tool. This marks the term as unresolved so the human users can settle it manually.\n"
            f"3. Otherwise, propose the compromise value by setting 'tool_called' to 'propose_term' and provide balanced, commercial reasoning that respects both sides.\n"
        )

        user_prompt = (
            f"--- NEGOTIATION CONTEXT ---\n"
            f"Stuck Term: {stuck_term}\n\n"
            f"--- PARTY A PRIVATE CONSTRAINTS ---\n"
            f"{json.dumps(party_a_struct.get(stuck_term, {}), indent=2)}\n\n"
            f"--- PARTY B PRIVATE CONSTRAINTS ---\n"
            f"{json.dumps(party_b_struct.get(stuck_term, {}), indent=2)}\n\n"
            f"--- RECENT LOG HISTORY ---\n"
            f"{json.dumps(logs[-10:], indent=2)}\n\n"
            f"Determine the best compromise value and return the structured action JSON matching the AgentAction schema."
        )

        action: AgentAction = self.llm_orchestrator.generate_structured(system_prompt, user_prompt, AgentAction)
        
        # Verify mediator output is safe
        if action.tool_called == "propose_term":
            val = action.value
            is_ok_a = self._validate_value_against_constraint(stuck_term, val, party_a_struct.get(stuck_term, {}))
            is_ok_b = self._validate_value_against_constraint(stuck_term, val, party_b_struct.get(stuck_term, {}))
            if not (is_ok_a and is_ok_b):
                logger.warning(f"Mediator proposed invalid compromise '{val}' which violates walk-away points. Forcing manual escalation.")
                return AgentAction(
                    thought_process="No overlapping mathematical compromise could be found that complies with both parties' walk-away constraints.",
                    tool_called="escalate_to_mediator",
                    stuck_on=stuck_term,
                    reasoning=f"The mediator could not identify an overlapping compromise for '{stuck_term}' that respects both parties' walk-away constraints. This term is marked unresolved for manual human intervention.",
                    term=stuck_term
                )
        
        return action

    def _validate_value_against_constraint(self, term_name: str, value: str, constraint: Dict[str, Any]) -> bool:
        """Validates if value is within constraints limits. Returns True if valid, False if it violates walk-away."""
        if not constraint or not value:
            return True
            
        c_type = constraint.get("type", "text")
        
        if c_type == "numeric":
            try:
                # Clean numeric value (strip currency, commas)
                val = float(re.sub(r"[^\d\.]", "", value))
                walkaway_min = constraint.get("walkaway_min")
                walkaway_max = constraint.get("walkaway_max")
                
                if walkaway_min is not None and val < float(walkaway_min):
                    return False
                if walkaway_max is not None and val > float(walkaway_max):
                    return False
            except Exception:
                return False
                
        elif c_type == "date":
            try:
                val = datetime.strptime(value.strip(), "%Y-%m-%d")
                walkaway_earliest = constraint.get("walkaway_earliest")
                walkaway_latest = constraint.get("walkaway_latest")
                
                if walkaway_earliest:
                    w_earliest = datetime.strptime(walkaway_earliest.strip(), "%Y-%m-%d")
                    if val < w_earliest:
                        return False
                if walkaway_latest:
                    w_latest = datetime.strptime(walkaway_latest.strip(), "%Y-%m-%d")
                    if val > w_latest:
                        return False
            except Exception:
                # If date format parsing fails, default to True (don't block negotiation on minor text formats)
                return True
                
        elif c_type == "select" or c_type == "text":
            walkaway_exclude = constraint.get("walkaway_exclude", [])
            if not isinstance(walkaway_exclude, list):
                walkaway_exclude = [walkaway_exclude]
            if value.strip().lower() in [str(x).strip().lower() for x in walkaway_exclude]:
                return False
                
        return True

    def _apply_agent_action(self, session: Dict[str, Any], role: str, action: AgentAction, agreed_terms: Dict[str, Any]):
        """Saves LLM action output into negotiation logs and updates agreed_terms."""
        supabase = get_supabase_admin()
        session_id = session["id"]
        round_no = session["round_count"]

        # Insert log entry
        log_entry = {
            "session_id": session_id,
            "round": round_no,
            "sender": role,
            "tool_called": action.tool_called,
            "term": action.term or action.stuck_on,
            "value": action.value or action.new_value or action.give_up,
            "reasoning": action.reasoning
        }
        supabase.table("negotiation_logs").insert(log_entry).execute()

        # Update agreed terms
        if action.tool_called == "accept_term" and action.term:
            term = action.term
            # Get current pending value
            if term in agreed_terms:
                val = agreed_terms[term]["value"]
                supabase.table("agreed_terms").upsert({
                    "session_id": session_id,
                    "term": term,
                    "value": val,
                    "status": "agreed",
                    "last_modified_by": role,
                    "version": agreed_terms[term]["version"] + 1,
                    "updated_at": datetime.utcnow().isoformat()
                }).execute()
                
        elif action.tool_called in ["propose_term", "counter_propose"] and action.term:
            term = action.term
            val = action.value if action.tool_called == "propose_term" else action.new_value
            current_ver = agreed_terms[term]["version"] if term in agreed_terms else 0
            
            supabase.table("agreed_terms").upsert({
                "session_id": session_id,
                "term": term,
                "value": val,
                "status": "pending",
                "last_modified_by": role,
                "version": current_ver + 1,
                "updated_at": datetime.utcnow().isoformat()
            }).execute()

        elif action.tool_called == "escalate_to_mediator":
            term = action.stuck_on or action.term
            if term and term in agreed_terms:
                supabase.table("agreed_terms").update({
                    "status": "unresolved",
                    "last_modified_by": role,
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("session_id", session_id).eq("term", term).execute()

    def _determine_next_state(self, session_id: str, session: Dict[str, Any], current_turn: str) -> tuple:
        """Determines the next session status and current turn."""
        supabase = get_supabase_admin()
        
        # Check agreed terms status
        agreed_res = supabase.table("agreed_terms").select("*").eq("session_id", session_id).execute()
        terms = agreed_res.data
        
        # Verify constraints terms union size to check if we've addressed everything
        constraints_res = supabase.table("party_constraints").select("*").eq("session_id", session_id).execute()
        p_a_keys = set(next((c["structured_constraints"] for c in constraints_res.data if c["role"] == "party_a"), {}).keys())
        p_b_keys = set(next((c["structured_constraints"] for c in constraints_res.data if c["role"] == "party_b"), {}).keys())
        all_terms = p_a_keys | p_b_keys

        # Check if all terms have been negotiated and agreed
        addressed_terms = {t["term"] for t in terms}
        all_agreed = len(addressed_terms) >= len(all_terms) and all(t["status"] == "agreed" for t in terms)
        
        # Check if any term is unresolved/deadlocked
        has_unresolved = any(t["status"] == "unresolved" for t in terms)

        # If everything is agreed, move to approval
        if all_agreed:
            return "awaiting_approval", "none"

        # Turn sequence logic:
        # party_a -> party_b -> party_a (if no mediator escalation)
        # If mediator proposes, the next turn passes back to the party who did NOT trigger mediator, or just default to party_a/party_b alternations
        if current_turn == "party_a":
            # If mediator escalated, it goes to mediator. Otherwise, party_b.
            # (Note: _apply_agent_action already handles if mediator was triggered explicitly, which updates session.current_turn to 'mediator')
            # Let's check the database state for current_turn to see if it was mutated
            session_now = supabase.table("negotiation_sessions").select("current_turn").eq("id", session_id).execute().data[0]
            if session_now["current_turn"] == "mediator":
                return "negotiating", "mediator"
            return "negotiating", "party_b"
            
        elif current_turn == "party_b":
            session_now = supabase.table("negotiation_sessions").select("current_turn").eq("id", session_id).execute().data[0]
            if session_now["current_turn"] == "mediator":
                return "negotiating", "mediator"
            return "negotiating", "party_a"
            
        elif current_turn == "mediator":
            # Mediator completed. Pass turn back to party_a to review/counter the mediator's compromise
            return "negotiating", "party_a"

        return "negotiating", "party_a"

    def _detect_deadlock(self, logs: List[Dict[str, Any]], agreed_terms: Dict[str, Any]) -> Optional[str]:
        """Detects if a term has been stuck in counter-proposals for 3 consecutive rounds."""
        if len(logs) < 4:
            return None

        # Check the last 4 log entries
        recent = logs[-4:]
        terms = [entry.get("term") for entry in recent]
        tools = [entry.get("tool_called") for entry in recent]
        
        # If the same term is involved and the tools are all counter_propose or propose_term
        if len(set(terms)) == 1 and terms[0] is not None:
            term = terms[0]
            if all(t in ["counter_propose", "propose_term"] for t in tools):
                # Verify that it is not already resolved/agreed
                if term in agreed_terms and agreed_terms[term]["status"] != "agreed":
                    return term

        return None

    def _escalate_all_unresolved(self, session_id: str):
        """Marks all pending terms as unresolved on round limit expiry."""
        supabase = get_supabase_admin()
        
        # Log system event
        supabase.table("negotiation_logs").insert({
            "session_id": session_id,
            "round": 12,
            "sender": "system",
            "tool_called": "system_end",
            "reasoning": "Round limit (12) exceeded. Negotiation terminated. All unresolved terms are escalated to human final review."
        }).execute()
        
        # Update agreed terms
        supabase.table("agreed_terms").update({
            "status": "unresolved"
        }).eq("session_id", session_id).eq("status", "pending").execute()
        
        supabase.table("negotiation_sessions").update({
            "status": "awaiting_approval",
            "current_turn": "none"
        }).eq("id", session_id).execute()

    def _save_version_snapshot(self, session_id: str, round_no: int):
        """Creates a version history entry for the negotiation progression."""
        supabase = get_supabase_admin()
        
        # Get agreed terms snapshot
        terms_res = supabase.table("agreed_terms").select("*").eq("session_id", session_id).execute()
        terms_data = terms_res.data
        
        # Find current highest version in agreement_versions
        ver_res = supabase.table("agreement_versions").select("version").eq("session_id", session_id).order("version", desc=True).limit(1).execute()
        next_ver = 1
        if ver_res.data:
            next_ver = ver_res.data[0]["version"] + 1

        # Retrieve session creator or default to first party
        session_res = supabase.table("negotiation_sessions").select("creator_id").eq("id", session_id).execute()
        creator_id = session_res.data[0]["creator_id"]

        supabase.table("agreement_versions").insert({
            "session_id": session_id,
            "version": next_ver,
            "terms_snapshot": terms_data,
            "created_by": creator_id,
            "status": "draft"
        }).execute()
