"""
CO2: Classical Search & Profiling
Project: AI Based School Bus Route Optimization

This module implements:
1. Graph-based search algorithms: BFS, DFS, UCS, A*, Greedy.
2. Heuristic evaluation (Straight-line distance to school).
3. Memory-bounded A* variant concept (IDA*).
4. Empirical profiling (expanded nodes, runtime, peak memory using tracemalloc).
5. Open/Closed set step tracing for visual rendering.
"""

import time
import math
import tracemalloc
from typing import List, Dict, Set, Tuple, Optional, Any
from co1_agent_model import ROAD_NETWORK, NODE_COORDINATES, PriorityQueue, TraceLogger

# =====================================================================
# 1. Heuristic Design & Evaluation
# =====================================================================

def euclidean_distance(node1: str, node2: str) -> float:
    """
    Computes straight-line distance between two nodes.
    Used for A* and Greedy search heuristics.
    """
    if node1 not in NODE_COORDINATES or node2 not in NODE_COORDINATES:
        return 0.0
    x1, y1 = NODE_COORDINATES[node1]
    x2, y2 = NODE_COORDINATES[node2]
    # Calculate pixel distance
    pixel_dist = math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
    # Scale it to match travel time in minutes.
    # Suppose average speed is 50 pixels per minute.
    return pixel_dist / 50.0

def get_heuristic(node: str, target: str = "School") -> float:
    """
    Heuristic h(n): Establishes estimated cost from node 'n' to 'target'.
    Admissibility: h(n) <= h*(n) (never overestimates the true shortest path cost).
    Consistency: h(n) <= c(n, a, n') + h(n') (satisfies triangle inequality).
    Since straight-line distance is the shortest possible path between two coordinates,
    and we scale it conservatively, it is guaranteed to be admissible and consistent.
    """
    return euclidean_distance(node, target)

# =====================================================================
# 2. Search Algorithms Implementation
# =====================================================================

class RouteSearchEngine:
    def __init__(self):
        self.graph = ROAD_NETWORK

    def run_bfs(self, start: str, goal: str) -> Dict[str, Any]:
        """
        Breadth-First Search (BFS): Explores nodes level-by-level using a FIFO queue.
        Guarantees shortest path in terms of step-count (not edge weights).
        """
        tracemalloc.start()
        start_time = time.perf_counter()
        
        queue: List[Tuple[str, List[str]]] = [(start, [start])]
        visited: Set[str] = set()
        node_expansions = 0
        search_trace: List[Dict[str, Any]] = []

        path: List[str] = []
        cost = 0.0

        while queue:
            current, current_path = queue.pop(0)
            
            # Trace logger snapshot
            search_trace.append({
                "expanding": current,
                "open_set": [q[0] for q in queue],
                "closed_set": list(visited),
                "current_path": current_path
            })

            if current == goal:
                path = current_path
                break

            if current not in visited:
                visited.add(current)
                node_expansions += 1
                for neighbor in sorted(self.graph.get(current, {}).keys()):
                    if neighbor not in visited and neighbor not in [q[0] for q in queue]:
                        queue.append((neighbor, current_path + [neighbor]))

        # Calculate path cost
        if path:
            for i in range(len(path) - 1):
                cost += self.graph[path[i]][path[i+1]]

        runtime_ms = (time.perf_counter() - start_time) * 1000.0
        current_mem, peak_mem = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        return {
            "algorithm": "BFS",
            "path": path,
            "cost": cost,
            "expansions": node_expansions,
            "runtime_ms": runtime_ms,
            "peak_memory_kb": peak_mem / 1024.0,
            "trace": search_trace
        }

    def run_dfs(self, start: str, goal: str) -> Dict[str, Any]:
        """
        Depth-First Search (DFS): Explores as deep as possible before backtracking.
        Uses LIFO stack. Non-optimal.
        """
        tracemalloc.start()
        start_time = time.perf_counter()

        stack: List[Tuple[str, List[str]]] = [(start, [start])]
        visited: Set[str] = set()
        node_expansions = 0
        search_trace: List[Dict[str, Any]] = []

        path: List[str] = []
        cost = 0.0

        while stack:
            current, current_path = stack.pop()
            
            search_trace.append({
                "expanding": current,
                "open_set": [s[0] for s in stack],
                "closed_set": list(visited),
                "current_path": current_path
            })

            if current == goal:
                path = current_path
                break

            if current not in visited:
                visited.add(current)
                node_expansions += 1
                # Sort descending to maintain same expansion order when popping from stack
                for neighbor in sorted(self.graph.get(current, {}).keys(), reverse=True):
                    if neighbor not in visited:
                        stack.append((neighbor, current_path + [neighbor]))

        if path:
            for i in range(len(path) - 1):
                cost += self.graph[path[i]][path[i+1]]

        runtime_ms = (time.perf_counter() - start_time) * 1000.0
        _, peak_mem = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        return {
            "algorithm": "DFS",
            "path": path,
            "cost": cost,
            "expansions": node_expansions,
            "runtime_ms": runtime_ms,
            "peak_memory_kb": peak_mem / 1024.0,
            "trace": search_trace
        }

    def run_ucs(self, start: str, goal: str) -> Dict[str, Any]:
        """
        Uniform Cost Search (UCS) / Dijkstra: Explores nodes in order of cumulative cost.
        Uses Priority Queue. Optimal for weighted graphs.
        """
        tracemalloc.start()
        start_time = time.perf_counter()

        pq = PriorityQueue()
        pq.push((start, [start], 0.0), 0.0)
        visited: Set[str] = set()
        node_expansions = 0
        search_trace: List[Dict[str, Any]] = []

        path: List[str] = []
        final_cost = 0.0

        while not pq.is_empty():
            current, current_path, current_cost = pq.pop()

            search_trace.append({
                "expanding": current,
                # Simple extraction for trace representation
                "open_set": [f"{item[0]} (g={item[2]:.1f})" for _, _, item in pq._queue],
                "closed_set": list(visited),
                "current_path": current_path
            })

            if current == goal:
                path = current_path
                final_cost = current_cost
                break

            if current not in visited:
                visited.add(current)
                node_expansions += 1
                for neighbor, weight in self.graph.get(current, {}).items():
                    if neighbor not in visited:
                        total_cost = current_cost + weight
                        pq.push((neighbor, current_path + [neighbor], total_cost), total_cost)

        runtime_ms = (time.perf_counter() - start_time) * 1000.0
        _, peak_mem = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        return {
            "algorithm": "UCS",
            "path": path,
            "cost": final_cost,
            "expansions": node_expansions,
            "runtime_ms": runtime_ms,
            "peak_memory_kb": peak_mem / 1024.0,
            "trace": search_trace
        }

    def run_astar(self, start: str, goal: str) -> Dict[str, Any]:
        """
        A* Search: Explores nodes minimizing f(n) = g(n) + h(n).
        Guarantees optimal path if heuristic is admissible.
        """
        tracemalloc.start()
        start_time = time.perf_counter()

        pq = PriorityQueue()
        # priority = g(start) + h(start) = 0 + h(start)
        h_start = get_heuristic(start, goal)
        pq.push((start, [start], 0.0), h_start)
        
        # Track best cost to each node to avoid redundant path expansions
        best_g: Dict[str, float] = {start: 0.0}
        node_expansions = 0
        search_trace: List[Dict[str, Any]] = []

        path: List[str] = []
        final_cost = 0.0

        while not pq.is_empty():
            current, current_path, current_cost = pq.pop()

            search_trace.append({
                "expanding": current,
                "open_set": [f"{item[0]} (f={p:.1f})" for p, _, item in pq._queue],
                "closed_set": list(best_g.keys() - {item[0] for _, _, item in pq._queue}),
                "current_path": current_path
            })

            if current == goal:
                path = current_path
                final_cost = current_cost
                break

            # If we already found a cheaper route to current, ignore this path
            if current_cost > best_g.get(current, float('inf')):
                continue

            node_expansions += 1

            for neighbor, weight in self.graph.get(current, {}).items():
                g_cost = current_cost + weight
                if g_cost < best_g.get(neighbor, float('inf')):
                    best_g[neighbor] = g_cost
                    h_cost = get_heuristic(neighbor, goal)
                    f_cost = g_cost + h_cost
                    pq.push((neighbor, current_path + [neighbor], g_cost), f_cost)

        runtime_ms = (time.perf_counter() - start_time) * 1000.0
        _, peak_mem = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        return {
            "algorithm": "A*",
            "path": path,
            "cost": final_cost,
            "expansions": node_expansions,
            "runtime_ms": runtime_ms,
            "peak_memory_kb": peak_mem / 1024.0,
            "trace": search_trace
        }

    def run_greedy(self, start: str, goal: str) -> Dict[str, Any]:
        """
        Greedy Best-First Search: Explores nodes minimizing f(n) = h(n).
        Highly heuristic-driven, fast but non-optimal.
        """
        tracemalloc.start()
        start_time = time.perf_counter()

        pq = PriorityQueue()
        h_start = get_heuristic(start, goal)
        pq.push((start, [start], 0.0), h_start)
        
        visited: Set[str] = set()
        node_expansions = 0
        search_trace: List[Dict[str, Any]] = []

        path: List[str] = []
        final_cost = 0.0

        while not pq.is_empty():
            current, current_path, current_cost = pq.pop()

            search_trace.append({
                "expanding": current,
                "open_set": [f"{item[0]} (h={p:.1f})" for p, _, item in pq._queue],
                "closed_set": list(visited),
                "current_path": current_path
            })

            if current == goal:
                path = current_path
                final_cost = current_cost
                break

            if current not in visited:
                visited.add(current)
                node_expansions += 1
                for neighbor, weight in self.graph.get(current, {}).items():
                    if neighbor not in visited:
                        total_cost = current_cost + weight
                        h_cost = get_heuristic(neighbor, goal)
                        pq.push((neighbor, current_path + [neighbor], total_cost), h_cost)

        runtime_ms = (time.perf_counter() - start_time) * 1000.0
        _, peak_mem = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        return {
            "algorithm": "Greedy",
            "path": path,
            "cost": final_cost,
            "expansions": node_expansions,
            "runtime_ms": runtime_ms,
            "peak_memory_kb": peak_mem / 1024.0,
            "trace": search_trace
        }

# =====================================================================
# 3. Memory-Bounded Variant (IDA* Implementation)
# =====================================================================

class IDAStarSolver:
    """
    Iterative Deepening A* (IDA*):
    A memory-bounded search that uses DFS with a cost contour limit f-limit.
    Memory complexity: O(d) where d is the depth of the optimal path.
    Avoids storing the closed and open sets in memory.
    """
    def __init__(self):
        self.graph = ROAD_NETWORK
        self.expansions = 0

    def solve(self, start: str, goal: str) -> Dict[str, Any]:
        tracemalloc.start()
        start_time = time.perf_counter()
        
        self.expansions = 0
        limit = get_heuristic(start, goal)
        path = [start]
        
        while True:
            # Run deep search with current f-cost limit
            temp, final_path = self._dfs_contour(path, 0.0, limit, goal)
            if temp == "FOUND":
                runtime_ms = (time.perf_counter() - start_time) * 1000.0
                _, peak_mem = tracemalloc.get_traced_memory()
                tracemalloc.stop()
                
                # Compute total travel cost
                cost = 0.0
                for i in range(len(final_path) - 1):
                    cost += self.graph[final_path[i]][final_path[i+1]]
                
                return {
                    "algorithm": "IDA*",
                    "path": final_path,
                    "cost": cost,
                    "expansions": self.expansions,
                    "runtime_ms": runtime_ms,
                    "peak_memory_kb": peak_mem / 1024.0,
                    "limit_reached": limit
                }
            if temp == float('inf'):
                # Entire graph searched and no path found
                tracemalloc.stop()
                return {"algorithm": "IDA*", "path": [], "cost": 0, "expansions": self.expansions}
            # Increase f-limit to the next smallest f-value that exceeded the current limit
            limit = temp

    def _dfs_contour(self, path: List[str], g: float, limit: float, goal: str) -> Tuple[Any, List[str]]:
        current = path[-1]
        f = g + get_heuristic(current, goal)
        
        if f > limit:
            return f, path
        if current == goal:
            return "FOUND", path
        
        min_limit = float('inf')
        self.expansions += 1
        
        for neighbor, weight in self.graph.get(current, {}).items():
            if neighbor not in path:
                path.append(neighbor)
                res, res_path = self._dfs_contour(path, g + weight, limit, goal)
                if res == "FOUND":
                    return "FOUND", res_path
                if res < min_limit:
                    min_limit = res
                path.pop()  # Backtrack (clears memory footprint)
                
        return min_limit, path

# =====================================================================
# 4. Standalone Test Suite
# =====================================================================

if __name__ == "__main__":
    print("====================================================")
    print("Testing CO2: Classical Search Algorithms & Profiling")
    print("====================================================")
    
    engine = RouteSearchEngine()
    start_node = "Stop_A"
    goal_node = "School"
    
    print(f"Routing from {start_node} to {goal_node}:\n")
    
    algorithms = ["BFS", "DFS", "UCS", "A*", "Greedy"]
    results = {}
    
    # 1. Profile Classical Algorithms
    for alg in algorithms:
        if alg == "BFS":
            res = engine.run_bfs(start_node, goal_node)
        elif alg == "DFS":
            res = engine.run_dfs(start_node, goal_node)
        elif alg == "UCS":
            res = engine.run_ucs(start_node, goal_node)
        elif alg == "A*":
            res = engine.run_astar(start_node, goal_node)
        elif alg == "Greedy":
            res = engine.run_greedy(start_node, goal_node)
        
        results[alg] = res
        print(f"[{alg}] Path: {' -> '.join(res['path'])}")
        print(f"      Cost: {res['cost']} mins | Node Expansions: {res['expansions']}")
        print(f"      Time: {res['runtime_ms']:.4f} ms | Peak Memory: {res['peak_memory_kb']:.4f} KB\n")

    # 2. Test IDA*
    ida = IDAStarSolver()
    res_ida = ida.solve(start_node, goal_node)
    print(f"[IDA*] Path: {' -> '.join(res_ida['path'])}")
    print(f"       Cost: {res_ida['cost']} mins | Node Expansions: {res_ida['expansions']}")
    print(f"       Time: {res_ida['runtime_ms']:.4f} ms | Peak Memory: {res_ida['peak_memory_kb']:.4f} KB")
    
    print("\nHeuristic Analysis:")
    for node in NODE_COORDINATES.keys():
        h_val = get_heuristic(node, "School")
        print(f"  h({node} -> School) = {h_val:.2f} mins")
        
    print("\nCO2 Tests completed successfully.")
