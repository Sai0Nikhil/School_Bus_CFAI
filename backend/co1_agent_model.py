"""
CO1: Agent Model & Problem Formulation
Project: AI Based School Bus Route Optimization

This module defines the foundational agent model using the PEAS framework,
environment attributes, state representations, knowledge representation types,
custom data structures (e.g. Priority Queue), and trace logging.
"""

import time
import heapq
from dataclasses import dataclass, field
from typing import List, Dict, Set, Tuple, Optional, Any

# =====================================================================
# 1. PEAS & Environment Formulation
# =====================================================================

class BusAgentPEAS:
    """
    Defines the PEAS (Performance measure, Environment, Actuators, Sensors)
    structure for the School Bus Routing Agent.
    """
    def __init__(self):
        self.performance_measure = {
            "Travel Time": "Minimize total route duration for all students.",
            "Distance": "Minimize total miles traveled.",
            "Safety": "Ensure student safety guidelines (no capacity overload, max ride time).",
            "Punctuality": "Ensure students arrive at School before the target time window."
        }
        self.environment = {
            "Road Network": "Graph of stops, intersections, and traffic zones.",
            "Students": "Varying counts, pick-up/drop-off demands, and locations.",
            "Traffic Conditions": "Stochastic delay factors (weather, accidents, peak hours)."
        }
        self.actuators = {
            "Navigation": "Steering, acceleration, brake, route selection.",
            "Operations": "Open/close doors, load/unload students, update route plan."
        }
        self.sensors = {
            "GPS": "Real-time coordinate tracking.",
            "Odometer": "Distance traveled.",
            "Passenger Counter": "Weight/infrared sensors tracking students currently on board.",
            "Traffic Feeds": "Web-based congestion alerts and speed cameras."
        }

    def get_details(self) -> Dict[str, Dict[str, str]]:
        return {
            "Performance Measure": self.performance_measure,
            "Environment": self.environment,
            "Actuators": self.actuators,
            "Sensors": self.sensors
        }

class EnvironmentProperties:
    """
    Defines the properties of the AI agent's environment.
    """
    def __init__(self):
        # The environment is:
        self.observability = "Partially Observable (real-time traffic is estimated; GPS is noisy)"
        self.determinism = "Stochastic (weather, traffic, and pick-up delays are probabilistic)"
        self.episodic = "Sequential (routing choices at step t affect state and travel times at step t+1)"
        self.dynamism = "Dynamic (traffic changes while the bus is in transit)"
        self.discreteness = "Discrete (stops and routing graph represented discretely)"
        self.agents = "Multi-agent (multiple buses coordinate to pick up all students)"

    def get_properties(self) -> Dict[str, str]:
        return {
            "Observability": self.observability,
            "Determinism": self.determinism,
            "Episodic/Sequential": self.episodic,
            "Dynamism": self.dynamism,
            "Discreteness": self.discreteness,
            "Agent Count": self.agents
        }

# =====================================================================
# 2. Knowledge Representation
# =====================================================================

# Global Road Network graph definition: (StopNode) -> {NeighborNode: BaseTravelTimeInMinutes}
ROAD_NETWORK: Dict[str, Dict[str, float]] = {
    'Stop_A': {'Stop_B': 3.0, 'Stop_D': 4.0},
    'Stop_B': {'Stop_A': 3.0, 'Stop_C': 4.0, 'Stop_E': 5.0},
    'Stop_C': {'Stop_B': 4.0, 'School': 8.0},
    'Stop_D': {'Stop_A': 4.0, 'Stop_E': 2.0, 'Stop_F': 6.0},
    'Stop_E': {'Stop_B': 5.0, 'Stop_D': 2.0, 'Stop_F': 3.0, 'Stop_G': 4.0},
    'Stop_F': {'Stop_D': 6.0, 'Stop_E': 3.0, 'Stop_H': 3.0},
    'Stop_G': {'Stop_E': 4.0, 'School': 5.0},
    'Stop_H': {'Stop_F': 3.0, 'School': 6.0},
    'School': {'Stop_C': 8.0, 'Stop_G': 5.0, 'Stop_H': 6.0}
}

# Physical layout coordinates for frontend rendering and heuristics
NODE_COORDINATES: Dict[str, Tuple[int, int]] = {
    'School': (500, 300),
    'Stop_A': (100, 100),
    'Stop_B': (250, 100),
    'Stop_C': (400, 100),
    'Stop_D': (100, 250),
    'Stop_E': (250, 250),
    'Stop_F': (100, 400),
    'Stop_G': (400, 350),
    'Stop_H': (250, 400)
}

# Student Database: Location, name, requirements
STUDENT_DATA: Dict[str, List[Dict[str, Any]]] = {
    'Stop_A': [{'name': 'Alice', 'wheelchair': False}, {'name': 'Aaron', 'wheelchair': False}],
    'Stop_B': [{'name': 'Ben', 'wheelchair': False}],
    'Stop_C': [{'name': 'Charlie', 'wheelchair': False}, {'name': 'Chloe', 'wheelchair': True}],
    'Stop_D': [{'name': 'David', 'wheelchair': False}, {'name': 'Daisy', 'wheelchair': False}],
    'Stop_E': [{'name': 'Emma', 'wheelchair': False}],
    'Stop_F': [{'name': 'Frank', 'wheelchair': False}, {'name': 'Fiona', 'wheelchair': False}],
    'Stop_G': [{'name': 'Grace', 'wheelchair': False}],
    'Stop_H': [{'name': 'Harry', 'wheelchair': False}, {'name': 'Helen', 'wheelchair': False}]
}

# =====================================================================
# 3. State & Action Formulations (Dataclasses & Typing Hints)
# =====================================================================

@dataclass(frozen=True)
class BusAction:
    """
    Represents an action taken by a bus.
    """
    type: str  # "MOVE", "PICKUP", "DROP"
    target: str  # Stop Name or School Name
    cost: float  # Time cost in minutes

    def __repr__(self) -> str:
        return f"{self.type} -> {self.target} ({self.cost}m)"

@dataclass(frozen=True)
class BusState:
    """
    Represents the complete state of a single bus agent.
    Using frozen=True makes instances hashable, ideal for closed sets in search.
    """
    current_node: str
    passengers: Tuple[str, ...] = field(default_factory=tuple)  # Tuple for hashability
    visited_stops: Tuple[str, ...] = field(default_factory=tuple)
    time_elapsed: float = 0.0

    def __repr__(self) -> str:
        return f"[Node: {self.current_node} | Passengers: {len(self.passengers)} | Time: {self.time_elapsed}m]"

# =====================================================================
# 4. Core Data Structures (Complexity-Aware Priority Queue)
# =====================================================================

class PriorityQueue:
    """
    Custom wrapper around heapq to manage search frontier nodes.
    Time Complexity:
      - Push: O(log N)
      - Pop: O(log N)
      - Size: O(1)
    """
    def __init__(self):
        self._queue: List[Tuple[float, int, Any]] = []
        self._index = 0  # Tie-breaker counter

    def push(self, item: Any, priority: float) -> None:
        # We push priority, index (for stable sorting / tie-breaking), and item
        heapq.heappush(self._queue, (priority, self._index, item))
        self._index += 1

    def pop(self) -> Any:
        if not self._queue:
            raise IndexError("pop from an empty priority queue")
        priority, index, item = heapq.heappop(self._queue)
        return item

    def is_empty(self) -> bool:
        return len(self._queue) == 0

    def __len__(self) -> int:
        return len(self._queue)

# =====================================================================
# 5. Trace Logger for Explainable Reasoning
# =====================================================================

class TraceLogger:
    """
    Tracks step-by-step reasoning steps of the algorithm for web display.
    """
    def __init__(self):
        self.logs: List[Dict[str, Any]] = []

    def log(self, step_name: str, message: str, state_details: Optional[Dict[str, Any]] = None) -> None:
        self.logs.append({
            "timestamp": time.time(),
            "step": step_name,
            "message": message,
            "state": state_details or {}
        })

    def get_logs(self) -> List[Dict[str, Any]]:
        return self.logs

    def print_logs(self) -> None:
        for entry in self.logs:
            print(f"[{entry['step']}] {entry['message']}")

# =====================================================================
# 6. Small Algorithm Demo (Step Transition & Recursive Route Estimator)
# =====================================================================

class SchoolBusAgentSimulator:
    """
    A light simulation runner showing state transitions and cost accumulation.
    """
    def __init__(self, capacity: int = 8):
        self.capacity = capacity
        self.logger = TraceLogger()

    def transition(self, state: BusState, action: BusAction) -> BusState:
        """
        State Transition Model: S x A -> S'
        """
        new_time = state.time_elapsed + action.cost
        
        if action.type == "MOVE":
            new_state = BusState(
                current_node=action.target,
                passengers=state.passengers,
                visited_stops=state.visited_stops + (action.target,) if action.target not in state.visited_stops else state.visited_stops,
                time_elapsed=new_time
            )
            self.logger.log("MOVE", f"Bus moved to {action.target}. Distance cost: {action.cost} mins.", {
                "node": action.target, "time": new_time, "passengers": len(state.passengers)
            })
            return new_state

        elif action.type == "PICKUP":
            # Constraint check
            students_at_stop = [s['name'] for s in STUDENT_DATA.get(action.target, [])]
            new_passengers = list(state.passengers)
            added = 0
            for student in students_at_stop:
                if len(new_passengers) < self.capacity:
                    if student not in new_passengers:
                        new_passengers.append(student)
                        added += 1
                else:
                    self.logger.log("CONSTRAINT_VIOLATION", f"Cannot pickup {student} at {action.target} - Bus Capacity Limit reached!", {
                        "node": action.target, "capacity": self.capacity
                    })
            
            new_state = BusState(
                current_node=state.current_node,
                passengers=tuple(new_passengers),
                visited_stops=state.visited_stops,
                time_elapsed=new_time + (added * 0.5)  # 30 seconds loading time per student
            )
            self.logger.log("PICKUP", f"Picked up {added} students at {action.target}. Total passengers: {len(new_passengers)}.", {
                "node": state.current_node, "time": new_state.time_elapsed, "passengers": list(new_state.passengers)
            })
            return new_state

        elif action.type == "DROP":
            dropped_count = len(state.passengers)
            new_state = BusState(
                current_node=action.target,
                passengers=(),
                visited_stops=state.visited_stops,
                time_elapsed=new_time + (dropped_count * 0.5)
            )
            self.logger.log("DROP", f"Arrived at {action.target}. Dropped off {dropped_count} students safely.", {
                "node": action.target, "time": new_state.time_elapsed, "passengers": []
            })
            return new_state

        return state

    def run_predefined_route(self, start_node: str, route_nodes: List[str]) -> BusState:
        """
        Recursive traversal of a route to accumulate travel costs.
        Demonstrates recursion and typed state transitions.
        """
        self.logger.log("SIMULATION_START", f"Starting school bus route from {start_node}", {"start": start_node})
        initial_state = BusState(current_node=start_node)
        
        def traverse(state: BusState, index: int) -> BusState:
            # Base Case: finished all stops in route list, now drive to School
            if index == len(route_nodes):
                if state.current_node == "School":
                    return state
                # Navigate to School
                if "School" in ROAD_NETWORK[state.current_node]:
                    cost = ROAD_NETWORK[state.current_node]["School"]
                else:
                    cost = 10.0  # Fallback penalty cost
                
                # Perform drop off
                state = self.transition(state, BusAction("MOVE", "School", cost))
                state = self.transition(state, BusAction("DROP", "School", 0.0))
                return state
            
            next_stop = route_nodes[index]
            # Get travel cost from graph
            if next_stop in ROAD_NETWORK[state.current_node]:
                cost = ROAD_NETWORK[state.current_node][next_stop]
            else:
                cost = 5.0  # Default routing penalty if link doesn't exist
            
            # Action: Move to stop, then Pick up students
            state = self.transition(state, BusAction("MOVE", next_stop, cost))
            state = self.transition(state, BusAction("PICKUP", next_stop, 1.0))
            
            # Recursive call for next stop
            return traverse(state, index + 1)

        final_state = traverse(initial_state, 0)
        self.logger.log("SIMULATION_END", f"Simulation completed in {final_state.time_elapsed:.2f} mins.", {
            "total_time": final_state.time_elapsed
        })
        return final_state

# =====================================================================
# 7. Standalone testing block
# =====================================================================

if __name__ == "__main__":
    print("====================================================")
    print("Testing CO1: Agent Model & Problem Formulation")
    print("====================================================")
    
    # 1. Print PEAS details
    peas = BusAgentPEAS()
    print("PEAS Model:")
    for key, value in peas.get_details().items():
        print(f"  {key}:")
        for sub_key, sub_val in value.items():
            print(f"    - {sub_key}: {sub_val}")
            
    # 2. Test Priority Queue
    pq = PriorityQueue()
    pq.push("Node_C", 4.5)
    pq.push("Node_A", 1.2)
    pq.push("Node_B", 3.0)
    print(f"\nPriority Queue size: {len(pq)}")
    print("Popping in priority order:")
    while not pq.is_empty():
        print(f"  Popped: {pq.pop()}")

    # 3. Run Bus Simulation Trace
    sim = SchoolBusAgentSimulator(capacity=8)
    # Define route A -> B -> E -> G -> School
    route = ["Stop_A", "Stop_B", "Stop_E", "Stop_G"]
    print(f"\nSimulating route: Start(Stop_A) -> " + " -> ".join(route[1:]) + " -> School")
    final_state = sim.run_predefined_route("Stop_A", route[1:])
    
    print("\nSimulation Traces:")
    sim.logger.print_logs()
    
    print(f"\nFinal state reached: {final_state}")
    print("CO1 Tests completed successfully.")
