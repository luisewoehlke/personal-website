import re
import urllib.request

html = urllib.request.urlopen("http://127.0.0.1:8000/").read().decode("utf-8", errors="replace")
m = re.search(r'id="best-of".*?</section>', html, re.S)
s = m.group(0) if m else ""
heading = re.search(r"<h2[^>]*>(.*?)</h2>", s, re.S)
print("HEADING:", re.sub(r"\s+", " ", heading.group(1)).strip() if heading else None)
hrefs = re.findall(r'href="(https://[^"]+)"', s)
titles = [re.sub(r"\s+", " ", t).strip() for t in re.findall(r"<h3>(.*?)</h3>", s, re.S)]
print("COUNT", len(hrefs), len(titles))
for i in range(max(len(hrefs), len(titles))):
    t = titles[i] if i < len(titles) else "?"
    h = hrefs[i] if i < len(hrefs) else "?"
    print(f"{i+1}. {t}")
    print(f"   {h}")
