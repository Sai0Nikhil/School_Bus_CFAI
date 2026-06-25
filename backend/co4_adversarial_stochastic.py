"""
CO4: Adversarial & Stochastic Decisions
Project: AI Based School Bus Route Optimization

This module models routing decisions as tree searches:
1. Minimax Search with Alpha-Beta Pruning (routing against worst-case traffic).
2. Expectimax Search (routing under stochastic traffic distributions).
3. Depth Limits & Evaluation Functions (modeling bounded rationality).
4. Iterative Deepening wrapper.
5. Policy Selection comparison.
"""

from typing import List, Dict, Set, Tuple, Optional, Any
from co2_search_algorithms import get_heuristic, ROAD_NETWORK

# =====================================================================
# 1. Evaluation & Utility Functions (Bounded Rationality)
# =====================================================================

def evaluate_state(current_node: str, time_spent: float, goal: str = "School") -> float:
    """
    Evaluation Function: Estimates the utility of reaching current_node.
    Utility = 100 - (g(n) + h(n))
    g(n) = time_spent
    h(n) = get_heuristic(current_node, goal)
    Higher utility is better. If we exceed a budget, utility decreases.
    """
    estimated_total_time = time_spent + get_heuristic(current_node, goal)
    # Utility starts at 120 (max rating) and subtracts total minutes.
    return 120.0 - estimated_total_time

# =====================================================================
# 2. Minimax with Alpha-Beta Pruning (Adversarial Traffic)
# =====================================================================

class AdversarialRoutingEngine:
    """
    Models routing as a game:
    - MAX player (School Bus Agent) wants to maximize state utility (minimize travel time).
    - MIN player (Adversary / Congestion Agent) wants to minimize utility by injecting delays.
    """
    def __init__(self):
        self.graph = ROAD_NETWORK
        self.expanded_nodes = 0

    def minimax_alpha_beta(self, node: str, depth: int, is_max: bool, alpha: float, beta: float,
                           time_spent: float, goal: str = "School") -> Tuple[float, List[str]]:
        self.expanded_nodes += 1
        
        # Base case: reached goal, max depth, or dead end
        if node == goal or depth == 0 or node not in self.graph:
            return evaluate_state(node, time_spent, goal), [node]

        if is_max:
            max_eval = -float('inf')
            best_path = []
            
            # Sort neighbors to maximize alpha-beta pruning efficiency
            neighbors = sorted(self.graph[node].items(), key=lambda x: get_heuristic(x[0], goal))
            
            for neighbor, base_time in neighbors:
                # MAX player moves to neighbor
                eval_val, sub_path = self.minimax_alpha_beta(
                    neighbor, depth - 1, False, alpha, beta, time_spent + base_time, goal
                )
                
                if eval_val > max_eval:
                    max_eval = eval_val
                    best_path = [node] + sub_path
                
                alpha = max(alpha, eval_val)
                if beta <= alpha:
                    break  # Beta cut-off
            return max_eval, best_path
        else:
            # MIN player (Adversary) adds traffic delays to the edges
            # Delay choices: Low delay (1.0x multiplier) or High delay (3.0x multiplier on remaining edge)
            min_eval = float('inf')
            best_path = []
            
            traffic_choices = [1.0, 2.5]  # Congestion multipliers
            for multiplier in traffic_choices:
                # Apply delay multiplier to the next step
                added_cost = 2.0 * (multiplier - 1.0)  # Cost penalty
                eval_val, sub_path = self.minimax_alpha_beta(
                    node, depth - 1, True, alpha, beta, time_spent + added_cost, goal
                )
                
                if eval_val < min_eval:
                    min_eval = eval_val
                    best_path = sub_path  # Adversary doesn't change physical node, just delays
                    
                beta = min(beta, eval_val)
                if beta <= alpha:
                    break  # Alpha cut-off
            return min_eval, best_path

    def run_iterative_deepening(self, start: str, max_depth: int, goal: str = "School") -> Dict[str, Any]:
        """
        Iterative Deepening Search: incrementally increases depth limit.
        Guarantees that a move is available if interrupted.
        """
        best_utility = -float('inf')
        best_path = []
        
        for d in range(1, max_depth + 1):
            self.expanded_nodes = 0
            utility, path = self.minimax_alpha_beta(
                start, d, True, -float('inf'), float('inf'), 0.0, goal
            )
            # We keep the deepest results
            best_utility = utility
            best_path = path

        return {
            "depth_reached": max_depth,
            "utility": best_utility,
            "path": best_path,
            "expansions": self.expanded_nodes
        }

# =====================================================================
# 3. Expectimax Search (Stochastic Traffic)
# =====================================================================

class StochasticRoutingEngine:
    """
    Models routing where the environment is stochastic (chance-based).
    - MAX player (Bus Agent) makes choices to maximize utility.
    - CHANCE node represents random traffic delays (e.g. Light Traffic vs Heavy Traffic).
    """
    def __init__(self):
        self.graph = ROAD_NETWORK
        # Traffic probabilities: Light traffic (70% probability, +0 min delay),
        # Heavy traffic (30% probability, +5 mins delay)
        self.traffic_distribution = {
            "Light": {"prob": 0.70, "delay": 0.0},
            "Heavy": {"prob": 0.30, "delay": 6.0}
        }
        self.expanded_nodes = 0

    def expectimax(self, node: str, depth: int, is_max: bool, time_spent: float, goal: str = "School") -> Tuple[float, List[str]]:
        self.expanded_nodes += 1
        
        if node == goal or depth == 0 or node not in self.graph:
            return evaluate_state(node, time_spent, goal), [node]

        if is_max:
            max_eval = -float('inf')
            best_path = []
            
            for neighbor, base_time in self.graph[node].items():
                # Transition to chance node
                eval_val, sub_path = self.expectimax(
                    neighbor, depth - 1, False, time_spent + base_time, goal
                )
                
                if eval_val > max_eval:
                    max_eval = eval_val
                    best_path = [node] + sub_path
            return max_eval, best_path
        else:
            # CHANCE node: sum of (probability * utility)
            expected_val = 0.0
            best_sub_path = []
            
            # The next step evaluates the outcomes
            for traffic_type, param in self.traffic_distribution.items():
                prob = param["prob"]
                delay = param["delay"]
                
                eval_val, sub_path = self.expectimax(
                    node, depth - 1, True, time_spent + delay, goal
                )
                expected_val += prob * eval_val
                # Propagate the path corresponding to the most likely traffic scenario (Light traffic)
                if traffic_type == "Light":
                    best_sub_path = sub_path
                
            return expected_val, best_sub_path

# =====================================================================
# 4. Standalone Test Suite
# =====================================================================

if __name__ == "__main__":
    print("====================================================")
    print("Testing CO4: Adversarial & Stochastic Routing Search")
    print("====================================================")
    
    start_node = "Stop_A"
    goal_node = "School"
    
    # 1. Test Minimax with Alpha-Beta
    adv_engine = AdversarialRoutingEngine()
    print("Running Minimax Alpha-Beta Pruning (Depth=4):")
    utility, path = adv_engine.minimax_alpha_beta(
        start_node, depth=4, is_max=True, alpha=-float('inf'), beta=float('inf'), time_spent=0.0, goal=goal_node
    )
    print(f"  Worst-case robust path: {' -> '.join(path)}")
    print(f"  Guaranteed Utility Score: {utility:.2f}")
    print(f"  Node Expansions: {adv_engine.expanded_nodes}")

    # 2. Test Iterative Deepening Minimax
    print("\nRunning Iterative Deepening Minimax (Max Depth=4):")
    id_res = adv_engine.run_iterative_deepening(start_node, max_depth=4, goal=goal_node)
    print(f"  Depth Reached: {id_res['depth_reached']}")
    print(f"  Path: {' -> '.join(id_res['path'])}")
    print(f"  Utility: {id_res['utility']:.2f}")
    print(f"  Expansions in last iteration: {id_res['expansions']}")

    # 3. Test Expectimax
    stoch_engine = StochasticRoutingEngine()
    print("\nRunning Expectimax (Depth=4):")
    expected_utility, stoch_path = stoch_engine.expectimax(
        start_node, depth=4, is_max=True, time_spent=0.0, goal=goal_node
    )
    # The return path may have empty nodes from chance layer, let's filter out empty strings
    clean_stoch_path = [p for p in stoch_path if p]
    print(f"  Expected-case path: {' -> '.join(clean_stoch_path)}")
    print(f"  Expected Utility Score: {expected_utility:.2f}")
    print(f"  Node Expansions: {stoch_engine.expanded_nodes}")

    # 4. Compare Decisions
    print("\nPolicy Selection Analysis:")
    print("  - Adversarial Minimax policy chooses a route that minimizes exposure to worst-case congestion.")
    print("  - Stochastic Expectimax policy optimizes for the average delay, choosing roads that are typically faster, even if a breakdown could cause extreme delays.")
    
    print("\nCO4 Tests completed successfully.")
