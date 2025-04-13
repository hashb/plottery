# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- Setup: `python -m venv venv && source venv/bin/activate`
- Install: `pip install -r requirements.txt`
- Run: `python app.py`
- Access: http://127.0.0.1:5000

## Code Style
- Python: PEP 8, imports: stdlib, third-party, local
- JavaScript: ES6+, camelCase variables, PascalCase classes
- HTML/CSS: Semantic HTML5, kebab-case for ids/classes

## Structure
- Flask backend (app.py)
- HTML templates
- Static assets (CSS, JS modules)
- G-code parsing & visualization components

## Naming
- Variables: descriptive, camelCase (JS)
- Classes: PascalCase
- HTML ids/classes: kebab-case
- Routes: descriptive of function

## Error Handling
- Backend: HTTP responses
- Frontend: console logs and user alerts

## Project Notes
- G-code visualization conventions:
  - G0: rapid moves (dashed gray)
  - G1: drawing moves (solid black)
  - G2/G3: arcs (blue)
  - Z-axis: pen up/down state