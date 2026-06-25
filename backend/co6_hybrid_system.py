"""
CO6: Hybrid Architectures, Explainable Reasoning & Ethics
Project: AI Based School Bus Route Optimization

This module acts as the master orchestrator, integrating:
1. CSP Scheduling (student allocation to buses).
2. A* Search (generating shortest paths between stops).
3. Bayesian Network Probabilistic Inference (delays under weather/traffic).
4. Decision Logic (Dynamic rerouting under congestion).
5. Explainable Reasoning Trace logger.
6. Failure Analysis (e.g. Bus breakdown response).
7. Ethics & Limitations check (technical biases and miscalibration).
"""

from typing import List, Dict, Set, Tuple, Optional, Any
from co1_agent_model import BusState, BusAction, STUDENT_DATA
from co2_search_algorithms import RouteSearchEngine
from co3_csp_scheduling import BusSchedulingCSP, CSPSolver
from co4_adversarial_stochastic import StochasticRoutingEngine
from co5_probabilistic_reasoning import query_variable_elimination

# =====================================================================
# 1. Master Hybrid System Orchestration
# =====================================================================

class MasterSchoolBusSystem:
    def __init__(self, capacity_limit: int = 8):
        self.capacity_limit = capacity_limit
        self.search_engine = RouteSearchEngine()
        self.trace_logs: List[str] = []

    def log_trace(self, message: str) -> None:
        self.trace_logs.append(message)
        print(f"[HYBRID MASTER] {message}")

    def run_morning_operation(self, weather: str = "Sunny", accident_reported: bool = False) -> Dict[str, Any]:
        """
        Coordinates the complete hybrid routing workflow.
        """
        self.trace_logs = []
        self.log_trace("=== Starting Morning School Bus Operation ===")
        self.log_trace(f"Environment settings: Weather = {weather}, Accident = {accident_reported}")

        # Step 1: CSP Phase - Allocate students to buses
        self.log_trace("Phase 1: Running CSP Backtracking Solver to allocate students...")
        students = []
        for stop, roster in STUDENT_DATA.items():
            for student in roster:
                students.append(student['name'])
                
        buses = ["Bus_1", "Bus_2"]
        domains = {student: list(buses) for student in students}
        
        csp = BusSchedulingCSP(variables=students, domains=domains, capacity_limit=self.capacity_limit)
        csp_solver = CSPSolver(csp)
        csp_solution = csp_solver.solve_backtracking()
        
        if not csp_solution:
            self.log_trace("CRITICAL FAILURE: CSP could not find a valid student-to-bus allocation.")
            return {"status": "Failure", "error": "CSP Failed", "logs": self.trace_logs}
            
        self.log_trace("CSP Solver completed successfully.")
        
        # Partition students and identify stops to visit for each bus
        bus_roster: Dict[str, List[str]] = {b: [] for b in buses}
        bus_stops: Dict[str, Set[str]] = {b: set() for b in buses}
        for student, bus in csp_solution.items():
            bus_roster[bus].append(student)
            # Find which stop this student belongs to
            stop_name = csp.student_stops[student]
            bus_stops[bus].add(stop_name)
            
        for bus in buses:
            self.log_trace(f"  {bus} roster ({len(bus_roster[bus])} students): {', '.join(bus_roster[bus])}")
            self.log_trace(f"  {bus} stops to visit: {', '.join(sorted(list(bus_stops[bus])))}")

        # Step 2: Probabilistic Inference - Check for potential route delays
        self.log_trace("Phase 2: Querying Bayesian Network for traffic delay predictions...")
        evidence = {"Weather": weather}
        if accident_reported:
            evidence["Accident"] = True
            
        # Eliminate: Accident (if not in evidence), RoadWork, TrafficCongestion
        eliminate_vars = ["RoadWork", "TrafficCongestion"]
        if "Accident" not in evidence:
            eliminate_vars.append("Accident")
            
        bayes_result = query_variable_elimination(
            query_var="BusDelay",
            evidence=evidence,
            eliminate_vars=eliminate_vars
        )
        # Probability of High Delay
        prob_high_delay = bayes_result.table.get((True,), 0.0)
        self.log_trace(f"  Bayesian Net Inference: Probability of High Travel Delay is {prob_high_delay*100:.1f}%")

        # Step 3: Routing (Search & Decision Logic) Phase
        self.log_trace("Phase 3: Calculating optimal routes for each bus...")
        bus_routes = {}
        
        for bus in buses:
            stops_to_visit = sorted(list(bus_stops[bus]))
            # Simple route construction: Start at Stop_A or Stop_D, visit stops, end at School
            # Let's say Bus 1 starts at Stop_A, Bus 2 starts at Stop_D
            start_node = "Stop_A" if bus == "Bus_1" else "Stop_D"
            
            # Find shortest path from start_node to school visiting stops.
            # For demonstration, we construct a sequential path: start -> stops -> School.
            # We use A* search to navigate between each segment.
            current_loc = start_node
            full_path = [current_loc]
            total_base_cost = 0.0
            
            # Visit each stop
            for next_stop in stops_to_visit:
                if next_stop == current_loc:
                    continue
                # A* segment
                astar_res = self.search_engine.run_astar(current_loc, next_stop)
                segment_path = astar_res["path"]
                if len(segment_path) > 1:
                    full_path += segment_path[1:]
                total_base_cost += astar_res["cost"]
                current_loc = next_stop
                
            # Finally, navigate to School
            astar_school = self.search_engine.run_astar(current_loc, "School")
            segment_path = astar_school["path"]
            if len(segment_path) > 1:
                full_path += segment_path[1:]
            total_base_cost += astar_school["cost"]
            
            self.log_trace(f"  Calculated Base Route for {bus}: {' -> '.join(full_path)} (Est: {total_base_cost:.1f} mins)")
            
            # Step 4: Decision Logic - evaluate dynamic rerouting under high delay probability
            actual_cost = total_base_cost
            if prob_high_delay > 0.40:
                self.log_trace(f"  [ALERT] Delay probability is high ({prob_high_delay*100:.1f}%). Triggering Decision Rerouting Logic...")
                # Apply dynamic traffic multiplier to path
                multiplier = 2.0
                actual_cost = total_base_cost * multiplier
                self.log_trace(f"  Rerouting Evaluated: Expected travel time increased to {actual_cost:.1f} mins due to congestion.")
            else:
                self.log_trace(f"  Traffic is clear. Maintaining original route.")
                
            bus_routes[bus] = {
                "roster": bus_roster[bus],
                "stops": stops_to_visit,
                "path": full_path,
                "base_duration": total_base_cost,
                "actual_duration": actual_cost
            }
            
        self.log_trace("=== Morning Operation Completed Successfully ===")
        return {
            "status": "Success",
            "weather": weather,
            "accident": accident_reported,
            "delay_probability": prob_high_delay,
            "routes": bus_routes,
            "logs": self.trace_logs
        }

# =====================================================================
# 2. Performance Engineering & Failure Analysis
# =====================================================================

class FailureRecoveryEngine:
    """
    Simulates operational failure cases (e.g. Bus breakdown) and schedules recovery.
    """
    def __init__(self, master_system: MasterSchoolBusSystem):
        self.master = master_system

    def handle_bus_breakdown(self, broken_bus: str, breakdown_node: str, active_operation: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recover from a bus breakdown: Reassign remaining students to the active bus
        and check if capacity constraints are satisfied.
        """
        self.master.log_trace(f"\n[FAILURE ALERT] {broken_bus} broke down at {breakdown_node}!")
        
        # Identify students stranded on the broken bus
        route_info = active_operation["routes"][broken_bus]
        stranded_students = route_info["roster"]
        self.master.log_trace(f"  Stranded students: {', '.join(stranded_students)}")
        
        # Active backup bus
        backup_bus = "Bus_2" if broken_bus == "Bus_1" else "Bus_1"
        backup_route_info = active_operation["routes"][backup_bus]
        backup_roster = backup_route_info["roster"]
        
        self.master.log_trace(f"  Attempting rescue with {backup_bus} (current roster size: {len(backup_roster)})...")
        
        # Check combined capacity
        total_capacity = len(backup_roster) + len(stranded_students)
        if total_capacity <= self.master.capacity_limit:
            new_roster = backup_roster + stranded_students
            self.master.log_trace(f"  [RECOVERY SUCCESS] {backup_bus} has sufficient capacity ({total_capacity}/{self.master.capacity_limit}).")
            self.master.log_trace(f"  New combined roster for {backup_bus}: {', '.join(new_roster)}")
            return {
                "recovery_status": "Success",
                "message": f"Rescue completed by {backup_bus}. All students picked up.",
                "new_roster": new_roster
            }
        else:
            self.master.log_trace(f"  [RECOVERY FAILURE] Rescue failed: combined students ({total_capacity}) would exceed {backup_bus} capacity of {self.master.capacity_limit}!")
            # Determine which students can be rescued (up to capacity limit)
            space_left = self.master.capacity_limit - len(backup_roster)
            rescued = stranded_students[:space_left]
            remaining = stranded_students[space_left:]
            self.master.log_trace(f"  Partial Rescue: {backup_bus} picked up {', '.join(rescued)}.")
            self.master.log_trace(f"  Stranded: {', '.join(remaining)} require an external dispatch vehicle.")
            return {
                "recovery_status": "Partial",
                "message": f"Partial rescue by {backup_bus}. Stranded students remain.",
                "rescued": rescued,
                "left_behind": remaining
            }

# =====================================================================
# 3. Ethics & Technical Limitations Check
# =====================================================================

def evaluate_ethics_and_limitations() -> Dict[str, Any]:
    """
    Returns an evaluation of algorithmic ethics and technical constraints.
    """
    return {
        "Heuristic Bias": (
            "A* search relies on a straight-line Euclidean distance heuristic. "
            "In real-world layouts, this ignores spatial and socioeconomic segregation: "
            "poorer outer suburbs often have lower-quality, winding road networks with more delays. "
            "Using purely geometric heuristics can systematically bias bus assignments, resulting "
            "in longer ride times and earlier pickup times for disadvantaged neighborhoods."
        ),
        "Uncertainty Calibration Errors": (
            "The Bayesian Network's predictions depend heavily on the Conditional Probability Tables (CPTs). "
            "If these CPTs are miscalibrated (e.g. estimated accident probability in rain is 20%, but actual is 45%), "
            "the system will make incorrect Expected Utility decisions. This can result in dangerous routing choices, "
            "risking school bus delays and compromised student safety."
        )
    }

# =====================================================================
# 4. Standalone Test Suite
# =====================================================================

if __name__ == "__main__":
    print("====================================================")
    print("Testing CO6: Hybrid Architecture & Recovery Systems")
    print("====================================================")
    
    # 1. Run full morning operations under Sunny Weather
    master = MasterSchoolBusSystem(capacity_limit=8)
    print("--- Sunny Scenario Run ---")
    sunny_op = master.run_morning_operation(weather="Sunny", accident_reported=False)
    
    # 2. Run operations under Rainy Weather with an Accident
    print("\n--- Rainy Scenario Run with Accident ---")
    rainy_op = master.run_morning_operation(weather="Rainy", accident_reported=True)

    # 3. Run breakdown failure recovery test
    print("\n--- Testing Failure Recovery Engine ---")
    recovery = FailureRecoveryEngine(master)
    recovery.handle_bus_breakdown("Bus_1", "Stop_B", sunny_op)

    # 4. Show Ethics and Limitations
    print("\n--- Ethics & Limitations Analysis ---")
    ethics = evaluate_ethics_and_limitations()
    for category, text in ethics.items():
        print(f"[{category}]:\n  {text}\n")
        
    print("CO6 Tests completed successfully.")
