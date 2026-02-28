.PHONY: setup setup-backend setup-extension setup-mac-monitor backend extension monitor help

# ─── Default ──────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  Deep Work Agent V2 — Dev Commands"
	@echo "  ──────────────────────────────────"
	@echo "  make setup             — First-time full setup (backend + extension)"
	@echo "  make setup-mac-monitor — Install Phase 6 mac monitor deps (macOS only)"
	@echo "  make backend           — Start the FastAPI backend (uvicorn, port 8000)"
	@echo "  make extension         — Build the Chrome extension → extension/dist/"
	@echo "  make monitor           — Run mac_monitor.py (Phase 6, macOS only)"
	@echo ""

# ─── First-time setup ────────────────────────────────────────────────
setup: setup-backend setup-extension
	@echo ""
	@echo "✅ Setup complete!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. cp backend/.env.example backend/.env  — fill in GROQ_API_KEY and other secrets"
	@echo "  2. Run Snowflake schema: paste backend/db/schema.sql into a Snowflake worksheet"
	@echo "  3. make backend     — start the FastAPI server"
	@echo "  4. make extension   — build the extension, load 'extension/dist' in chrome://extensions"
	@echo "  5. (Phase 6 only) make setup-mac-monitor && make monitor"
	@echo ""

setup-backend:
	@echo "→ Setting up Python backend..."
	cd backend && python3 -m venv venv
	cd backend && ./venv/bin/pip install --upgrade pip -q
	cd backend && ./venv/bin/pip install -r requirements.txt -q
	@echo "✅ Backend deps installed"

setup-extension:
	@echo "→ Setting up Node extension..."
	cd extension && npm install --silent
	@echo "✅ Extension deps installed"

setup-mac-monitor:
	@echo "→ Installing macOS monitor deps (Phase 6)..."
	cd backend && ./venv/bin/pip install pyobjc-framework-Quartz -q
	@echo "✅ Mac monitor deps installed"

# ─── Dev run commands ────────────────────────────────────────────────
backend:
	cd backend && ./venv/bin/uvicorn main:app --reload --port 8000

extension:
	cd extension && npm run build
	@echo ""
	@echo "Extension built → extension/dist/"
	@echo "Load it in Chrome: chrome://extensions → Developer mode → Load unpacked → select 'extension/dist'"

monitor:
	@echo "→ Starting macOS system monitor (Phase 6)..."
	cd backend && ./venv/bin/python system_agent/mac_monitor.py
