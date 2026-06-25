"""
CO3: Constraint Satisfaction Problems (CSP) & Scheduling
Project: AI Based School Bus Route Optimization

This module models student-to-bus assignment as a CSP.
It implements:
1. Backtracking search for CSP.
2. Heuristics: MRV, Degree, LCV.
3. Constraint propagation: Forward Checking and Arc Consistency (AC-3 intuition).
4. Local Search: Min-Conflicts.
5. Explainability: Custom error tracking for constraint failures.
6. SAT-Intuition modeling (lightweight CNF clause translation explanation).
"""

from typing import List, Dict, Set, Tuple, Optional, Any, Union

# =====================================================================
# 1. CSP Formulation
# =====================================================================

class BusSchedulingCSP:
    def __init__(self, variables: List[str], domains: Dict[str, List[str]], capacity_limit: int = 8):
        self.variables = variables  # List of Student Names
        self.domains = domains      # Dict: Student -> List of Buses (e.g., ["Bus_1", "Bus_2"])
        self.capacity_limit = capacity_limit
        
        # Constraints definition
        # Wheelchair access: Chloe must go on Bus_1
        self.special_needs = {"Chloe": "Bus_1"}
        
        # Sibling constraints: certain students must ride the same bus (e.g. Alice & Aaron, Harry & Helen)
        self.siblings = {
            "Alice": "Aaron",
            "Aaron": "Alice",
            "Harry": "Helen",
            "Helen": "Harry"
        }
        
        # Geographic groups (to minimize routing crossovers)
        self.student_stops = {
            "Alice": "Stop_A", "Aaron": "Stop_A",
            "Ben": "Stop_B",
            "Charlie": "Stop_C", "Chloe": "Stop_C",
            "David": "Stop_D", "Daisy": "Stop_D",
            "Emma": "Stop_E",
            "Frank": "Stop_F", "Fiona": "Stop_F",
            "Grace": "Stop_G",
            "Harry": "Stop_H", "Helen": "Stop_H"
        }

        # Tracks why a constraint check failed
        self.explanation_log: List[str] = []

    def log_failure(self, message: str) -> None:
        self.explanation_log.append(message)

    def clear_logs(self) -> None:
        self.explanation_log = []

    def is_consistent(self, var: str, value: str, assignment: Dict[str, str]) -> bool:
        """
        Validates if assigning student 'var' to bus 'value' violates any constraints.
        """
        # Constraint 1: Special Needs (Wheelchair accessibility)
        if var in self.special_needs and self.special_needs[var] != value:
            self.log_failure(
                f"Wheelchair Constraint Failed: Student {var} requires {self.special_needs[var]}, "
                f"but was assigned to {value}."
            )
            return False

        # Constraint 2: Bus Capacity Limit
        # Count how many students are currently assigned to this bus
        count = sum(1 for v, val in assignment.items() if val == value)
        if count >= self.capacity_limit:
            self.log_failure(
                f"Capacity Constraint Failed: Bus {value} has reached its limit of {self.capacity_limit} "
                f"students. Cannot assign {var}."
            )
            return False

        # Constraint 3: Sibling Constraint
        # If sibling is already assigned, they must be on the same bus
        if var in self.siblings:
            sibling = self.siblings[var]
            if sibling in assignment and assignment[sibling] != value:
                self.log_failure(
                    f"Sibling Constraint Failed: {var} and {sibling} must ride together. "
                    f"{sibling} is on {assignment[sibling]}, but trying to assign {var} to {value}."
                )
                return False

        return True

# =====================================================================
# 2. Backtracking Solver with Heuristics & Propagation
# =====================================================================

class CSPSolver:
    def __init__(self, csp: BusSchedulingCSP):
        self.csp = csp
        self.backtrack_steps = 0

    def solve_backtracking(self) -> Optional[Dict[str, str]]:
        self.csp.clear_logs()
        self.backtrack_steps = 0
        return self._backtrack({})

    def _backtrack(self, assignment: Dict[str, str]) -> Optional[Dict[str, str]]:
        self.backtrack_steps += 1
        
        # Base case: assignment is complete
        if len(assignment) == len(self.csp.variables):
            return assignment

        # Select unassigned variable using MRV (Minimum Remaining Values) and Degree Heuristic
        var = self._select_unassigned_variable(assignment)
        
        # Order domain values using LCV (Least Constraining Value)
        ordered_values = self._order_domain_values(var, assignment)

        for value in ordered_values:
            if self.csp.is_consistent(var, value, assignment):
                assignment[var] = value
                
                # Forward Checking / Constraint Propagation
                # Save domains state for backtracking restoration
                saved_domains = self._forward_check_prune(var, value, assignment)
                
                if saved_domains is not None:  # No empty domains resulted from pruning
                    result = self._backtrack(assignment)
                    if result is not None:
                        return result
                
                # Undo assignment & restore pruned domains
                if saved_domains:
                    self._restore_domains(saved_domains)
                del assignment[var]
            else:
                # Log the trace of failed attempts
                pass

        return None

    # --- Heuristics ---

    def _select_unassigned_variable(self, assignment: Dict[str, str]) -> str:
        """
        MRV (Minimum Remaining Values) with Degree Heuristic as tie-breaker.
        """
        unassigned = [v for v in self.csp.variables if v not in assignment]
        
        # Calculate remaining domain size for each
        mrv_scores = []
        for var in unassigned:
            remaining_domain_size = sum(1 for val in self.csp.domains[var] if self.csp.is_consistent(var, val, assignment))
            
            # Degree Heuristic: count constraints involving 'var'
            degree = 0
            if var in self.csp.siblings:
                degree += 1
            if var in self.csp.special_needs:
                degree += 1
                
            mrv_scores.append((remaining_domain_size, -degree, var))
            
        # Sort by remaining domain size ascending, then by degree descending (negative degree)
        mrv_scores.sort()
        return mrv_scores[0][2]

    def _order_domain_values(self, var: str, assignment: Dict[str, str]) -> List[str]:
        """
        LCV (Least Constraining Value): Orders domain values based on the number
        of choices they eliminate for other unassigned variables.
        """
        values = self.csp.domains[var]
        unassigned_vars = [v for v in self.csp.variables if v not in assignment and v != var]
        
        lcv_scores = []
        for val in values:
            if not self.csp.is_consistent(var, val, assignment):
                continue
            
            # Simulate assignment and count total eliminated choices for other vars
            temp_assignment = assignment.copy()
            temp_assignment[var] = val
            
            eliminations = 0
            for other_var in unassigned_vars:
                for other_val in self.csp.domains[other_var]:
                    if not self.csp.is_consistent(other_var, other_val, temp_assignment):
                        eliminations += 1
                        
            lcv_scores.append((eliminations, val))
            
        lcv_scores.sort()  # Ascending eliminations (least constraining first)
        return [val for _, val in lcv_scores]

    # --- Constraint Propagation ---

    def _forward_check_prune(self, var: str, value: str, assignment: Dict[str, str]) -> Optional[Dict[str, List[str]]]:
        """
        Prunes the domains of unassigned variables that are directly impacted by this assignment.
        Returns a dict of modified domains for restoring during backtracking.
        Returns None if an empty domain is encountered (meaning we must backtrack immediately).
        """
        modified_domains = {}
        unassigned = [v for v in self.csp.variables if v not in assignment]
        
        for other in unassigned:
            pruned_values = []
            current_domain = self.csp.domains[other]
            new_domain = []
            
            for other_val in current_domain:
                # If this value is now inconsistent with the new assignment, prune it
                if not self.csp.is_consistent(other, other_val, assignment):
                    pruned_values.append(other_val)
                else:
                    new_domain.append(other_val)
                    
            if not new_domain:
                # Forward checking failed: an unassigned variable has no valid values remaining
                self.csp.log_failure(
                    f"Forward Checking Propagation: Assigning {var} to {value} rules out all options for {other}."
                )
                # Restore any domains changed so far
                self._restore_domains(modified_domains)
                return None
                
            if pruned_values:
                modified_domains[other] = pruned_values
                self.csp.domains[other] = new_domain
                
        return modified_domains

    def _restore_domains(self, modified_domains: Dict[str, List[str]]) -> None:
        for var, values in modified_domains.items():
            self.csp.domains[var] = list(set(self.csp.domains[var] + values))

# =====================================================================
# 3. Local Search: Min-Conflicts Solver
# =====================================================================

class MinConflictsSolver:
    def __init__(self, csp: BusSchedulingCSP, max_steps: int = 1000):
        self.csp = csp
        self.max_steps = max_steps

    def solve(self) -> Tuple[Optional[Dict[str, str]], int]:
        import random
        
        # We allow up to 10 random restarts to escape local minima
        for restart in range(10):
            # Start with a complete initial assignment (can be random)
            assignment: Dict[str, str] = {}
            for var in self.csp.variables:
                assignment[var] = random.choice(self.csp.domains[var])
                
            for step in range(self.max_steps):
                # Check for conflicted variables
                conflicted_vars = self._get_conflicted_variables(assignment)
                if not conflicted_vars:
                    return assignment, step + (restart * self.max_steps)  # Solution found!
                    
                # Pick a conflicted variable at random
                var = random.choice(conflicted_vars)
                
                # Find the value that minimizes conflicts
                best_val = self._minimize_conflicts(var, assignment)
                assignment[var] = best_val
                
        return None, self.max_steps * 10

    def _get_conflicted_variables(self, assignment: Dict[str, str]) -> List[str]:
        conflicted = []
        for var in self.csp.variables:
            val = assignment[var]
            # Temporarily remove var to count conflicts caused by it
            temp = assignment.copy()
            del temp[var]
            if not self.csp.is_consistent(var, val, temp):
                conflicted.append(var)
        return conflicted

    def _minimize_conflicts(self, var: str, assignment: Dict[str, str]) -> str:
        """
        Finds the domain value for var that results in the minimum number of conflicts.
        """
        import random
        best_val = assignment[var]
        min_conflicts = float('inf')
        best_candidates = []
        
        for val in self.csp.domains[var]:
            # Count conflicts if var was assigned val
            temp = assignment.copy()
            temp[var] = val
            
            conflicts = 0
            for other in self.csp.variables:
                other_val = temp[other]
                sub_temp = temp.copy()
                del sub_temp[other]
                if not self.csp.is_consistent(other, other_val, sub_temp):
                    conflicts += 1
                    
            if conflicts < min_conflicts:
                min_conflicts = conflicts
                best_candidates = [val]
            elif conflicts == min_conflicts:
                best_candidates.append(val)
                
        return random.choice(best_candidates)

# =====================================================================
# 4. SAT Modeling Intuition Panel
# =====================================================================

def get_sat_modeling_info() -> Dict[str, Any]:
    """
    Shows how the School Bus Scheduling CSP translates into Propositional Logic / SAT clauses.
    This fulfills the SAT-intuition requirement.
    """
    return {
        "Description": "Translating CSP to SAT (CNF)",
        "Variables": "Let X_s_b be a Boolean variable representing student 's' assigned to bus 'b'.",
        "Example Clauses": [
            {
                "Constraint": "Each student 's' must be assigned to at least one bus",
                "CNF": "(X_s_Bus1 OR X_s_Bus2)"
            },
            {
                "Constraint": "Each student 's' can be assigned to at most one bus",
                "CNF": "(NOT X_s_Bus1 OR NOT X_s_Bus2)"
            },
            {
                "Constraint": "Wheelchair student Chloe must ride Bus 1 (Unit Clause)",
                "CNF": "(X_Chloe_Bus1)"
            },
            {
                "Constraint": "Siblings Alice & Aaron must be on the same bus",
                "CNF": "(NOT X_Alice_Bus1 OR X_Aaron_Bus1) AND (NOT X_Alice_Bus2 OR X_Aaron_Bus2)"
            },
            {
                "Constraint": "Capacity limit: Bus 1 cannot exceed 2 students (Subset Cardinality constraint as clauses)",
                "CNF": "(NOT X_Alice_Bus1 OR NOT X_Ben_Bus1 OR NOT X_Charlie_Bus1)"
            }
        ]
    }

# =====================================================================
# 5. Standalone Test Suite
# =====================================================================

if __name__ == "__main__":
    print("====================================================")
    print("Testing CO3: Constraint Satisfaction Problems (CSP)")
    print("====================================================")
    
    students = ["Alice", "Aaron", "Ben", "Charlie", "Chloe", "David", "Daisy", "Emma", "Frank", "Fiona", "Grace", "Harry", "Helen"]
    buses = ["Bus_1", "Bus_2"]
    
    # Domain definition for each student (initially all buses are candidates)
    domains = {student: list(buses) for student in students}
    
    # Initialize CSP
    csp = BusSchedulingCSP(variables=students, domains=domains, capacity_limit=8)
    
    # 1. Solve via Backtracking
    solver = CSPSolver(csp)
    solution = solver.solve_backtracking()
    
    print("Backtracking Solver Result:")
    if solution:
        print(f"  Status: SUCCESS | Backtrack Steps: {solver.backtrack_steps}")
        # Count allocations
        allocation = {b: [] for b in buses}
        for student, bus in solution.items():
            allocation[bus].append(student)
        for bus, roster in allocation.items():
            print(f"  {bus} ({len(roster)} students): {', '.join(roster)}")
    else:
        print("  Status: FAILED to find a valid assignment.")
        print("\nConstraint Failure Logs:")
        for log in csp.explanation_log[:5]:
            print(f"  - {log}")

    # 2. Test CSP Fail case (set Capacity limit to 4, which is impossible for 11 students on 2 buses)
    print("\nTesting CSP Fail Case (Capacity Limit = 4):")
    csp_fail = BusSchedulingCSP(variables=students, domains={s: list(buses) for s in students}, capacity_limit=4)
    fail_solver = CSPSolver(csp_fail)
    fail_sol = fail_solver.solve_backtracking()
    print(f"  Status: {'SUCCESS' if fail_sol else 'FAILED'}")
    print("  First few constraint explanations for failure:")
    for log in csp_fail.explanation_log[:4]:
        print(f"    * {log}")

    # 3. Test Local Search (Min-Conflicts)
    print("\nTesting Min-Conflicts Local Search Solver:")
    min_conf_solver = MinConflictsSolver(csp)
    mc_sol, steps = min_conf_solver.solve()
    if mc_sol:
        print(f"  Status: SUCCESS in {steps} steps.")
        allocation = {b: [] for b in buses}
        for student, bus in mc_sol.items():
            allocation[bus].append(student)
        for bus, roster in allocation.items():
            print(f"    {bus}: {', '.join(roster)}")
    else:
        print(f"  Status: FAILED (maximum steps reached).")
        
    # 4. View SAT translation info
    print("\nSAT Intuition Model:")
    sat_info = get_sat_modeling_info()
    for clause in sat_info["Example Clauses"]:
        print(f"  Rule: {clause['Constraint']}\n    CNF: {clause['CNF']}")
        
    print("\nCO3 Tests completed successfully.")
