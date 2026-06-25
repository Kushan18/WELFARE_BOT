from typing import List, Dict, Any
from pymongo.collection import Collection

def match_schemes(user_profile: Dict[str, Any], schemes_collection: Collection) -> List[Dict[str, Any]]:
    """
    Takes user profile and returns matching schemes from MongoDB.
    Returns list of scheme documents that match ALL eligibility rules.
    """
    user = user_profile
    query: Dict[str, Any] = {
        "eligibility_rules.state": {"$in": [user.get("state"), "all"]},
    }

    # Add optional filters only if user has those fields
    if user.get("caste_category"):
        query["eligibility_rules.caste_category"] = {"$in": [user.get("caste_category"), "all"]}
    if user.get("occupation"):
        query["eligibility_rules.occupation"] = {"$in": [user.get("occupation"), "all", "any"]}
    if user.get("gender"):
        query["eligibility_rules.gender"] = {"$in": [user.get("gender"), "all"]}
    if user.get("income_bracket"):
        query["eligibility_rules.max_income"] = {"$gte": int(user.get("income_bracket"))}
    if user.get("age"):
        age = int(user.get("age"))
        query["eligibility_rules.min_age"] = {"$lte": age}
        query["eligibility_rules.max_age"] = {"$gte": age}

    matching = list(schemes_collection.find(query).limit(10))
    return matching
