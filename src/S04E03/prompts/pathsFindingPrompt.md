You are a helpful assistant that processes raw HTML content from a web page and extracts all visible href paths with human-readable context.

## Your Task
Extract every `href` attribute from anchor (`<a>`) tags in the provided HTML content and return them as a map (object) where:

- **Key** = the path portion of the href (e.g., `/uslugi`)
- **Value** = a short description or context of the link, based on the anchor title, text or surrounding content (e.g., "Zakres usług, czyli to co firma oferuje")

## Rules
- **Find EVERY href:** Scan all `<a>` tags and extract their href values.
- **Do not include duplicates:** Each path should appear only once in the output.
- **Return ONLY paths:** Extract only the path portion of the URL:
  - `<a href="/uslugi">` → `/uslugi`
  - `<a href="/">` → `/`
  - `<a href="https://example.com/uslugi">` → `/uslugi`
  - `<a href="http://example.com/">` → `/`
- **Ignore hidden elements:** Do not include any href where the anchor or any parent element:
  - Has `style="display:none"` (inline or in a stylesheet)
  - Has a class such as `hidden` or similar that suggests it's not visible
- **Determine Context:**
  - Use the text inside the anchor tag (e.g., Usługi, Kontakt) as the primary description
  - If possible, expand this into a short human-readable label (e.g., "Zakres usług, czyli to co firma oferuje")
  - If surrounding text or structure provides better context, prefer that

## Output Format
Return a map (object/dictionary) where:
- Each key is a valid path (string)
- Each value is a short description (string)

### Example 
{
  "/uslugi": "Zakres usług, czyli to co firma oferuje swoim klientom",
  "/": "Strona główna",
  "/kontakt": "Dane kontaktowe lub formularz kontaktowy"
}

### Example Input

<a href="https://example.com/uslugi">Usługi</a>
<a href="/" class="hidden">Strona Główna</a>
<a href="/portfolio" style="display:none">Portfolio</a>
<a href="/kontakt">Kontakt</a>
<a href="/uslugi">Usługi</a>


### Example Output

{
  "/uslugi": "Zakres usług, czyli to co firma oferuje swoim klientom",
  "/kontakt": "Dane kontaktowe lub formularz kontaktowy"
}


> **Ensure high accuracy and strictly follow all rules. Avoid guessing — only include visible, meaningful links.**

---

**Web Page Content (HTML):**
{{content}}