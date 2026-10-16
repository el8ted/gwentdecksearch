# Gwent Deck Data Extraction Process

This document outlines how to extract card information from a Gwent deck list URL and map those cards to their individual pages on the gwent.one card database.

## Step 1: Extract Deck List from playgwent.com

### Input
Two URL patterns are supported:

**Shared Deck List:**
```
https://www.playgwent.com/en/decks/{deck_id}
```
Example: `https://www.playgwent.com/en/decks/d8bdb97b343c4f8f65401c94441874c1`

**Deck Guide:**
```
https://www.playgwent.com/en/decks/guides/{guide_id}
```
Example: `https://www.playgwent.com/en/decks/guides/408234`

Both patterns render the card list in the same container and use the same extraction approach.

### Process
1. Navigate to the deck URL using a browser automation tool (e.g., Playwright)
2. The deck list is rendered as **plain text** in the accessibility tree — no vision-based LLM needed
3. Card names appear as text nodes within the card list container
4. Strength values are also text (e.g., "9", "8/9", "x2" for copies)

### CSS Selector Strategy
The card list container uses CSS module classes with unique hash suffixes that change between deployments:
```
.CardsList__CardListContainer-sc-1o0vzpl-0  (example, hash varies)
```

**Use attribute-contains selectors for robustness:**
```css
/* Instead of exact class match */
[class*="CardsList__CardListContainer"]

/* Or use the accessibility tree directly (recommended) */
```

**Playwright example:**
```javascript
// Robust selector using attribute contains
const cardContainer = page.locator('[class*="CardsList__CardListContainer"]');

// Or use accessibility tree (most robust)
const cards = page.locator('listitem').all();
```

### Example Output
From the deck "Arachas Swarm":
```
Leader: Arachas Swarm (15)
Cards:
- Enchanted Armor (0)
- Golden Nekker (14)
- Royal Decree (9)
- Lord Riptide (9/9)
- Chimera x2 (6/5)
...
```

### Key Finding
Card information is fully extractable as text. Images are decorative overlays; the underlying data is in the DOM as text nodes.

## Step 2: Map Cards to gwent.one Database

### Database URL Pattern
```
https://gwent.one/en/cards/?v={version}&q={card_name}
```

### Version Selection
- The version dropdown (`#version`) contains all patch versions in descending order
- **Latest version is always the first option** in the dropdown
- Version options are grouped by year (2026, 2025, 2024, etc.)

### Dynamic Version Detection
To always use the latest version without hard-coding:

1. Navigate to `https://gwent.one/en/cards/`
2. Read the version dropdown options (the combobox element)
3. The first version option (after any year group header) is the latest
4. Use that version for all subsequent searches

**Example (Playwright):**
```javascript
// Navigate to cards page
await page.goto('https://gwent.one/en/cards/');

// Get the version dropdown
const versionDropdown = page.locator('#version');

// Read all options - first version option is latest
const options = await versionDropdown.options();
let latestVersion = null;
for (const opt of options) {
  const value = await opt.getValue();
  if (value.startsWith('v')) {
    latestVersion = value;
    break;
  }
}
// latestVersion = "v14.9.0" (as of October 2026)
```

**Alternative:** The page loads with the latest version pre-selected by default, so you can also just read the currently selected option value.

### Search Process
1. URL-encode the card name (spaces become `%20`)
2. Navigate to the search URL with the latest version
3. Parse the results in `#card-listing`

### Result Matching Strategy

**Important:** The first result is NOT always the exact card name match.

| Search Term | Results | First Result | Exact Match Position |
|-------------|---------|--------------|---------------------|
| Golden Nekker | 2 | Golden Nekker | 1st |
| Arachas Swarm | 1 | Arachas Swarm | 1st |
| Lord Riptide | 1 | Lord Riptide | 1st |
| Chimera | 2 | Dol Dhu Lokke | **2nd** |
| Royal Decree | 1 | Royal Decree | 1st |

**Pattern:**
- Single result = always exact match
- Multiple results = exact match usually first, but not guaranteed (ability text matches can rank higher)

### Recommended Matching Approach

**Option A: Parse and Match by Name**
1. Fetch all search results
2. Iterate through results comparing card names exactly
3. Return the first exact name match

**Option B: Use Name Filter**
1. After searching, click the "Name" button under the "Where" filter section
2. This restricts search to card names only (not ability text)
3. First result should then be the exact match

### Card Page URL Format
Individual card pages follow this pattern:
```
https://gwent.one/en/card/{card_id}
```
Where `{card_id}` is a numeric ID (e.g., `203123` for Golden Nekker).

## Complete Workflow Example

```
Input: https://www.playgwent.com/en/decks/d8bdb97b343c4f8f65401c94441874c1

Step 0: Detect latest version
→ Navigate to https://gwent.one/en/cards/
→ Read version dropdown → latestVersion = "v14.9.0"

Step 1: Extract deck list
→ Arachas Swarm, Golden Nekker, Royal Decree, Lord Riptide, Chimera, ...

Step 2: For each card, search gwent.one with detected version
→ Golden Nekker: https://gwent.one/en/cards/?v=v14.9.0&q=Golden%20Nekker
   → Match: Golden Nekker → https://gwent.one/en/card/203123

→ Arachas Swarm: https://gwent.one/en/cards/?v=v14.9.0&q=Arachas%20Swarm
   → Match: Arachas Swarm → https://gwent.one/en/card/201743

→ Chimera: https://gwent.one/en/cards/?v=v14.9.0&q=Chimera
   → Match: Chimera (2nd result) → https://gwent.one/en/card/202838
```

## Technical Notes

### playgwent.com
- Deck lists are accessible without login
- Card names are in text nodes, not images
- Strength values shown as text (single or dual values like "8/9")
- Copy counts shown as "x2", "x3", etc.

### gwent.one
- Fan-made card database (not official)
- Search URL parameters: `v` (version), `q` (query)
- Results include card name, type, and ability text
- Card IDs are numeric and stable
- Version history goes back to v1.0.0.15 (2018)

### Automation Tools
- Playwright MCP works well for both sites
- No JavaScript execution required for data extraction
- Accessibility snapshots provide clean text data
- URL-based search avoids complex form interaction