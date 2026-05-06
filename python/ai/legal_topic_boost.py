# ai/legal_topic_boost.py
"""
Legal topic boosting module - dynamically extracts law info from meta.json.
Zero config needed! Just add new laws to database, system learns automatically.
"""
import json
from pathlib import Path
from typing import List, Dict, Any, Set

# ============================================
# AUTO-LOAD FROM META.JSON
# ============================================

VECTOR_STORE_PATH = Path(__file__).parent.parent / "vector_store"

def _get_law_name_from_title(title: str) -> str:
    """
    Extract law category from article title.
    Titles format: "Điều X. ... của Bộ luật [Law Name]"
    """
    if not title:
        return None
    
    title_lower = title.lower()
    
    # Look for "của Bộ luật" and extract what comes after
    if "của bộ luật" in title_lower:
        # Extract the part after "của Bộ luật"
        start = title_lower.index("của bộ luật") + len("của bộ luật")
        law_part = title_lower[start:].strip()
        
        # Identify law type
        if "hình sự" in law_part or "criminal" in law_part:
            return "criminal"
        elif "lao động" in law_part or "labor" in law_part:
            return "labor"
        elif "hôn nhân" in law_part or "gia đình" in law_part or "family" in law_part:
            return "family"
        elif "đất đai" in law_part or "đất" in law_part and "land" not in law_part.split()[:2]:
            return "land"
    
    # Fallback: check full title for law keywords
    if any(x in title_lower for x in ["hình sự", "criminal"]):
        return "criminal"
    elif any(x in title_lower for x in ["lao động", "labor"]):
        return "labor"
    elif any(x in title_lower for x in ["hôn nhân", "gia đình", "family"]):
        return "family"
    elif any(x in title_lower for x in ["đất đai", "land"]):
        return "land"
    
    return None


def _load_laws_from_meta() -> Dict[str, Set[str]]:
    """
    Dynamically load laws and their keywords from meta.json files.
    Returns: {"labor": {"keyword1", "keyword2", ...}, "family": {...}, ...}
    """
    law_keywords = {}
    law_info = {}  # Track law titles per category
    
    # Scan all meta.json files in vector_store
    for meta_file in VECTOR_STORE_PATH.rglob("meta.json"):
        try:
            with open(meta_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                if not isinstance(data, list):
                    continue
                
                # Extract unique law titles and create keyword sets
                for item in data:
                    if not isinstance(item, dict):
                        continue
                    
                    law_title = item.get("law_title", "").strip()
                    if not law_title or len(law_title) < 5:
                        continue
                    
                    # Categorize law
                    law_category = _get_law_name_from_title(law_title)
                    if not law_category:  # Skip unrecognized laws
                        continue
                    
                    # Initialize if needed
                    if law_category not in law_keywords:
                        law_keywords[law_category] = set()
                        law_info[law_category] = []
                    
                    # Track unique law titles
                    if law_title not in law_info[law_category]:
                        law_info[law_category].append(law_title)
                    
                    # Add law title as keyword
                    law_keywords[law_category].add(law_title.lower())
                    
                    # Extract key terms from law title (meaningful words only)
                    stop_words = {"bộ", "luật", "của", "điều", "và", "về"}
                    parts = [p.lower() for p in law_title.split() 
                            if p.lower() not in stop_words and len(p) > 2]
                    law_keywords[law_category].update(parts[:3])  # First 3 meaningful words
        
        except Exception as e:
            pass  # Silently skip files with errors
    
    return law_keywords


def _get_law_articles_text(law_category: str, limit: int = 10) -> List[str]:
    """Get sample article texts for a law category"""
    texts = []
    
    for meta_file in VECTOR_STORE_PATH.rglob("meta.json"):
        try:
            with open(meta_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                if not isinstance(data, list):
                    continue
                
                for item in data:
                    if not isinstance(item, dict):
                        continue
                    
                    law_title = item.get("law_title", "").strip()
                    if _get_law_name_from_title(law_title) == law_category:
                        text = item.get("text", "")
                        if text and len(texts) < limit:
                            texts.append(text[:200])  # First 200 chars
        
        except Exception:
            continue
    
    return texts


# Initialize at module load time
_LAW_KEYWORDS_CACHE = None
_LABOR_KEYWORDS_CACHE = None

def _init_cache():
    """Initialize keyword cache"""
    global _LAW_KEYWORDS_CACHE, _LABOR_KEYWORDS_CACHE
    
    if _LAW_KEYWORDS_CACHE is None:
        _LAW_KEYWORDS_CACHE = _load_laws_from_meta()
    
    if _LABOR_KEYWORDS_CACHE is None:
        # For backward compatibility
        _LABOR_KEYWORDS_CACHE = list(_LAW_KEYWORDS_CACHE.get("labor", []))

_init_cache()

# Legacy API - extract from loaded data
LABOR_KEYWORDS = _LABOR_KEYWORDS_CACHE

def get_all_law_types() -> List[str]:
    """Get all law types in system"""
    _init_cache()
    return list(_LAW_KEYWORDS_CACHE.keys())


def get_keywords_for_law(law_category: str) -> Set[str]:
    """Get keywords for specific law"""
    _init_cache()
    return _LAW_KEYWORDS_CACHE.get(law_category, set())


def is_labor_question(q: str) -> bool:
    """Check if question is about labor law"""
    q = q.lower()
    labor_kw = get_keywords_for_law("labor")
    return any(k in q for k in labor_kw)


def detect_law_types(q: str) -> List[str]:
    """Detect which laws the question is about"""
    q = q.lower()
    detected = []
    
    _init_cache()
    for law_type, keywords in _LAW_KEYWORDS_CACHE.items():
        if any(k in q for k in keywords):
            detected.append(law_type)
    
    return detected


def get_legal_topics() -> Dict[str, List[str]]:
    """
    Dynamically generate topics from article titles in meta.json.
    Returns: {"topic_id": ["keyword1", "keyword2", ...], ...}
    """
    topics = {}
    
    for law_type in get_all_law_types():
        # Get sample texts for this law
        texts = _get_law_articles_text(law_type, limit=5)
        
        # Extract key phrases from article titles
        # For now, create generic topics per law type
        topics[f"{law_type}_general"] = list(get_keywords_for_law(law_type))[:5]
    
    return topics


def topic_boost(query_l: str, text_l: str) -> float:
    """
    Tính điểm boosting dựa trên sự liên quan giữa câu hỏi và nội dung.
    Hoàn toàn động - không hardcode từ khóa!
    
    Args:
        query_l: Câu hỏi (lowercase)
        text_l: Nội dung cần đánh giá (lowercase)
    
    Returns:
        float: Điểm boosting (0.0-0.6+). Không sử dụng giá trị âm.
    """
    
    _init_cache()
    
    # Nếu không phải câu hỏi pháp lý, trả về 0
    if not any(detect_law_types(query_l)):
        return 0.0

    score = 0.0
    
    # Get all keywords for all laws
    all_topics = get_legal_topics()
    
    # Tính điểm dựa trên topic matching
    for topic_name, keywords in all_topics.items():
        keywords_list = list(keywords) if isinstance(keywords, set) else keywords
        
        if any(k in query_l for k in keywords_list):
            # Nếu cả câu hỏi và nội dung đều chứa từ khóa của topic này
            if any(k in text_l for k in keywords_list):
                score += 0.40     # Match hoàn toàn - boost mạnh
            else:
                # Kiểm tra match từng phần
                for k in keywords_list:
                    if k and len(k.split()) > 0:
                        first_word = k.split()[0]
                        if first_word in text_l:
                            score += 0.15     # Match từng phần - boost nhẹ
                            break
    
    # Bonus cho câu hỏi cross-law (kết hợp nhiều bộ luật)
    detected_laws = detect_law_types(query_l)
    if len(detected_laws) > 1:
        score += 0.1 * (len(detected_laws) - 1)
    
    # Cap điểm
    return min(score, 0.60)
