#!/bin/bash
# newsletter.sh — Runs weekly via cron to generate the Agents & Apps newsletter

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"
LOG_FILE="$SCRIPT_DIR/newsletter.log"
RECIPIENT="your-email@domain.com"   # ← Change this

mkdir -p "$OUTPUT_DIR"

echo "=== Newsletter run started: $(date) ===" >> "$LOG_FILE"

# Read current volume number
VOLUME=$(node -e "const s=require('$SCRIPT_DIR/state.json'); console.log(s.current_volume);")
TODAY=$(date +%Y-%m-%d)
FILENAME="vol-${VOLUME}-${TODAY}.md"

echo "Generating Vol. ${VOLUME} for ${TODAY}..." >> "$LOG_FILE"

# Run Claude Code in headless/bare mode with the editorial brief
claude --bare -p "
You are writing Vol. ${VOLUME} of the AGENTS & APPS WITH DR. KJ
newsletter for today, ${TODAY}.

Follow all instructions in CLAUDE.md exactly.

Steps:
1. Use web search to find the top Microsoft Security developments from the past 7 days.
2. Identify a strong unifying theme that connects 2-3 of those developments.
3. Write the full newsletter (~1,200-1,500 words) following the format in CLAUDE.md.
4. Save the output to output/${FILENAME}
5. Update state.json to increment current_volume by 1.

Do not ask for confirmation. Complete all steps autonomously.
" \
  --allowedTools "Read,Write,WebSearch,Bash" \
  --output-format json \
  --cwd "$SCRIPT_DIR" >> "$LOG_FILE" 2>&1

# Verify the file was created
if [ -f "$OUTPUT_DIR/$FILENAME" ]; then
  echo "Newsletter saved: $FILENAME" >> "$LOG_FILE"

  # Email the newsletter (swap this block for Teams/SharePoint/OneDrive if preferred)
  SUBJECT="AGENTS & APPS WITH DR. KJ — Vol. ${VOLUME} | ${TODAY}"
  mail -s "$SUBJECT" "$RECIPIENT" < "$OUTPUT_DIR/$FILENAME"
  echo "Email sent to $RECIPIENT" >> "$LOG_FILE"
else
  echo "ERROR: Output file not found — $FILENAME" >> "$LOG_FILE"
  exit 1
fi

echo "=== Run complete: $(date) ===" >> "$LOG_FILE"
