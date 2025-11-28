# Detailed List of Orphaned Files

## Summary
- **Total orphaned files**: ~1,015 files
- **phone-backup/**: 789 files (686 TypeScript/TSX files)
- **reference/**: 226 files (161 TypeScript/TSX/Python files)
- **Backend orphaned files**: 5 files
- **Empty directories**: 3 directories

---

## 📁 phone-backup/ Directory (789 files)

This is a complete backup/snapshot of the frontend codebase. All files are orphaned and not used in production.

### Breakdown by Type:
- **TypeScript/TSX files**: 686 files
- **Other files**: 103 files (configs, images, etc.)

### Key Subdirectories:

#### `phone-backup/src/` - Main source code (652 files)
- **Components** (438 TSX files):
  - `components/thread/` - Thread components (145 files)
  - `components/ui/` - UI components (73 files)
  - `components/agents/` - Agent components (79 files)
  - `components/home/` - Home page components (18 files)
  - `components/sidebar/` - Sidebar components (11 files)
  - `components/auth/` - Auth components (5 files)
  - `components/billing/` - Billing components (5 files)
  - And many more...

- **Hooks** (87 files):
  - `hooks/react-query/` - React Query hooks (67 files)
  - `hooks/use-*.ts` - Custom hooks (20 files)

- **Lib/Utils** (53 files):
  - `lib/api.ts` - API client
  - `lib/fast-gemini-chat.ts` - Gemini chat client
  - `lib/simple-chat.ts` - Simple chat client
  - `lib/utils/` - Utility functions (8 files)
  - `lib/stores/` - State stores (6 files)
  - `lib/versioning/` - Versioning system (9 files)
  - And more...

- **App Pages** (123 files):
  - `app/(dashboard)/` - Dashboard pages (41 files)
  - `app/(home)/` - Home pages (2 files)
  - `app/auth/` - Auth pages (6 files)
  - `app/docs/` - Documentation pages (8 files)
  - And more...

#### `phone-backup/public/` - Static assets (52 files)
- Images, icons, favicons, etc.

#### `phone-backup/` - Config files
- `package.json`, `tsconfig.json`, `postcss.config.mjs`, etc.

### Sample of Orphaned Files:
```
phone-backup/src/components/thread/ThreadComponent.tsx
phone-backup/src/components/thread/content/ThreadContent.tsx
phone-backup/src/components/thread/utils.ts
phone-backup/src/lib/fast-gemini-chat.ts
phone-backup/src/lib/simple-chat.ts
phone-backup/src/lib/utils.ts
phone-backup/src/hooks/useAgentStream.ts
phone-backup/src/hooks/react-query/threads/use-messages.ts
... (686 more TypeScript/TSX files)
```

---

## 📁 reference/ Directory (226 files)

Reference implementations, not used in production.

### Breakdown:
- **TypeScript/TSX files**: 160 files
- **Python files**: 1 file
- **Other files**: 65 files (configs, migrations, etc.)

### Subdirectories:

#### `reference/ai-chatbot/` (193 files)
Complete reference chatbot implementation with:
- **Components** (96 TSX files):
  - `components/` - Chat components
  - `components/ui/` - UI components
  - `components/elements/` - Element components
  - `components/artifacts/` - Artifact components

- **Lib** (64 TypeScript files):
  - `lib/ai/` - AI integration
  - `lib/db/` - Database schema and queries
  - `lib/editor/` - Editor utilities
  - `lib/artifacts/` - Artifact handling

- **App** (13 files):
  - `app/(auth)/` - Authentication pages
  - `app/(chat)/` - Chat pages and API routes

- **Tests** (13 files):
  - `tests/e2e/` - End-to-end tests
  - `tests/pages/` - Page tests
  - `tests/prompts/` - Prompt tests
  - `tests/routes/` - Route tests

- **Artifacts** (4 files):
  - `artifacts/code/` - Code artifacts
  - `artifacts/text/` - Text artifacts
  - `artifacts/sheet/` - Sheet artifacts
  - `artifacts/image/` - Image artifacts

- **Hooks** (6 files):
  - Various React hooks

- **Config files**: `package.json`, `tsconfig.json`, `next.config.ts`, etc.

#### `reference/proxy/` - Empty directory
#### `reference/suna/` - Empty directory

### Sample of Reference Files:
```
reference/ai-chatbot/components/chat.tsx
reference/ai-chatbot/components/message.tsx
reference/ai-chatbot/lib/db/schema.ts
reference/ai-chatbot/lib/ai/models.ts
reference/ai-chatbot/app/(chat)/api/chat/route.ts
... (221 more files)
```

---

## 🔴 Backend Orphaned Files (5 files)

### 1. `backend/core/tools/sb_presentation_tool_old.py`
- **Size**: 688 lines
- **Status**: Completely orphaned - not imported anywhere
- **Reason**: Replaced by `sb_presentation_tool.py` (ProfessionalPresentationTool)
- **Evidence**: No imports found in codebase

### 2. `backend/fix_presentation_sandboxes.py`
- **Size**: 137 lines
- **Status**: One-time migration script
- **Reason**: Appears to be a one-off fix script for updating sandbox server files
- **Evidence**: Not imported anywhere

### 3. `backend/test_context_summarization_demo.py`
- **Size**: 287 lines
- **Status**: Standalone test script
- **Reason**: Not part of pytest test suite
- **Evidence**: Not referenced in `pytest.ini`

### 4. `backend/test_context_summarizer.py`
- **Size**: 245 lines
- **Status**: Standalone test script
- **Reason**: Not part of pytest test suite
- **Evidence**: Not referenced in `pytest.ini`

### 5. `backend/test_context_summarization_simple.py`
- **Size**: 201 lines
- **Status**: Standalone test script
- **Reason**: Not part of pytest test suite
- **Evidence**: Not referenced in `pytest.ini`

### 6. `backend/test_context_summarizer.sh`
- **Size**: 53 lines
- **Status**: Standalone test script
- **Reason**: Bash wrapper for test script
- **Evidence**: Not referenced anywhere

---

## 📂 Empty Directories (3)

1. `suna-suna/` - Empty directory
2. `reference/proxy/` - Empty directory
3. `reference/suna/` - Empty directory

---

## 📊 File Type Breakdown

### phone-backup/
- `.ts` files: 214 files
- `.tsx` files: 438 files
- `.json` files: ~10 files
- `.png`/`.svg`/`.ico` files: ~52 files
- Config files: ~10 files
- Other: ~65 files

### reference/
- `.ts` files: 64 files
- `.tsx` files: 96 files
- `.sql` files: ~8 files
- `.json` files: ~9 files
- Config files: ~10 files
- Other: ~39 files

### Backend
- `.py` files: 5 files
- `.sh` files: 1 file

---

## 🎯 Total Count

- **phone-backup/**: 789 files
- **reference/**: 226 files
- **Backend orphaned**: 6 files
- **Empty directories**: 3
- **TOTAL**: ~1,015 orphaned files/directories

---

## 💾 Estimated Size

Based on typical file sizes:
- **phone-backup/**: ~50-100 MB (excluding node_modules)
- **reference/**: ~10-20 MB (excluding node_modules)
- **Backend files**: ~50 KB
- **Total**: ~60-120 MB of orphaned code

---

## ✅ Recommended Actions

1. **Delete `phone-backup/`** - Complete backup, not needed
2. **Archive or delete `reference/`** - Keep only if needed for reference
3. **Delete backend orphaned files** - All safe to remove
4. **Remove empty directories** - Clean up empty folders

