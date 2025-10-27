# Shot Searcher - Features

A comprehensive badminton shot analysis tool I built with advanced search, visualization, and analytics capabilities.

## 🎯 Core Features

### 1. Natural Language Search with Local LLM
- **Local Ollama Integration** - Runs Qwen 2.5 7B model locally, no API costs
- **Voice Input** - Built-in Web Speech API for hands-free search
- **Smart Query Parsing** - Natural language like "show me all winners from zone-4" gets parsed into structured filters
- **Example Queries** - Pre-built examples to help users get started
- **Real-time Processing** - Instant filter application after query parsing

### 2. Interactive Court Heatmap
- **Accurate Visual Layout** - Vertical badminton court with horizontal net line
- **6-Zone Grid System** - Top row (zones 5, 4, 3) and bottom row (zones 0, 1, 2)
- **Coordinate-Based Zone Calculation** - Automatically calculates visual zones from shot coordinates instead of relying on CSV labels
- **Multiple Color Modes**:
  - By Shot Type (serve, drive, volley, lob, overhead)
  - By Shot Rating (0-13 scale with color gradient)
  - By Outcome (winners vs errors)
- **Interactive Zone Selection**:
  - Click zones to filter shots
  - Multi-select support (click multiple zones)
  - Subtle blue overlay shows selected zones
  - "Clear Zones" button with selection count
- **Density Heatmap** - Background opacity shows shot frequency per zone
- **Real-time Video Sync** - Pulsing dot shows current shot position during playback
- **Responsive Legend** - Color legend positioned beside heatmap for easy reference

### 3. Rally Timeline Viewer
- **Automatic Rally Extraction** - Uses `new_sequence` and `group` fields from CSV
- **Expandable Rally Cards** - Click to expand and see full shot sequence
- **Shot Progression Visualization** - Shows player alternation and shot types
- **Click-to-Jump** - Click any shot in rally to jump to that moment in video
- **Rally Statistics** - Shows rally length, winner, and duration

### 4. Video Timeline Scroller
- **Visual Shot Markers** - Every shot displayed as a vertical line on timeline
- **Color-Coded by Type** - Markers colored by shot type (serve, drive, volley, etc.)
- **Height = Rating** - Marker height represents shot rating (taller = higher rated)
- **Click to Seek** - Click anywhere on timeline to jump to that timestamp
- **Playback Position Indicator** - Blue highlight shows current video position
- **Smooth Scrolling** - Responsive horizontal scroll for long matches

### 5. Enhanced Multi-Dimensional Filters
- **Collapsible Design** - Advanced filters hidden by default to keep UI clean
- **Filter Categories**:
  - Shot Types (serve, drive, volley, lob, overhead)
  - Players (multi-select)
  - Visual Zone Grid (6-zone click interface)
  - Shot Direction (cross/left, cross/right, straight)
  - Court Side (top, bottom)
  - Rating Range (dual slider 0-13)
  - Outcome (winners, errors)
  - Rally Length (min/max)
- **Real-time Updates** - Shot count updates instantly as filters change
- **Clear All Button** - Reset all filters with one click
- **Filter Persistence** - Filters stay active across different views

### 6. Statistics Dashboard
- **Comprehensive Analytics** - Modal with charts and metrics
- **Player Performance Stats**:
  - Total shots per player
  - Average rating
  - Winners/errors ratio
  - Success rate percentage
- **Zone Analysis**:
  - Shot distribution across all 6 zones
  - Bar chart visualization
- **Shot Type Distribution**:
  - Pie chart showing type breakdown
  - Effectiveness metrics per type
- **Top Shots Leaderboard** - Highest rated shots with details
- **Overall Match Statistics** - Total shots, avg rating, winner/error counts
- **Recharts Integration** - Beautiful, responsive charts

### 7. Video Player Integration
- **Shot Information Panel** - Shows selected shot details below video
- **Smart Labels** - "Landing: zone-X" instead of confusing "zone-X → zone-X"
- **Outcome Badges** - Color-coded winner/error indicators
- **Timestamp Display** - Shows exact time in video
- **Star Rating** - Visual rating display for quality shots
- **Auto-play on Selection** - Clicking shots auto-seeks and plays

## 🎨 Design Features

### Minimalist & Aesthetic UI
- **Dark Mode Support** - Full dark theme throughout
- **Responsive Grid Layout** - Adapts to mobile, tablet, desktop
- **Tailwind CSS Styling** - Clean, modern design system
- **Smooth Animations** - Framer Motion for transitions
- **Professional Color Palette** - Emerald greens, blues, and neutrals
- **Shadow & Depth** - Subtle shadows for card separation

### User Experience Optimizations
- **Default View Simplicity** - Only search bar, video, and heatmap visible initially
- **Expandable Controls** - Advanced features hidden until needed
- **Loading States** - Spinner with descriptive text during data load
- **Error Handling** - Clear error messages with troubleshooting tips
- **Accessibility** - Semantic HTML and ARIA labels
- **Performance** - Virtual scrolling for large lists, memoized calculations

## 🛠️ Technical Implementation

### Data Processing
- **CSV Parsing** - Papa Parse for robust CSV handling
- **916 Total Shots** - Full dataset from `detected_shots_v2.csv`
- **Shot Rating Field** - 0-13 quality score (identified as "shot score")
- **Timestamp Calculation** - Frame numbers converted to seconds (30 FPS)
- **Rally Grouping** - Extracted from `new_sequence` and `group` fields

### Architecture
- **Next.js 14** - App Router with React Server Components
- **TypeScript** - Full type safety across codebase
- **Client-Side Rendering** - All interactive components use 'use client'
- **Custom Hooks** - useEffect for video synchronization
- **Component Modularity** - Reusable components with clear props

### Libraries & Tools
- `ollama` - Local LLM inference (Qwen 2.5 7B)
- `recharts` - Data visualization
- `framer-motion` - Animations
- `react-window` - Virtual scrolling
- `@heroicons/react` - Icon library
- `papaparse` - CSV parsing
- `tailwindcss` - Styling

## 📊 Data Fields Used

- `shot_label` - Type of shot (serve, drive, volley, lob, overhead)
- `frame` - Frame number in video
- `player_id` - Player identifier
- `zone_shuttle` - Landing zone (calculated from coordinates)
- `zone_player` - Player position zone
- `shot_direction` - Direction (cross/left, cross/right, straight)
- `shot_rating` - Quality score 0-13
- `winner_error` - Outcome (winner, error, or empty)
- `new_sequence` - Rally start indicator
- `group` - Rally group ID
- `normalized_coordinates` - [x, y] position (0-1 range)
- `player_court_side` - Top or bottom court side

## 🚀 Performance Features

- **Zero API Costs** - Everything runs locally
- **Efficient Filtering** - Memoized filter calculations
- **Lazy Loading** - Components load on demand
- **Optimized Renders** - React.memo and useMemo throughout
- **Small Bundle** - Code splitting for faster initial load

## 🎯 Key Accomplishments

✅ All 5 major features implemented
✅ Clean, minimalist, aesthetic design
✅ Advanced controls are collapsible
✅ Mobile responsive
✅ Local LLM integration (no backend costs)
✅ Real-time video-heatmap synchronization
✅ Multi-zone selection with clear visual feedback
✅ Accurate zone calculation from coordinates
✅ Comprehensive statistics and analytics
✅ Voice input for natural language search

---

Built with Next.js, TypeScript, Tailwind CSS, and Ollama.
