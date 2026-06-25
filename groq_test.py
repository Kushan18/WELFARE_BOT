import os
import traceback
from groq import Groq
from dotenv import load_dotenv
load_dotenv()

print("GROQ_API_KEY EXISTS =", bool(os.getenv("GROQ_API_KEY")))
print("GROQ_API_KEY LENGTH =", len(os.getenv("GROQ_API_KEY", "")))

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
try:
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": "Hello"}],
    )
    print("Groq response:", response.choices[0].message.content.strip())
except Exception as e:
    print("Groq call failed:")
    traceback.print_exc()
