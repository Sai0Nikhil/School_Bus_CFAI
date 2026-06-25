"""
FastAPI Backend Application
Project: AI Based School Bus Route Optimization

Exposes endpoints for the Vite React dashboard to trigger and visualize
algorithms from CO1 to CO6.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import sys
import os
# Ensure the backend directory is in the import path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pydantic import BaseModel
from typing import Dict, List, Any, Optional

# Import backend modules
import co1_agent_model as co1
import co2_search_algorithms as co2
import co3_csp_scheduling as co3
import co4_adversarial_stochastic as co4
import co5_probabilistic_reasoning as co5
import co6_hybrid_system as co6

app = FastAPI(title="AI Based School Bus Route Optimization API")

# Enable CORS for React frontend (default Vite dev runs on port 5173 or similar)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================================
# API Models
# =====================================================================

class SearchRequest(BaseModel):
    start: str
    goal: str

class CSPRequest(BaseModel):
    capacity: int

class AdversarialRequest(BaseModel):
    start: str
    goal: str
    depth: int

class ProbabilisticQueryRequest(BaseModel):
    evidence: Dict[str, Any]
    query_var: str
    eliminate_vars: List[str]

class HMMRequest(BaseModel):
    observations: List[str]

class HybridRequest(BaseModel):
    weather: str
    accident: bool
    capacity: int

class BreakdownRequest(BaseModel):
    broken_bus: str
    breakdown_node: str
    hybrid_result: Dict[str, Any]

# =====================================================================
# Endpoints
# =====================================================================

@app.get("/api/config")
def get_config():
    """
    Returns the static configuration: graph network, coordinates, and student list.
    """
    return {
        "graph": co1.ROAD_NETWORK,
        "coordinates": co1.NODE_COORDINATES,
        "students": co1.STUDENT_DATA
    }

@app.get("/api/co1/peas")
def get_peas_model():
    """
    Returns the PEAS and Environment properties.
    """
    peas = co1.BusAgentPEAS()
    env = co1.EnvironmentProperties()
    return {
        "peas": peas.get_details(),
        "environment": env.get_properties()
    }

@app.post("/api/co1/simulate")
def run_co1_simulation():
    """
    Runs a pre-defined route simulation to show step-by-step state logs.
    """
    sim = co1.SchoolBusAgentSimulator(capacity=8)
    route = ["Stop_A", "Stop_B", "Stop_E", "Stop_G"]
    final_state = sim.run_predefined_route("Stop_A", route[1:])
    return {
        "logs": sim.logger.get_logs(),
        "final_state": {
            "current_node": final_state.current_node,
            "passengers": list(final_state.passengers),
            "visited": list(final_state.visited_stops),
            "time_elapsed": final_state.time_elapsed
        }
    }

@app.post("/api/co2/search")
def run_co2_search(req: SearchRequest):
    """
    Runs and profiles BFS, DFS, UCS, A*, Greedy, and IDA* between start and goal.
    """
    engine = co2.RouteSearchEngine()
    ida = co2.IDAStarSolver()
    
    try:
        bfs_res = engine.run_bfs(req.start, req.goal)
        dfs_res = engine.run_dfs(req.start, req.goal)
        ucs_res = engine.run_ucs(req.start, req.goal)
        astar_res = engine.run_astar(req.start, req.goal)
        greedy_res = engine.run_greedy(req.start, req.goal)
        ida_res = ida.solve(req.start, req.goal)
        
        # Calculate heuristics for all nodes relative to goal
        heuristics = {node: co2.get_heuristic(node, req.goal) for node in co1.NODE_COORDINATES}
        
        return {
            "BFS": bfs_res,
            "DFS": dfs_res,
            "UCS": ucs_res,
            "A*": astar_res,
            "Greedy": greedy_res,
            "IDA*": ida_res,
            "heuristics": heuristics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/co3/csp")
def run_co3_csp(req: CSPRequest):
    """
    Runs CSP Backtracking (MRV+LCV+FC) and Min-Conflicts for student assignment.
    """
    students = list(co1.STUDENT_DATA.keys())
    # Flatten students list
    flat_students = []
    for stop, roster in co1.STUDENT_DATA.items():
        for student in roster:
            flat_students.append(student['name'])
            
    buses = ["Bus_1", "Bus_2"]
    domains = {s: list(buses) for s in flat_students}
    
    # Backtracking CSP
    csp = co3.BusSchedulingCSP(variables=flat_students, domains=domains, capacity_limit=req.capacity)
    solver = co3.CSPSolver(csp)
    backtrack_sol = solver.solve_backtracking()
    backtrack_logs = list(csp.explanation_log)
    
    # Min-Conflicts CSP (fresh copy)
    csp_mc = co3.BusSchedulingCSP(variables=flat_students, domains={s: list(buses) for s in flat_students}, capacity_limit=req.capacity)
    mc_solver = co3.MinConflictsSolver(csp_mc)
    mc_sol, mc_steps = mc_solver.solve()
    
    sat_info = co3.get_sat_modeling_info()
    
    return {
        "backtracking": {
            "success": backtrack_sol is not None,
            "solution": backtrack_sol,
            "steps": solver.backtrack_steps,
            "logs": backtrack_logs
        },
        "min_conflicts": {
            "success": mc_sol is not None,
            "solution": mc_sol,
            "steps": mc_steps
        },
        "sat_info": sat_info
    }

@app.post("/api/co4/adversarial")
def run_co4_search(req: AdversarialRequest):
    """
    Computes adversarial (Minimax Alpha-Beta) and stochastic (Expectimax) decisions.
    """
    adv = co4.AdversarialRoutingEngine()
    stoch = co4.StochasticRoutingEngine()
    
    # Minimax Alpha-Beta
    mini_util, mini_path = adv.minimax_alpha_beta(
        req.start, req.depth, True, -float('inf'), float('inf'), 0.0, req.goal
    )
    
    # Expectimax
    stoch_util, stoch_path = stoch.expectimax(
        req.start, req.depth, True, 0.0, req.goal
    )
    clean_stoch_path = [p for p in stoch_path if p]
    
    # Iterative deepening result
    id_res = adv.run_iterative_deepening(req.start, req.depth, req.goal)
    
    return {
        "minimax": {
            "path": mini_path,
            "utility": mini_util,
            "expansions": adv.expanded_nodes
        },
        "expectimax": {
            "path": clean_stoch_path,
            "utility": stoch_util,
            "expansions": stoch.expanded_nodes
        },
        "iterative_deepening": id_res
    }

@app.post("/api/co5/probabilistic")
def run_co5_probabilistic(req: ProbabilisticQueryRequest):
    """
    Queries the Bayesian network and computes HMM updates.
    """
    # Run exact variable elimination
    ve_res = co5.query_variable_elimination(
        query_var=req.query_var,
        evidence=req.evidence,
        eliminate_vars=req.eliminate_vars
    )
    
    # Format factor response
    formatted_table = []
    for key, prob in ve_res.table.items():
        formatted_table.append({
            "value": key[0] if len(key) == 1 else str(key),
            "probability": prob
        })
        
    # Likelihood weighting estimate
    lw_val = co5.ApproximateSampler.likelihood_weighting(
        query_var=req.query_var,
        query_val=True if req.query_var == "BusDelay" else "High", # default binary/ternary values
        evidence=req.evidence,
        samples_count=2000
    )
        
    return {
        "query": f"P({req.query_var} | {req.evidence})",
        "variable_elimination": formatted_table,
        "likelihood_weighting_estimate": lw_val
    }

@app.post("/api/co5/hmm")
def run_co5_hmm(req: HMMRequest):
    """
    Runs Forward filtering HMM tracking for a sequence of velocity observations.
    """
    tracker = co5.HMMTracker()
    beliefs = tracker.filter(req.observations)
    
    # Expected utility comparison
    eu_dec = co5.evaluate_decision_expected_utility()
    
    return {
        "beliefs": beliefs,
        "expected_utility_decision": eu_dec
    }

@app.post("/api/co6/hybrid")
def run_co6_hybrid(req: HybridRequest):
    """
    Runs the complete hybrid routing flow.
    """
    master = co6.MasterSchoolBusSystem(capacity_limit=req.capacity)
    op_res = master.run_morning_operation(weather=req.weather, accident_reported=req.accident)
    ethics = co6.evaluate_ethics_and_limitations()
    
    return {
        "operation": op_res,
        "ethics": ethics
    }

@app.post("/api/co6/breakdown")
def run_co6_breakdown(req: BreakdownRequest):
    """
    Triggers bus breakdown recovery logic.
    """
    master = co6.MasterSchoolBusSystem()
    recovery = co6.FailureRecoveryEngine(master)
    res = recovery.handle_bus_breakdown(req.broken_bus, req.breakdown_node, req.hybrid_result)
    return res

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
