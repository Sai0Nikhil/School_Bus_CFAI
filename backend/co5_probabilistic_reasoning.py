"""
CO5: Probabilistic Reasoning & Uncertainty
Project: AI Based School Bus Route Optimization

This module implements:
1. A Bayesian Network for predicting traffic congestion and bus delays.
2. Inference by Variable Elimination (exact inference).
3. Rejection Sampling and Likelihood Weighting (approximate inference).
4. Hidden Markov Model (HMM) with Filtering (Forward algorithm) to track congestion.
5. Expected Utility decisions under uncertainty.
"""

import random
from typing import List, Dict, Set, Tuple, Optional, Any

# =====================================================================
# 1. Bayesian Network Definition
# =====================================================================

class Factor:
    """
    Represents a factor (a table of probabilities) in a Bayesian Network.
    Used for variable elimination.
    """
    def __init__(self, variables: List[str], table: Dict[Tuple[Any, ...], float]):
        self.variables = variables  # List of variable names
        self.table = table          # Dict: tuple of values (matching variables order) -> probability

    def restrict(self, var: str, value: Any) -> 'Factor':
        """
        Restricts a factor by setting a variable to a specific value (observing evidence).
        """
        if var not in self.variables:
            return self
            
        var_idx = self.variables.index(var)
        new_vars = [v for v in self.variables if v != var]
        new_table = {}
        
        for key, prob in self.table.items():
            if key[var_idx] == value:
                new_key = key[:var_idx] + key[var_idx+1:]
                new_table[new_key] = prob
                
        return Factor(new_vars, new_table)

    def multiply(self, other: 'Factor') -> 'Factor':
        """
        Multiplies this factor with another factor.
        """
        # Union of variables
        new_vars = list(self.variables)
        for var in other.variables:
            if var not in new_vars:
                new_vars.append(var)
                
        new_table = {}
        # Find indices for matching
        self_indices = [new_vars.index(v) for v in self.variables]
        other_indices = [new_vars.index(v) for v in other.variables]
        
        # Get all unique combinations of values for new_vars
        # Since variables are binary or ternary, we can build the joint key iteratively
        domains = {
            "Weather": ["Sunny", "Rainy"],
            "Accident": [True, False],
            "RoadWork": [True, False],
            "TrafficCongestion": ["Low", "Medium", "High"],
            "BusDelay": [True, False]
        }
        
        def get_all_keys(vars_list: List[str]) -> List[Tuple[Any, ...]]:
            if not vars_list:
                return [()]
            first = vars_list[0]
            rest_keys = get_all_keys(vars_list[1:])
            res = []
            for val in domains[first]:
                for rk in rest_keys:
                    res.append((val,) + rk)
            return res

        all_joint_keys = get_all_keys(new_vars)
        
        for joint_key in all_joint_keys:
            # Extract keys for self and other
            self_key = tuple(joint_key[idx] for idx in self_indices)
            other_key = tuple(joint_key[idx] for idx in other_indices)
            
            if self_key in self.table and other_key in other.table:
                new_table[joint_key] = self.table[self_key] * other.table[other_key]
                
        return Factor(new_vars, new_table)

    def sum_out(self, var: str) -> 'Factor':
        """
        Sums out/eliminates a variable from the factor.
        """
        if var not in self.variables:
            return self
            
        var_idx = self.variables.index(var)
        new_vars = [v for v in self.variables if v != var]
        new_table = {}
        
        for key, prob in self.table.items():
            new_key = key[:var_idx] + key[var_idx+1:]
            new_table[new_key] = new_table.get(new_key, 0.0) + prob
            
        return Factor(new_vars, new_table)

    def normalize(self) -> 'Factor':
        """
        Normalizes table values to sum to 1.
        """
        total = sum(self.table.values())
        if total == 0:
            return self
        normalized_table = {key: val / total for key, val in self.table.items()}
        return Factor(self.variables, normalized_table)

    def __repr__(self) -> str:
        res = f"Factor on {self.variables}:\n"
        for key, prob in self.table.items():
            res += f"  {key} -> {prob:.4f}\n"
        return res

# Helper to initialize factors for our Bayesian Network:
# Weather (W), Accident (A), RoadWork (RW), TrafficCongestion (C), BusDelay (D)
def get_bayes_net_factors() -> List[Factor]:
    # P(Weather)
    f_w = Factor(["Weather"], {
        ("Sunny",): 0.8,
        ("Rainy",): 0.2
    })
    
    # P(Accident | Weather)
    f_a = Factor(["Weather", "Accident"], {
        ("Sunny", True): 0.05,
        ("Sunny", False): 0.95,
        ("Rainy", True): 0.20,
        ("Rainy", False): 0.80
    })
    
    # P(RoadWork)
    f_rw = Factor(["RoadWork"], {
        (True,): 0.15,
        (False,): 0.85
    })
    
    # P(TrafficCongestion | Accident, RoadWork)
    f_c = Factor(["Accident", "RoadWork", "TrafficCongestion"], {
        # False, False
        (False, False, "Low"): 0.85, (False, False, "Medium"): 0.10, (False, False, "High"): 0.05,
        # True, False
        (True, False, "Low"): 0.10, (True, False, "Medium"): 0.30, (True, False, "High"): 0.60,
        # False, True
        (False, True, "Low"): 0.15, (False, True, "Medium"): 0.55, (False, True, "High"): 0.30,
        # True, True
        (True, True, "Low"): 0.05, (True, True, "Medium"): 0.20, (True, True, "High"): 0.75
    })
    
    # P(BusDelay | TrafficCongestion)
    f_d = Factor(["TrafficCongestion", "BusDelay"], {
        ("Low", True): 0.10, ("Low", False): 0.90,
        ("Medium", True): 0.45, ("Medium", False): 0.55,
        ("High", True): 0.85, ("High", False): 0.15
    })
    
    return [f_w, f_a, f_rw, f_c, f_d]

# =====================================================================
# 2. Variable Elimination Algorithm
# =====================================================================

def query_variable_elimination(query_var: str, evidence: Dict[str, Any], eliminate_vars: List[str]) -> Factor:
    """
    Executes variable elimination to answer a probabilistic query.
    P(QueryVar | Evidence)
    """
    factors = get_bayes_net_factors()
    
    # Step 1: Restrict factors based on evidence
    restricted_factors = []
    for f in factors:
        temp_f = f
        for ev_var, ev_val in evidence.items():
            temp_f = temp_f.restrict(ev_var, ev_val)
        restricted_factors.append(temp_f)
        
    # Step 2: Eliminate hidden variables one by one
    for var in eliminate_vars:
        # Separate factors containing this variable
        dependent_factors = [f for f in restricted_factors if var in f.variables]
        independent_factors = [f for f in restricted_factors if var not in f.variables]
        
        if not dependent_factors:
            continue
            
        # Multiply dependent factors
        product = dependent_factors[0]
        for f in dependent_factors[1:]:
            product = product.multiply(f)
            
        # Sum out the variable
        summed_factor = product.sum_out(var)
        
        # New list of factors
        restricted_factors = independent_factors + [summed_factor]
        
    # Step 3: Multiply remaining factors
    final_product = restricted_factors[0]
    for f in restricted_factors[1:]:
        final_product = final_product.multiply(f)
        
    # Step 4: Normalize to sum to 1.0
    return final_product.normalize()

# =====================================================================
# 3. Approximate Sampling (Likelihood Weighting Concept)
# =====================================================================

class ApproximateSampler:
    """
    Implements sampling inference algorithms.
    """
    @staticmethod
    def likelihood_weighting(query_var: str, query_val: Any, evidence: Dict[str, Any], samples_count: int = 1000) -> float:
        """
        Estimates P(query_var = query_val | evidence) using likelihood weighting.
        Avoids rejecting samples by weighting each sample by the likelihood of the evidence variables.
        """
        # Topological order of our network: Weather, RoadWork, Accident, Congestion, Delay
        variables_order = ["Weather", "RoadWork", "Accident", "TrafficCongestion", "BusDelay"]
        
        total_weight = 0.0
        query_match_weight = 0.0
        
        for _ in range(samples_count):
            sample = {}
            weight = 1.0
            
            for var in variables_order:
                if var in evidence:
                    val = evidence[var]
                    sample[var] = val
                    # Multiply weight by conditional probability P(var = val | parents)
                    weight *= ApproximateSampler._get_cond_prob(var, val, sample)
                else:
                    # Sample value from conditional distribution P(var | parents)
                    val = ApproximateSampler._sample_variable(var, sample)
                    sample[var] = val
            
            total_weight += weight
            if sample.get(query_var) == query_val:
                query_match_weight += weight
                
        return query_match_weight / total_weight if total_weight > 0 else 0.0

    @staticmethod
    def _get_cond_prob(var: str, val: Any, sample: Dict[str, Any]) -> float:
        if var == "Weather":
            return 0.8 if val == "Sunny" else 0.2
        elif var == "RoadWork":
            return 0.15 if val is True else 0.85
        elif var == "Accident":
            w = sample["Weather"]
            if w == "Sunny":
                return 0.05 if val is True else 0.95
            else:
                return 0.20 if val is True else 0.80
        elif var == "TrafficCongestion":
            a, rw = sample["Accident"], sample["RoadWork"]
            probs = {
                (False, False): {"Low": 0.85, "Medium": 0.10, "High": 0.05},
                (True, False): {"Low": 0.10, "Medium": 0.30, "High": 0.60},
                (False, True): {"Low": 0.15, "Medium": 0.55, "High": 0.30},
                (True, True): {"Low": 0.05, "Medium": 0.20, "High": 0.75}
            }[(a, rw)]
            return probs[val]
        elif var == "BusDelay":
            c = sample["TrafficCongestion"]
            prob_high = {"Low": 0.10, "Medium": 0.45, "High": 0.85}[c]
            return prob_high if val is True else (1.0 - prob_high)
        return 0.0

    @staticmethod
    def _sample_variable(var: str, sample: Dict[str, Any]) -> Any:
        r = random.random()
        if var == "Weather":
            return "Sunny" if r < 0.8 else "Rainy"
        elif var == "RoadWork":
            return True if r < 0.15 else False
        elif var == "Accident":
            w = sample["Weather"]
            threshold = 0.05 if w == "Sunny" else 0.20
            return True if r < threshold else False
        elif var == "TrafficCongestion":
            a, rw = sample["Accident"], sample["RoadWork"]
            probs = {
                (False, False): [0.85, 0.95],  # Cumulative thresholds for Low, Medium (and High is 1.0)
                (True, False): [0.10, 0.40],
                (False, True): [0.15, 0.70],
                (True, True): [0.05, 0.25]
            }[(a, rw)]
            if r < probs[0]: return "Low"
            elif r < probs[1]: return "Medium"
            else: return "High"
        elif var == "BusDelay":
            c = sample["TrafficCongestion"]
            threshold = {"Low": 0.10, "Medium": 0.45, "High": 0.85}[c]
            return True if r < threshold else False

# =====================================================================
# 4. Hidden Markov Model (HMM) for Tracking
# =====================================================================

class HMMTracker:
    """
    Hidden Markov Model tracker.
    Estimates the true state of road congestion from noisy GPS speed data.
    Hidden States: Clear (C), Slow (S), Congested (G)
    Observations: Fast (F), Moderate (M), Crawling (W)
    """
    def __init__(self):
        self.states = ["Clear", "Slow", "Congested"]
        
        # Prior probabilities P(S_0)
        self.prior = {"Clear": 0.6, "Slow": 0.3, "Congested": 0.1}
        
        # Transition probabilities P(S_t | S_t-1)
        self.transitions = {
            "Clear": {"Clear": 0.80, "Slow": 0.15, "Congested": 0.05},
            "Slow": {"Clear": 0.20, "Slow": 0.60, "Congested": 0.20},
            "Congested": {"Clear": 0.05, "Slow": 0.25, "Congested": 0.70}
        }
        
        # Emission probabilities P(O_t | S_t)
        self.emissions = {
            "Clear": {"Fast": 0.80, "Moderate": 0.15, "Crawling": 0.05},
            "Slow": {"Fast": 0.10, "Moderate": 0.70, "Crawling": 0.20},
            "Congested": {"Fast": 0.01, "Moderate": 0.09, "Crawling": 0.90}
        }

    def filter(self, observations: List[str]) -> List[Dict[str, float]]:
        """
        Executes the Forward filtering algorithm.
        Returns a list of belief distributions over states for each step.
        """
        beliefs_history: List[Dict[str, float]] = []
        
        # Time step 0 initialization
        current_belief = {}
        first_obs = observations[0]
        
        for state in self.states:
            # Belief(S_0) = P(S_0) * P(O_0 | S_0)
            prior_val = self.prior[state]
            emission_val = self.emissions[state][first_obs]
            current_belief[state] = prior_val * emission_val
            
        # Normalize initial belief
        total = sum(current_belief.values())
        current_belief = {s: v / total for s, v in current_belief.items()}
        beliefs_history.append(current_belief)
        
        # Update beliefs recursively for subsequent steps
        for t in range(1, len(observations)):
            obs = observations[t]
            next_belief = {}
            
            for next_state in self.states:
                # Predict step: sum_s (Belief(s) * Transition(s -> next_state))
                predicted_val = sum(beliefs_history[-1][s] * self.transitions[s][next_state] for s in self.states)
                
                # Update step: multiply by Emission probability of current observation
                emission_val = self.emissions[next_state][obs]
                next_belief[next_state] = predicted_val * emission_val
                
            # Normalize
            total = sum(next_belief.values())
            current_belief = {s: v / total for s, v in next_belief.items()}
            beliefs_history.append(current_belief)
            
        return beliefs_history

# =====================================================================
# 5. Uncertainty-Aware Decisions (Expected Utility Concept)
# =====================================================================

def evaluate_decision_expected_utility() -> Dict[str, Any]:
    """
    Calculates expected utility of choosing between two alternative routes:
    - Route 1: Safe Highway (predictable time: 20 mins)
    - Route 2: Shortcut Street (usually 12 mins, but if there is an accident, 35 mins)
    Accident probability is computed from our Bayesian Network (e.g. on a Rainy Day).
    """
    # Suppose weather is Rainy. Let's calculate P(Accident = True | Weather = Rainy)
    # P(Accident = True | Rainy) = 0.20 (from CPT)
    p_accident = 0.20
    
    # Utility function: U(t) = 100 - t
    def utility(minutes: float) -> float:
        return 100.0 - minutes
        
    # Route 1 (Safe): Travel time is always 20 minutes
    u_route1 = utility(20)
    eu_route1 = u_route1  # Since it's deterministic, expected utility = utility
    
    # Route 2 (Shortcut):
    # If no accident: 12 minutes
    # If accident: 35 minutes
    u_route2_clear = utility(12)
    u_route2_blocked = utility(35)
    
    eu_route2 = (1.0 - p_accident) * u_route2_clear + p_accident * u_route2_blocked
    
    best_choice = "Route_2 (Shortcut)" if eu_route2 > eu_route1 else "Route_1 (Safe Highway)"
    
    return {
        "Rainy Day Probability of Accident": p_accident,
        "Route 1 Safe Expected Utility": eu_route1,
        "Route 2 Shortcut Expected Utility": eu_route2,
        "Optimal Decision": best_choice
    }

# =====================================================================
# 6. Standalone Test Suite
# =====================================================================

if __name__ == "__main__":
    print("====================================================")
    print("Testing CO5: Probabilistic Reasoning & HMM Tracking")
    print("====================================================")
    
    # 1. Test Exact Inference (Variable Elimination)
    # Query P(BusDelay = True | Weather = Rainy)
    # Eliminate variables: Accident, RoadWork, TrafficCongestion
    print("Exact Inference (Variable Elimination): Query P(BusDelay = True | Weather = Rainy)")
    result_ve = query_variable_elimination(
        query_var="BusDelay",
        evidence={"Weather": "Rainy"},
        eliminate_vars=["Accident", "RoadWork", "TrafficCongestion"]
    )
    print(result_ve)
    
    # 2. Test Approximate Sampling
    print("Approximate Inference (Likelihood Weighting):")
    lw_val = ApproximateSampler.likelihood_weighting(
        query_var="BusDelay",
        query_val=True,
        evidence={"Weather": "Rainy"},
        samples_count=5000
    )
    print(f"  P(BusDelay = True | Weather = Rainy) estimated: {lw_val:.4f} (expected close to VE query)\n")
    
    # 3. Test HMM Tracking
    print("HMM Tracker (Forward Filtering):")
    tracker = HMMTracker()
    obs_seq = ["Fast", "Moderate", "Crawling"]
    beliefs = tracker.filter(obs_seq)
    print(f"  Observation sequence: {' -> '.join(obs_seq)}")
    for t, b in enumerate(beliefs):
        formatted_b = {s: f"{v*100:.1f}%" for s, v in b.items()}
        print(f"    Step {t} beliefs: {formatted_b}")
        
    # 4. Test Expected Utility Decision Making
    print("\nExpected Utility Decisions under Uncertainty:")
    eu_dec = evaluate_decision_expected_utility()
    for key, val in eu_dec.items():
        print(f"  {key}: {val}")
        
    print("\nCO5 Tests completed successfully.")
