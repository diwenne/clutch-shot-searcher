# Shareable Link Feature - Implementation Plan

## Overview
Create a shareable link system that allows coaches/students to share filtered shots with notes, preserving the exact state of annotations and video selections.

---

## Architecture Design

### URL Structure
```
https://yoursite.com/?share=<base64_encoded_state>
```

### Shareable State Schema
```typescript
interface ShareableState {
  v: number;                          // Version (for compatibility)
  f?: FilterState;                    // Filters (optional)
  p?: string;                         // Selected player
  seq?: {                             // Sequence data
    blocks: ShotBlock[];              // Sequence pattern
    len: number;                      // Sequence length
    notes: Record<string, string>;    // Shot notes
  };
  rm?: number[];                      // Removed shots
  rmSeq?: number[];                   // Removed sequences
  pn?: Record<string, string>;        // Player name mappings
}
```

---

## Feature Breakdown

### **✅ Feature 1: State Serialization & URL Generation**
**Status:** Not Started
**Estimated Time:** 2-3 hours

#### Files to Create/Modify
- `lib/share-state.ts` (NEW) - Core serialization logic
- `app/page.tsx` (MODIFY) - Add share state collection

#### Implementation Details

**1.1 Create `lib/share-state.ts`**
```typescript
import { FilterState } from '@/components/EnhancedFilters';

export interface ShareableState {
  v: number;
  f?: FilterState;
  p?: string;
  seq?: {
    blocks: any[];
    len: number;
    notes: Record<string, string>;
  };
  rm?: number[];
  rmSeq?: number[];
  pn?: Record<string, string>;
}

export function serializeShareableState(appState: {
  filters: FilterState;
  selectedPlayer: string | null;
  sequenceLength: number;
  sequenceNotes: Map<string, string>;
  manuallyRemovedShots: Set<number>;
  manuallyRemovedSequences: Set<number>;
  playerNames: Record<string, string>;
  isSequenceMode: boolean;
  // Add sequence blocks from SequenceBuilder
}): string {
  const state: ShareableState = {
    v: 1,
  };

  // Only include non-default filters
  const hasFilters = Object.values(appState.filters).some(v =>
    Array.isArray(v) ? v.length > 0 : v !== '' && v !== 0
  );
  if (hasFilters) state.f = appState.filters;

  // Selected player
  if (appState.selectedPlayer) state.p = appState.selectedPlayer;

  // Sequence data
  if (appState.isSequenceMode && appState.sequenceLength > 0) {
    state.seq = {
      blocks: [], // TODO: Get from SequenceBuilder
      len: appState.sequenceLength,
      notes: Object.fromEntries(appState.sequenceNotes),
    };
  }

  // Removed shots/sequences
  if (appState.manuallyRemovedShots.size > 0) {
    state.rm = Array.from(appState.manuallyRemovedShots);
  }
  if (appState.manuallyRemovedSequences.size > 0) {
    state.rmSeq = Array.from(appState.manuallyRemovedSequences);
  }

  // Player names
  if (Object.keys(appState.playerNames).length > 0) {
    state.pn = appState.playerNames;
  }

  // Serialize to JSON and base64 encode
  const json = JSON.stringify(state);
  return btoa(encodeURIComponent(json));
}

export function generateShareURL(encodedState: string): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.set('share', encodedState);
  return url.toString();
}
```

**1.2 Add Share Function to `app/page.tsx`**
```typescript
// Add new function
const generateShareableLink = () => {
  try {
    const encodedState = serializeShareableState({
      filters,
      selectedPlayer,
      sequenceLength,
      sequenceNotes,
      manuallyRemovedShots,
      manuallyRemovedSequences,
      playerNames,
      isSequenceMode,
    });

    const shareURL = generateShareURL(encodedState);
    return shareURL;
  } catch (error) {
    console.error('Failed to generate share link:', error);
    return null;
  }
};
```

#### Testing Checklist
- [ ] Can serialize empty state
- [ ] Can serialize with filters only
- [ ] Can serialize with sequence and notes
- [ ] URL length stays under 2000 characters
- [ ] No errors in console

---

### **✅ Feature 2: State Deserialization & URL Reading**
**Status:** Not Started
**Estimated Time:** 2-3 hours

#### Files to Modify
- `lib/share-state.ts` (UPDATE) - Add deserialization
- `app/page.tsx` (MODIFY) - Add useEffect to read URL

#### Implementation Details

**2.1 Add Deserialization to `lib/share-state.ts`**
```typescript
export function deserializeShareableState(encodedState: string): ShareableState | null {
  try {
    const json = decodeURIComponent(atob(encodedState));
    const state: ShareableState = JSON.parse(json);

    // Validate version
    if (!state.v || state.v !== 1) {
      console.warn('Unsupported share state version:', state.v);
      return null;
    }

    return state;
  } catch (error) {
    console.error('Failed to deserialize share state:', error);
    return null;
  }
}

export function validateSharedState(
  state: ShareableState,
  availableShots: Shot[]
): boolean {
  // Check if removed shot indices exist
  if (state.rm) {
    const maxIndex = Math.max(...availableShots.map(s => s.index));
    const invalidIndices = state.rm.filter(idx => idx > maxIndex || idx < 0);
    if (invalidIndices.length > 0) {
      console.warn('Invalid shot indices in shared state:', invalidIndices);
      return false;
    }
  }

  // TODO: Add more validation
  return true;
}
```

**2.2 Add URL Reading to `app/page.tsx`**
```typescript
// Add new useEffect after data loads
useEffect(() => {
  if (shots.length === 0) return; // Wait for data to load

  const urlParams = new URLSearchParams(window.location.search);
  const shareParam = urlParams.get('share');

  if (!shareParam) return;

  const sharedState = deserializeShareableState(shareParam);
  if (!sharedState) {
    console.error('Invalid share link');
    return;
  }

  if (!validateSharedState(sharedState, shots)) {
    console.error('Share state validation failed');
    return;
  }

  // Apply shared state
  if (sharedState.f) setFilters(sharedState.f);
  if (sharedState.p) setSelectedPlayer(sharedState.p);
  if (sharedState.pn) setPlayerNames(sharedState.pn);
  if (sharedState.rm) setManuallyRemovedShots(new Set(sharedState.rm));
  if (sharedState.rmSeq) setManuallyRemovedSequences(new Set(sharedState.rmSeq));

  // Apply sequence state
  if (sharedState.seq) {
    setSequenceLength(sharedState.seq.len);
    setSequenceNotes(new Map(Object.entries(sharedState.seq.notes)));
    setIsSequenceMode(true);
    // TODO: Apply sequence blocks to SequenceBuilder
  }

  // Clean URL (optional - removes share param after loading)
  // window.history.replaceState({}, '', window.location.pathname);

}, [shots]);
```

#### Testing Checklist
- [ ] Shared link loads correct filters
- [ ] Shared link loads correct player selection
- [ ] Shared link loads sequence with notes
- [ ] Invalid share links show error
- [ ] URL with no share param works normally

---

### **✅ Feature 3: Share Button UI & Copy to Clipboard**
**Status:** Not Started
**Estimated Time:** 1-2 hours

#### Files to Create/Modify
- `components/ShareDialog.tsx` (NEW) - Share modal
- `app/page.tsx` (MODIFY) - Add Share button

#### Implementation Details

**3.1 Create `components/ShareDialog.tsx`**
```typescript
'use client';

import { useState } from 'react';
import { XMarkIcon, ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline';

interface ShareDialogProps {
  shareURL: string;
  onClose: () => void;
}

export default function ShareDialog({ shareURL, onClose }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareURL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
            Share Analysis
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Share this link with coaches or students to view your filtered shots and notes.
        </p>

        {/* URL Display */}
        <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-3 mb-4">
          <code className="text-sm text-zinc-800 dark:text-zinc-200 break-all">
            {shareURL}
          </code>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {copied ? (
              <>
                <CheckIcon className="w-5 h-5" />
                Copied!
              </>
            ) : (
              <>
                <ClipboardIcon className="w-5 h-5" />
                Copy Link
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>

        {/* URL Stats */}
        <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Link length: {shareURL.length} characters
        </div>
      </div>
    </div>
  );
}
```

**3.2 Add Share Button to `app/page.tsx`**
```typescript
// Add state
const [showShareDialog, setShowShareDialog] = useState(false);
const [shareURL, setShareURL] = useState('');

// Add handler
const handleShare = () => {
  const url = generateShareableLink();
  if (url) {
    setShareURL(url);
    setShowShareDialog(true);
  }
};

// Add button in toolbar (around line 1050, near Export button)
<button
  onClick={handleShare}
  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
>
  <ShareIcon className="w-5 h-5" />
  Share
</button>

// Add dialog at end of JSX
{showShareDialog && (
  <ShareDialog
    shareURL={shareURL}
    onClose={() => setShowShareDialog(false)}
  />
)}
```

#### Testing Checklist
- [ ] Share button appears in toolbar
- [ ] Clicking Share opens modal
- [ ] Modal shows generated URL
- [ ] Copy button works
- [ ] Success feedback shows
- [ ] Close button works

---

### **✅ Feature 4: Note Management Enhancement**
**Status:** Not Started
**Estimated Time:** 2-3 hours

#### Files to Modify
- `app/page.tsx` (MODIFY) - Add shot notes state
- Shot list rendering (MODIFY) - Add note UI

#### Implementation Details

**4.1 Add Shot Notes State to `app/page.tsx`**
```typescript
// Add new state (around line 80)
const [shotNotes, setShotNotes] = useState<Map<number, string>>(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('shotNotes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return new Map(Object.entries(parsed));
      } catch (e) {
        console.error('Failed to load shot notes:', e);
      }
    }
  }
  return new Map();
});

// Add persistence effect
useEffect(() => {
  if (typeof window !== 'undefined' && shotNotes.size > 0) {
    const notesObject = Object.fromEntries(shotNotes);
    localStorage.setItem('shotNotes', JSON.stringify(notesObject));
  }
}, [shotNotes]);

// Add update function
const updateShotNote = (shotIndex: number, note: string) => {
  setShotNotes(prev => {
    const updated = new Map(prev);
    if (note.trim() === '') {
      updated.delete(shotIndex);
    } else {
      updated.set(shotIndex, note);
    }
    return updated;
  });
};
```

**4.2 Add Note UI to Shot List**
```typescript
// In shot list rendering (around line 1300), add note input
{/* Note input below shot */}
<div className="mt-2">
  <textarea
    value={shotNotes.get(shot.index) || ''}
    onChange={(e) => updateShotNote(shot.index, e.target.value)}
    placeholder="Add note..."
    className="w-full px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
    rows={2}
    onClick={(e) => e.stopPropagation()}
  />
</div>

{/* Note indicator badge */}
{shotNotes.has(shot.index) && (
  <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full" />
)}
```

**4.3 Update Share State to Include Shot Notes**
```typescript
// In serializeShareableState, add:
if (appState.shotNotes.size > 0) {
  state.sn = Object.fromEntries(appState.shotNotes);
}

// In deserializeShareableState, add:
if (sharedState.sn) {
  setShotNotes(new Map(Object.entries(sharedState.sn)));
}
```

#### Testing Checklist
- [ ] Can add notes to individual shots
- [ ] Notes persist in localStorage
- [ ] Notes included in share links
- [ ] Notes load from shared links
- [ ] Note indicator badge shows

---

### **✅ Feature 5: Shared View Mode**
**Status:** Not Started
**Estimated Time:** 1-2 hours

#### Files to Create/Modify
- `components/SharedViewBanner.tsx` (NEW) - Banner component
- `app/page.tsx` (MODIFY) - Detect shared mode

#### Implementation Details

**5.1 Create `components/SharedViewBanner.tsx`**
```typescript
'use client';

import { InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SharedViewBannerProps {
  onDismiss: () => void;
  onMakeCopy: () => void;
}

export default function SharedViewBanner({ onDismiss, onMakeCopy }: SharedViewBannerProps) {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Viewing Shared Analysis
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              You are viewing someone else's filtered shots and notes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onMakeCopy}
            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Make a Copy
          </button>
          <button
            onClick={onDismiss}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

**5.2 Add Shared Mode Detection to `app/page.tsx`**
```typescript
// Add state
const [isSharedView, setIsSharedView] = useState(false);
const [showSharedBanner, setShowSharedBanner] = useState(false);

// In URL reading useEffect, set shared mode
useEffect(() => {
  // ... existing code ...
  if (shareParam && sharedState) {
    setIsSharedView(true);
    setShowSharedBanner(true);
  }
}, [shots]);

// Add make copy handler
const handleMakeCopy = () => {
  // Clear URL parameter to exit shared mode
  window.history.replaceState({}, '', window.location.pathname);
  setIsSharedView(false);
  setShowSharedBanner(false);
};

// Add banner to JSX (at top of page)
{showSharedBanner && (
  <SharedViewBanner
    onDismiss={() => setShowSharedBanner(false)}
    onMakeCopy={handleMakeCopy}
  />
)}
```

#### Testing Checklist
- [ ] Banner shows when loading shared link
- [ ] Banner dismisses on X click
- [ ] "Make a Copy" removes share param
- [ ] Banner doesn't show for normal usage

---

### **✅ Feature 6: Share Management & Analytics** (Optional)
**Status:** Not Started
**Estimated Time:** 4-6 hours

#### Files to Create
- `app/api/share/route.ts` (NEW) - Backend API
- `lib/db/shares.ts` (NEW) - Database layer
- `components/ShareHistory.tsx` (NEW) - History UI

#### Implementation Details

**6.1 Database Schema**
```typescript
// Using Prisma or similar
model Share {
  id          String   @id @default(cuid())
  shortCode   String   @unique
  state       Json     // ShareableState
  createdBy   String?
  createdAt   DateTime @default(now())
  viewCount   Int      @default(0)
  lastViewed  DateTime?
  expiresAt   DateTime?
}
```

**6.2 API Route - `app/api/share/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { state } = await req.json();

  // Generate short code
  const shortCode = generateShortCode();

  // Store in database
  const share = await db.share.create({
    data: {
      shortCode,
      state,
      createdAt: new Date(),
    }
  });

  return NextResponse.json({
    shortUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/s/${shortCode}`,
    shareId: share.id,
  });
}

export async function GET(req: NextRequest) {
  const shortCode = req.nextUrl.searchParams.get('code');

  if (!shortCode) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const share = await db.share.findUnique({
    where: { shortCode }
  });

  if (!share) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Increment view count
  await db.share.update({
    where: { id: share.id },
    data: {
      viewCount: { increment: 1 },
      lastViewed: new Date(),
    }
  });

  return NextResponse.json({ state: share.state });
}
```

**6.3 Short URL Route - `app/s/[code]/page.tsx`**
```typescript
import { redirect } from 'next/navigation';

export default async function ShortLinkPage({ params }: { params: { code: string } }) {
  // Fetch share state
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/share?code=${params.code}`);
  const { state } = await res.json();

  // Encode and redirect to main page
  const encodedState = btoa(encodeURIComponent(JSON.stringify(state)));
  redirect(`/?share=${encodedState}`);
}
```

#### Testing Checklist
- [ ] Can create short URLs
- [ ] Short URLs redirect correctly
- [ ] View counts increment
- [ ] Share history displays
- [ ] Can delete old shares

---

## Technical Considerations

### URL Length Management
- **Maximum safe URL length:** 2000 characters
- **Base64 overhead:** ~33% size increase
- **Compression:** Use `lz-string` library if state exceeds 1500 chars
```typescript
import LZString from 'lz-string';

// Compress
const compressed = LZString.compressToEncodedURIComponent(json);

// Decompress
const json = LZString.decompressFromEncodedURIComponent(compressed);
```

### State Versioning
- Always include version number (`v: 1`)
- Handle backward compatibility
- Show migration warnings for old versions

### Security Considerations
- No sensitive data in URLs (public by design)
- Validate all input on deserialization
- Consider adding expiration timestamps
- Optional password protection for sensitive shares

### Performance Optimization
- Debounce share link generation (don't update on every keystroke)
- Cache generated URLs in component state
- Lazy load ShareDialog component

---

## Implementation Checklist

### Phase 1: Core Functionality
- [ ] Feature 1: State Serialization & URL Generation
- [ ] Feature 2: State Deserialization & URL Reading
- [ ] Feature 3: Share Button UI & Copy to Clipboard
- [ ] End-to-end test: Share link works

### Phase 2: Enhanced Notes
- [ ] Feature 4: Individual Shot Notes
- [ ] Update share state to include shot notes
- [ ] Test: Shared links include shot notes

### Phase 3: UX Polish
- [ ] Feature 5: Shared View Mode
- [ ] Test: Banner shows for shared views
- [ ] Test: Make a Copy functionality

### Phase 4: Advanced (Optional)
- [ ] Feature 6: Backend API for short URLs
- [ ] Database setup
- [ ] Share history UI
- [ ] Analytics dashboard

---

## Next Steps

1. ✅ Create this plan document
2. ⏳ Implement Feature 1: State Serialization
3. ⏳ Implement Feature 2: State Deserialization
4. ⏳ Implement Feature 3: Share Button UI
5. ⏳ Test end-to-end sharing workflow
6. ⏳ Implement Feature 4: Shot Notes
7. ⏳ Implement Feature 5: Shared View Mode
8. ⏳ (Optional) Implement Feature 6: Backend & Analytics

---

## Questions & Decisions

### Pending Decisions
- [ ] Should shared links be read-only or allow edits?
- [ ] Include trajectory drawing in shared state? (could be large)
- [ ] Implement short URLs from the start or later?
- [ ] Add expiration dates to shared links?
- [ ] Allow password-protected shares?

### Known Limitations
- SequenceBuilder blocks not yet serialized (need to extract state)
- Trajectory matching not included in v1
- No offline support for shared links
- URL length limit may restrict complex sequences

---

**Last Updated:** 2025-11-20
**Version:** 1.0
**Status:** Ready to implement
