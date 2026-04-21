#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Fix retrieval_level6.py - Remove FAQ references
filepath = "ai/retrieval_level6.py"

with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Process lines
new_lines = []
for line in lines:
    # Skip FAQ = load_source("faq") line
    if 'FAQ = load_source("faq")' in line:
        continue
    # Skip the FAQ line in SOURCES
    if "SOURCES = [ARTICLES, FAQ, SIMPLIFIED]" in line:
        new_lines.append("SOURCES = [ARTICLES, SIMPLIFIED]\n")
        continue
    # Remove "faq": 0.05 from SOURCE_PRIORITY
    if '"faq": 0.05,' in line:
        new_lines.append(line.replace(', "faq": 0.05', ''))
        continue
    if '"faq": 0.05' in line and not '"faq": 0.05,' in line:
        new_lines.append(line.replace('"faq": 0.05,', '').replace('"faq": 0.05', ''))
        continue
    # Remove "faqs": "faq" from mapping
    if '"faqs": "faq",' in line:
        new_lines.append(line.replace(', "faqs": "faq"', ''))
        continue
    new_lines.append(line)

with open(filepath, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("✅ Successfully removed FAQ from retrieval_level6.py")
