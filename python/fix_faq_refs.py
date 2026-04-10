import re

# Update retrieval_level6.py
with open("ai/retrieval_level6.py", "r", encoding="utf-8") as f:
    content = f.read()

# Remove FAQ = load_source("faq") line
content = re.sub(
    r"FAQ = load_source\(\"faq\"\)\n",
    "",
    content
)

# Update SOURCES list
content = re.sub(
    r"SOURCES = \[ARTICLES, FAQ, SIMPLIFIED\]",
    "SOURCES = [ARTICLES, SIMPLIFIED]",
    content
)

# Remove "faq": 0.05 from SOURCE_PRIORITY
content = re.sub(
    r',\s*"faq": 0\.05',
    "",
    content
)

# Remove "faqs": "faq" from mapping
content = re.sub(
    r',\s*"faqs": "faq"',
    "",
    content
)

with open("ai/retrieval_level6.py", "w", encoding="utf-8") as f:
    f.write(content)

print("✅ Updated retrieval_level6.py - removed all FAQ references")
